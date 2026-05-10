"""
VIaC – Translator Engine
~~~~~~~~~~~~~~~~~~~~~~~~~
Converts structured JSON payloads from the frontend into
rendered Terraform (.tf) files using Jinja2 templates.

Design:
    • Each AWS resource type maps to a Jinja2 template in /templates.
    • The engine is stateless — it receives data, renders, and writes.
    • New resources can be added by dropping a .tf.j2 template and
      registering it in TEMPLATE_REGISTRY.
    • ``render_deployment`` aggregates multiple resources into a
      single HCL string with one provider block (Open-Closed).
    • Cross-resource references use the ``ref:node_id.attribute``
      syntax, resolved automatically before template rendering.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger("viac.translator")

# ── Paths ────────────────────────────────────────────────────
_ENGINE_DIR = Path(__file__).resolve().parent            # …/translator/
_APP_DIR = _ENGINE_DIR.parent                            # …/app/
_TEMPLATES_DIR = _APP_DIR / "templates"                  # …/app/templates/
_DEFAULT_OUTPUT_DIR = _APP_DIR.parent / "terraform_workspace"  # …/backend/terraform_workspace/

# ── Template registry ────────────────────────────────────────
# Maps a resource type key → template filename.
# Extend this dict as new resource templates are added.
TEMPLATE_REGISTRY: dict[str, str] = {
    "aws_vpc":                    "aws_vpc.tf.j2",
    "aws_internet_gateway":       "aws_internet_gateway.tf.j2",
    "aws_subnet":                 "aws_subnet.tf.j2",
    "aws_route_table":            "aws_route_table.tf.j2",
    "aws_route":                  "aws_route.tf.j2",
    "aws_route_table_association": "aws_route_table_association.tf.j2",
    "aws_security_group":         "aws_security_group.tf.j2",
    "aws_instance":               "aws_instance.tf.j2",
}

# Provider template — rendered once per deployment.
_PROVIDER_TEMPLATE = "provider_aws.tf.j2"

# ── Reference resolution ────────────────────────────────────
# Marker prefix injected into property values so the hcl_value
# Jinja2 filter can distinguish references from literal strings.
_REF_PREFIX = "__tfref__:"

# Pattern: "ref:<node_id>.<attribute>"
_REF_PATTERN = re.compile(r"^ref:([a-zA-Z_][a-zA-Z0-9_]*)\.(.+)$")


def _hcl_value(value: Any) -> str:
    """Jinja2 filter: emit a properly formatted HCL value.

    • Terraform references (marked with ``_REF_PREFIX``) are
      emitted **without quotes** so HCL treats them as expressions.
    • Literal strings are wrapped in double quotes.
    • Booleans → ``true`` / ``false``.
    • Lists → ``[element, element, ...]`` (each element run through
      ``hcl_value`` recursively).
    • Numbers pass through as-is.
    """
    if isinstance(value, list):
        items = ", ".join(_hcl_value(v) for v in value)
        return f"[{items}]"
    if isinstance(value, str):
        if value.startswith(_REF_PREFIX):
            return value[len(_REF_PREFIX):]   # raw TF expression
        return f'"{value}"'
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def resolve_references(resources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Resolve ``ref:node_id.attribute`` strings in all resource properties.

    Builds a ``node_id → resource_type`` lookup from the resource
    list, then scans every property value.  When a ``ref:`` value is
    found it is replaced with a marker string that the ``hcl_value``
    Jinja2 filter will later emit as a raw Terraform expression.

    Args:
        resources: List of resource dicts, each containing
                   ``node_id``, ``resource_type``, and ``properties``.

    Returns:
        A **new** list with references resolved (originals are not mutated).

    Raises:
        ValueError: If a ``ref:`` points to an unknown ``node_id`` or
                    has an invalid format.
    """
    # ── Build node_id → resource_type map ────────────────────
    node_map: dict[str, str] = {}
    for res in resources:
        nid = res["node_id"]
        if nid in node_map:
            raise ValueError(
                f"Duplicate node_id '{nid}'. Each resource must have "
                "a unique node_id."
            )
        node_map[nid] = res["resource_type"]

    logger.debug("Reference node map: %s", node_map)

    # ── Resolve ref: values ──────────────────────────────────
    def _resolve_value(value: Any, field_path: str) -> Any:
        """Recursively resolve a single property value."""
        if isinstance(value, str) and value.startswith("ref:"):
            match = _REF_PATTERN.match(value)
            if not match:
                raise ValueError(
                    f"Invalid reference format in '{field_path}': "
                    f"'{value}'. Expected 'ref:node_id.attribute'."
                )
            ref_node_id, ref_attr = match.group(1), match.group(2)
            ref_type = node_map.get(ref_node_id)
            if ref_type is None:
                available = ", ".join(sorted(node_map)) or "(none)"
                raise ValueError(
                    f"Unknown node reference '{ref_node_id}' in "
                    f"'{field_path}'. Available node_ids: {available}"
                )
            tf_ref = f"{ref_type}.{ref_node_id}.{ref_attr}"
            logger.info(
                "Resolved %s: '%s' → %s", field_path, value, tf_ref,
            )
            return f"{_REF_PREFIX}{tf_ref}"

        if isinstance(value, dict):
            return {
                k: _resolve_value(v, f"{field_path}.{k}")
                for k, v in value.items()
            }

        if isinstance(value, list):
            return [
                _resolve_value(v, f"{field_path}[{i}]")
                for i, v in enumerate(value)
            ]

        return value  # numbers, bools, None — pass through

    resolved: list[dict[str, Any]] = []
    for res in resources:
        new_props = _resolve_value(
            res["properties"],
            f"{res['resource_type']}({res['node_id']})",
        )
        # Coerce certain property shapes so Jinja2 templates receive
        # the expected types (e.g., cidr_blocks must be a list).
        def _ensure_list_of_strings(val):
            if val is None:
                return None
            if isinstance(val, list):
                return [str(x) for x in val]
            if isinstance(val, str):
                # Allow comma-separated lists in the UI: "a,b,c"
                parts = [p.strip() for p in val.split(",") if p.strip()]
                return parts if parts else [val]
            return [str(val)]

        if res["resource_type"] == "aws_security_group":
            # Normalize ingress_rules / egress_rules shapes
            for rules_key in ("ingress_rules", "egress_rules"):
                rules = new_props.get(rules_key)
                if isinstance(rules, list):
                    for r in rules:
                        if not isinstance(r, dict):
                            continue
                        if "cidr_blocks" in r:
                            r["cidr_blocks"] = _ensure_list_of_strings(r["cidr_blocks"])
                        else:
                            r["cidr_blocks"] = ["0.0.0.0/0"]

        resolved.append({**res, "properties": new_props})

    return resolved


