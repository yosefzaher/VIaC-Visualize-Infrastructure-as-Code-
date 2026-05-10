"""
VIaC – FastAPI Application
~~~~~~~~~~~~~~~~~~~~~~~~~~~
Entry point for the backend API.  Exposes endpoints that the
React frontend will call to translate visual diagrams into
Terraform code and execute infrastructure operations.

Run locally:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import (
    PlanRequest,
    PlanResponse,
    ApplyResponse,
    DestroyResponse,
    TerraformStepResult,
)
from app.translator.engine import translate_deployment, render_deployment
from app.terraform.runner import (
    init as tf_init,
    plan as tf_plan,
    apply as tf_apply,
    destroy as tf_destroy,
    output as tf_output,
)

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-22s │ %(levelname)-7s │ %(message)s",
)
logger = logging.getLogger("viac.api")

# ── FastAPI app ──────────────────────────────────────────────
app = FastAPI(
    title="VIaC – Visual Infrastructure as Code",
    description=(
        "Translate drag-and-drop infrastructure diagrams into "
        "Terraform HCL and deploy to AWS."
    ),
    version="0.2.0",
)

# CORS – allow the React dev server during local development.
# Tighten these origins before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Terraform workspace path ────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent.parent  # …/backend/
_TF_WORKSPACE = _BACKEND_DIR / "terraform_workspace"


# ── Internal helpers ─────────────────────────────────────────
def _translate(payload: PlanRequest) -> tuple[Path, list[dict], dict[str, dict[str, int]]]:
    """Render all resources in *payload* into a single ``main.tf``.

    Raises:
        HTTPException 422: if a resource_type is unknown.
        HTTPException 500: on unexpected translation errors.
    """
    resource_dicts = [
        {
            "node_id": r.node_id,
            "resource_type": r.resource_type,
            "properties": r.properties,
        }
        for r in payload.resources
    ]
    try:
        tf_file, line_map = translate_deployment(
            resource_dicts,
            region=payload.region,
            output_dir=_TF_WORKSPACE,
        )
    except ValueError as exc:
        # Unknown resource type – client error
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Translation failed")
        raise HTTPException(status_code=500, detail=f"Translation error: {exc}")

    logger.info(
        "Translated %d resource(s) → %s",
        len(payload.resources),
        tf_file,
    )
    return tf_file, resource_dicts, line_map


def _skipped_step(reason: str) -> TerraformStepResult:
    """Return a placeholder result for a step that was skipped."""
    return TerraformStepResult(
        command="(skipped)", returncode=-1, stdout="", stderr=reason,
    )


def _parse_terraform_diagnostics(stderr: str, resources: list[dict] | None = None, line_map: dict[str, dict] | None = None) -> list[dict]:
    """Parse Terraform stderr to extract resource addresses and map to node_ids.

    Returns a list of dicts with keys: node_id, resource_address, message, severity.
    """
    import re

    if not stderr:
        return []

    diagnostics_by_node: dict[str, dict] = {}

    # First attempt: pattern like 'in resource "aws_subnet" "subnet_3":'
    pattern = re.compile(r'in resource\s+"(?P<rtype>[^"]+)"\s+"(?P<rname>[^"]+)"')
    for m in pattern.finditer(stderr):
        rtype = m.group("rtype")
        rname = m.group("rname")
        start = m.start()

        # Find nearest 'Error:' occurrence before this match for context
        err_idx = stderr.rfind("Error:", 0, start)
        if err_idx != -1:
            # capture until a blank line or up to the resource match
            next_blank = stderr.find("\n\n", err_idx)
            if next_blank != -1 and next_blank < start:
                message = stderr[err_idx:next_blank].strip()
            else:
                message = stderr[err_idx:start].strip()
        else:
            # Fallback: small window around the resource match
            ws = max(0, start - 200)
            we = min(len(stderr), m.end() + 200)
            message = stderr[ws:we].strip()

        diagnostics_by_node[rname] = {
            "node_id": rname,
            "resource_address": f"{rtype}.{rname}",
            "message": message,
            "severity": "error",
        }

    # Early attempt: if stderr references a file line (e.g. 'on main.tf line 78'),
    # map that line to a node using the provided line_map.
    line_hits = []
    line_pat = re.compile(r'on\s+[^\s]+\s+line\s+(?P<line>\d+)', re.IGNORECASE)
    for lm in line_pat.finditer(stderr):
        try:
            ln = int(lm.group("line"))
        except ValueError:
            continue
        line_hits.append((ln, lm.start()))

    if line_hits and line_map:
        for ln, start_pos in line_hits:
            for nid, info in line_map.items():
                if info.get("start_line") <= ln <= info.get("end_line"):
                    # capture a nearby message (prefer Error: block if present)
                    err_idx = stderr.rfind("Error:", 0, start_pos)
                    if err_idx != -1:
                        next_blank = stderr.find("\n\n", err_idx)
                        if next_blank != -1 and next_blank < start_pos:
                            message = stderr[err_idx:next_blank].strip()
                        else:
                            message = stderr[err_idx:start_pos].strip()
                    else:
                        ws = max(0, start_pos - 200)
                        we = min(len(stderr), start_pos + 200)
                        message = stderr[ws:we].strip()

                    diagnostics_by_node[nid] = {
                        "node_id": nid,
                        "resource_address": f"{info.get('resource_type')}.{nid}",
                        "message": message,
                        "severity": "error",
                    }

        if diagnostics_by_node:
            return list(diagnostics_by_node.values())

    # Second attempt: if no matches found above, try to match any known
    # resource addresses from the provided resources list by simple substring
    # search. This helps when Terraform mentions an address directly.
    if not diagnostics_by_node and resources:
        node_map = {r["node_id"]: r["resource_type"] for r in resources}
        for nid, rtype in node_map.items():
            addr = f"{rtype}.{nid}"
            if addr in stderr:
                # capture a window around the first occurrence
                idx = stderr.find(addr)
                ws = max(0, idx - 200)
                we = min(len(stderr), idx + len(addr) + 200)
                message = stderr[ws:we].strip()
                diagnostics_by_node[nid] = {
                    "node_id": nid,
                    "resource_address": addr,
                    "message": message,
                    "severity": "error",
                }

    # Fallback: try to capture generic 'Error:' blocks and attribute them
    # to any resource-like token 'type.name' found nearby.
    if not diagnostics_by_node:
        # find first Error: block
        err_idx = stderr.find("Error:")
        if err_idx != -1:
            next_blank = stderr.find("\n\n", err_idx)
            block = stderr[err_idx: next_blank if next_blank != -1 else err_idx + 400].strip()
            # search for tokens like aws_subnet.subnet_3 inside the block
            addr_pat = re.compile(r"(?P<addr>[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)")
            for m in addr_pat.finditer(block):
                addr = m.group("addr")
                if "." in addr:
                    rtype, rname = addr.split(".", 1)
                    diagnostics_by_node[rname] = {
                        "node_id": rname,
                        "resource_address": addr,
                        "message": block,
                        "severity": "error",
                    }

    return list(diagnostics_by_node.values())


# ── Endpoints ────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Simple liveness probe."""
    return {"status": "healthy", "service": "viac-backend"}


