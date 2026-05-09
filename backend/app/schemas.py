"""
VIaC – Pydantic schemas for API request / response validation.

Design:
    • ResourcePayload is provider-agnostic — it carries a resource_type
      key and a free-form properties dict so new resource types can be
      supported without schema changes.
    • DeploymentRequest wraps a list of resources plus deployment-wide
      settings (region, environment).
    • Response models mirror the Terraform CLI steps executed.
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


# ── Request Models ───────────────────────────────────────────
class ResourcePayload(BaseModel):
    """A single infrastructure resource to provision.

    ``node_id`` is the unique identifier assigned by the React Flow canvas.
    It doubles as the Terraform resource name and is used for
    cross-resource references (``ref:node_id.attribute``).

    The ``resource_type`` must match a key in the Translator Engine's
    ``TEMPLATE_REGISTRY`` (e.g. ``"aws_vpc"``, ``"aws_subnet"``).
    ``properties`` is a free-form dict whose keys map directly to
    the variables expected by the Jinja2 template for that resource.
    """

    node_id: str = Field(
        ...,
        min_length=1,
        pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$",
        description=(
            "Unique node identifier from the canvas. Must be a valid "
            "Terraform identifier (letters, digits, underscores)."
        ),
        examples=["node_1", "vpc_prod"],
    )
    resource_type: str = Field(
        ...,
        min_length=1,
        description="Registry key for the resource (e.g. 'aws_vpc').",
        examples=["aws_vpc"],
    )
    properties: dict[str, Any] = Field(
        ...,
        description=(
            "Resource-specific configuration values passed to the "
            "Jinja2 template. Values starting with 'ref:' are resolved "
            "to Terraform cross-resource references "
            "(e.g. 'ref:node_1.id' → aws_vpc.node_1.id)."
        ),
    )


class PlanRequest(BaseModel):
    """Payload accepted by ``POST /plan``.

    Contains one or more resources to be aggregated into a single
    ``main.tf`` and executed as one Terraform run.
    """

    region: str = Field(
        default="us-east-1",
        description="AWS region for the provider block.",
        examples=["us-east-1", "eu-west-1"],
    )
    resources: list[ResourcePayload] = Field(
        ...,
        min_length=1,
        description="List of resources to provision.",
    )


# ── Response Models ──────────────────────────────────────────
class TerraformStepResult(BaseModel):
    """Result of a single Terraform CLI command."""

    command: str
    returncode: int
    stdout: str
    stderr: str


class PlanResponse(BaseModel):
    """Full response returned by ``POST /plan`` (plan only)."""

    success: bool
    generated_file: str
    resource_count: int = Field(
        description="Number of resources rendered into main.tf.",
    )
    init_result: TerraformStepResult
    plan_result: TerraformStepResult


class ApplyResponse(BaseModel):
    """Full response returned by ``POST /apply``."""

    success: bool
    generated_file: str
    resource_count: int = Field(
        description="Number of resources rendered into main.tf.",
    )
    init_result: TerraformStepResult
    apply_result: TerraformStepResult
    terraform_outputs: dict[str, Any] = Field(
        default_factory=dict,
        description="Parsed terraform output values (e.g. vpc_id, vpc_cidr).",
    )


class DestroyResponse(BaseModel):
    """Full response returned by ``POST /destroy``."""

    success: bool
    init_result: TerraformStepResult
    destroy_result: TerraformStepResult