# ── Jinja2 environment (created once, reused) ────────────────
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    keep_trailing_newline=True,
    trim_blocks=True,
    lstrip_blocks=True,
)
# Register the custom filter so templates can use {{ val | hcl_value }}
_jinja_env.filters["hcl_value"] = _hcl_value


# ── Single-resource rendering ───────────────────────────────
def render_template(resource_type: str, context: dict[str, Any]) -> str:
    """Render a Jinja2 template for the given resource type.

    Args:
        resource_type: Key in TEMPLATE_REGISTRY (e.g. ``"aws_vpc"``).
        context: Template variables to inject.

    Returns:
        The rendered HCL string.

    Raises:
        ValueError: If *resource_type* is not registered.
        jinja2.TemplateNotFound: If the template file is missing.
    """
    template_name = TEMPLATE_REGISTRY.get(resource_type)
    if template_name is None:
        registered = ", ".join(sorted(TEMPLATE_REGISTRY)) or "(none)"
        raise ValueError(
            f"Unknown resource type '{resource_type}'. "
            f"Registered types: {registered}"
        )

    template = _jinja_env.get_template(template_name)
    rendered = template.render(**context)
    logger.info("Rendered template '%s' for resource '%s'", template_name, resource_type)
    return rendered


# ── Aggregated deployment rendering ─────────────────────────
def render_deployment(
    resources: list[dict[str, Any]],
    *,
    region: str = "us-east-1",
) -> tuple[str, dict[str, dict[str, int]]]:
    """Render multiple resources into a single, aggregated HCL string.

    Steps:
        1. Resolve all ``ref:`` cross-resource references.
        2. Render the provider template once.
        3. Render each resource template with its ``node_id``
           injected into the context.
        4. Concatenate everything into a single HCL document.

    Args:
        resources: List of dicts, each with ``node_id`` (str),
                   ``resource_type`` (str), and ``properties`` (dict).
        region: AWS region injected into the provider block.

    Returns:
        Complete Terraform HCL ready to be written to ``main.tf``.
    """
    # ── 1. Resolve references ────────────────────────────────
    resolved = resolve_references(resources)

    sections: list[str] = []
    resource_banners: list[tuple[str, str, str]] = []  # (node_id, rtype, banner)

    # ── 2. Provider block (rendered once) ────────────────────
    provider_tmpl = _jinja_env.get_template(_PROVIDER_TEMPLATE)
    sections.append(provider_tmpl.render(region=region))
    logger.info("Rendered provider block for region '%s'", region)

    # ── 3. Resource blocks ───────────────────────────────────
    for idx, res in enumerate(resolved, start=1):
        rtype = res["resource_type"]
        node_id = res["node_id"]
        props = res["properties"]

        banner = (
            f"\n# ── Resource {idx}: {rtype} ({node_id}) "
            f"{'─' * max(1, 40 - len(rtype) - len(node_id))}"
        )
        sections.append(banner)

        # Inject node_id so templates can use it as the resource name
        context = {"node_id": node_id, **props}
        rendered = render_template(rtype, context)
        sections.append(rendered)

        resource_banners.append((node_id, rtype, banner))

    aggregated = "\n".join(sections)

    # Build a line-based map: node_id -> {start_line, end_line, resource_type}
    line_map: dict[str, dict[str, int]] = {}
    total_lines = aggregated.count("\n") + 1

    for i, (node_id, rtype, banner) in enumerate(resource_banners):
        pos = aggregated.find(banner)
        if pos == -1:
            continue
        start_line = aggregated.count("\n", 0, pos) + 1
        # End line is before next banner or EOF
        if i + 1 < len(resource_banners):
            next_banner = resource_banners[i + 1][2]
            next_pos = aggregated.find(next_banner, pos + 1)
            end_line = aggregated.count("\n", 0, next_pos) if next_pos != -1 else total_lines
        else:
            end_line = total_lines

        line_map[node_id] = {
            "start_line": start_line,
            "end_line": end_line,
            "resource_type": rtype,
        }

    logger.info(
        "Aggregated %d resource(s) into a single HCL document (%d chars)",
        len(resources),
        len(aggregated),
    )
    return aggregated, line_map