@app.post("/render")
async def handle_render(payload: PlanRequest):
    """Render HCL for the given payload and return it as text (no Terraform run).

    This endpoint is used by the frontend for HCL preview and download.
    """
    resource_dicts = [
        {
            "node_id": r.node_id,
            "resource_type": r.resource_type,
            "properties": r.properties,
        }
        for r in payload.resources
    ]

    try:
        hcl, _line_map = render_deployment(resource_dicts, region=payload.region)
    except ValueError as exc:
        # Unknown resource type – client error
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Render failed")
        raise HTTPException(status_code=500, detail=f"Render error: {exc}")

    return {"hcl": hcl}


@app.post("/plan", response_model=PlanResponse)
async def handle_plan(payload: PlanRequest):
    """Translate a set of resources to Terraform and run ``plan``.

    Workflow:
        1. Render **all** resources → single ``main.tf``
        2. ``terraform init``
        3. ``terraform plan``
        4. Return structured results to the caller.
    """
    resource_count = len(payload.resources)
    logger.info(
        "Plan request: %d resource(s), region=%s",
        resource_count,
        payload.region,
    )

    # ── 1. Translate ─────────────────────────────────────────
    tf_file, resource_dicts, line_map = _translate(payload)

    # ── 2. Terraform init ────────────────────────────────────
    init_result = await tf_init(cwd=_TF_WORKSPACE)
    if init_result["returncode"] != 0:
        logger.error("terraform init failed:\n%s", init_result["stderr"])
        return PlanResponse(
            success=False,
            generated_file=str(tf_file),
            resource_count=resource_count,
            init_result=TerraformStepResult(**init_result),
            plan_result=_skipped_step("Init failed; plan was skipped."),
        )

    # ── 3. Terraform plan ────────────────────────────────────
    plan_result = await tf_plan(cwd=_TF_WORKSPACE)

    success = plan_result["returncode"] == 0
    if not success:
        logger.warning("terraform plan returned rc=%s", plan_result["returncode"])

    diagnostics = _parse_terraform_diagnostics(
        plan_result.get("stderr", ""),
        resources=resource_dicts,
        line_map=line_map,
    )
    if diagnostics:
        logger.info("Parsed diagnostics for plan: %s", diagnostics)

    return PlanResponse(
        success=success,
        generated_file=str(tf_file),
        resource_count=resource_count,
        init_result=TerraformStepResult(**init_result),
        plan_result=TerraformStepResult(**plan_result),
        diagnostics=diagnostics,
    )


