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
from app.translator.engine import translate_deployment
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
def _translate(payload: PlanRequest) -> Path:
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
        tf_file = translate_deployment(
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
    return tf_file


def _skipped_step(reason: str) -> TerraformStepResult:
    """Return a placeholder result for a step that was skipped."""
    return TerraformStepResult(
        command="(skipped)", returncode=-1, stdout="", stderr=reason,
    )


# ── Endpoints ────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Simple liveness probe."""
    return {"status": "healthy", "service": "viac-backend"}


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
    tf_file = _translate(payload)

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

    return PlanResponse(
        success=success,
        generated_file=str(tf_file),
        resource_count=resource_count,
        init_result=TerraformStepResult(**init_result),
        plan_result=TerraformStepResult(**plan_result),
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
    tf_file = _translate(payload)

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
        return ApplyResponse(
            success=False,
            generated_file=str(tf_file),
            resource_count=resource_count,
            init_result=TerraformStepResult(**init_result),
            apply_result=TerraformStepResult(**apply_result),
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