# ── File writing ────────────────────────────────────────────
def write_terraform_file(
    rendered_hcl: str,
    *,
    filename: str = "main.tf",
    output_dir: Path | str | None = None,
) -> Path:
    """Write rendered HCL to a .tf file inside the Terraform workspace.

    Args:
        rendered_hcl: The rendered Terraform HCL content.
        filename: Output filename (default ``main.tf``).
        output_dir: Target directory. Falls back to the default workspace.

    Returns:
        The absolute ``Path`` of the written file.
    """
    workspace = Path(output_dir) if output_dir else _DEFAULT_OUTPUT_DIR
    workspace.mkdir(parents=True, exist_ok=True)

    filepath = workspace / filename
    filepath.write_text(rendered_hcl, encoding="utf-8")
    logger.info("Wrote Terraform file → %s", filepath)
    return filepath


# ── High-level helpers ──────────────────────────────────────
def translate_and_write(
    resource_type: str,
    context: dict[str, Any],
    *,
    filename: str = "main.tf",
    output_dir: Path | str | None = None,
) -> Path:
    """Render a **single** resource + write.  Kept for backward compat."""
    hcl = render_template(resource_type, context)
    return write_terraform_file(hcl, filename=filename, output_dir=output_dir)


def translate_deployment(
    resources: list[dict[str, Any]],
    *,
    region: str = "us-east-1",
    filename: str = "main.tf",
    output_dir: Path | str | None = None,
) -> tuple[Path, dict[str, dict[str, int]]]:
    """Render a full deployment (provider + N resources) and write.

    This is the primary entry point used by the ``/plan`` and
    ``/apply`` endpoints.

    Returns:
        Path to the written ``main.tf``.
    """
    hcl, line_map = render_deployment(resources, region=region)
    path = write_terraform_file(hcl, filename=filename, output_dir=output_dir)
    return path, line_map