@app.post("/apply", response_model=ApplyResponse)
async def handle_apply(payload: PlanRequest):
    """Translate a set of resources to Terraform and **apply** to AWS.

    Workflow:
        1. Render **all** resources → single ``main.tf``
        2. ``terraform init``
        3. ``terraform apply -auto-approve``
        4. ``terraform output -json``  → extract created resource IDs
        5. Return full results to the caller.

    .. note::
        Apply can take several minutes for real AWS resources.
        The runner's default timeout is 600 s (10 min).
    """
    resource_count = len(payload.resources)
    logger.info(
        "Apply request: %d resource(s), region=%s",
        resource_count,
        payload.region,
    )

    # ── 1. Translate ─────────────────────────────────────────
    tf_file, resource_dicts, line_map = _translate(payload)

    # ── 2. Terraform init ────────────────────────────────────
    init_result = await tf_init(cwd=_TF_WORKSPACE)
    if init_result["returncode"] != 0:
        logger.error("terraform init failed:\n%s", init_result["stderr"])
        return ApplyResponse(
            success=False,
            generated_file=str(tf_file),
            resource_count=resource_count,
            init_result=TerraformStepResult(**init_result),
            apply_result=_skipped_step("Init failed; apply was skipped."),
        )

    # ── 3. Terraform apply ───────────────────────────────────
    apply_result = await tf_apply(cwd=_TF_WORKSPACE)

    if apply_result["returncode"] != 0:
        logger.error("terraform apply failed:\n%s", apply_result["stderr"])
        diagnostics = _parse_terraform_diagnostics(
            apply_result.get("stderr", ""),
            resources=resource_dicts,
            line_map=line_map,
        )
        if diagnostics:
            logger.info("Parsed diagnostics for apply: %s", diagnostics)
        return ApplyResponse(
            success=False,
            generated_file=str(tf_file),
            resource_count=resource_count,
            init_result=TerraformStepResult(**init_result),
            apply_result=TerraformStepResult(**apply_result),
            diagnostics=diagnostics,
        )

    # ── 4. Extract outputs ───────────────────────────────────
    terraform_outputs: dict = {}

    output_result = await tf_output(cwd=_TF_WORKSPACE)
    if output_result["returncode"] == 0 and output_result["stdout"].strip():
        try:
            raw_outputs = json.loads(output_result["stdout"])
            # terraform output -json → {"key": {"value": ..., "type": ...}}
            terraform_outputs = {
                k: v.get("value") for k, v in raw_outputs.items()
            }
            logger.info("Terraform outputs: %s", terraform_outputs)
        except json.JSONDecodeError:
            logger.warning(
                "Could not parse terraform output JSON: %s",
                output_result["stdout"][:200],
            )

    return ApplyResponse(
        success=True,
        generated_file=str(tf_file),
        resource_count=resource_count,
        init_result=TerraformStepResult(**init_result),
        apply_result=TerraformStepResult(**apply_result),
        terraform_outputs=terraform_outputs,
        diagnostics=[],
    )


@app.post("/destroy", response_model=DestroyResponse)
async def handle_destroy():
    """Destroy all infrastructure managed in the current workspace.

    Workflow:
        1. Verify the workspace exists and contains Terraform files.
        2. ``terraform init``   (ensures state backend is ready)
        3. ``terraform destroy -auto-approve``
        4. Return full stdout/stderr logs.

    No request body is needed — it destroys everything tracked in
    the workspace's Terraform state.
    """
    logger.info("Destroy request received for workspace: %s", _TF_WORKSPACE)

    # ── Safety check: workspace must exist ────────────────────
    if not _TF_WORKSPACE.exists() or not any(_TF_WORKSPACE.glob("*.tf")):
        raise HTTPException(
            status_code=404,
            detail=(
                f"No Terraform files found in workspace '{_TF_WORKSPACE}'. "
                "Nothing to destroy."
            ),
        )

    # ── 1. Terraform init ────────────────────────────────────
    init_result = await tf_init(cwd=_TF_WORKSPACE)
    if init_result["returncode"] != 0:
        logger.error("terraform init failed:\n%s", init_result["stderr"])
        return DestroyResponse(
            success=False,
            init_result=TerraformStepResult(**init_result),
            destroy_result=_skipped_step("Init failed; destroy was skipped."),
        )

    # ── 2. Terraform destroy ─────────────────────────────────
    destroy_result = await tf_destroy(cwd=_TF_WORKSPACE)

    success = destroy_result["returncode"] == 0
    if success:
        logger.info("Destroy completed successfully.")
    else:
        logger.error("terraform destroy failed:\n%s", destroy_result["stderr"])

    return DestroyResponse(
        success=success,
        init_result=TerraformStepResult(**init_result),
        destroy_result=TerraformStepResult(**destroy_result),
    )

