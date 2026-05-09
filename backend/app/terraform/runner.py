"""
VIaC – Terraform Runner
~~~~~~~~~~~~~~~~~~~~~~~~
Wraps ``terraform`` CLI commands (init, plan, apply, destroy)
as async subprocess calls.  Each function returns a structured
result dict with stdout, stderr, and return code.

Security note:
    AWS credentials are expected as environment variables
    (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION).
    The runner inherits the current process environment.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("viac.terraform")

# Timeout for any single Terraform command (seconds).
_CMD_TIMEOUT = 300


async def _run_terraform(
    *args: str,
    cwd: Path,
    timeout: int = _CMD_TIMEOUT,
) -> dict[str, Any]:
    """Run a ``terraform`` sub-command and capture output.

    Args:
        *args: Arguments passed after ``terraform`` (e.g. ``"init"``, ``"-no-color"``).
        cwd: Working directory (the Terraform workspace).
        timeout: Max seconds before the process is killed.

    Returns:
        Dict with ``command``, ``returncode``, ``stdout``, ``stderr``.
    """
    cmd = ["terraform", *args]
    logger.info("Running: %s  (cwd=%s)", " ".join(cmd), cwd)

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=os.environ.copy(),  # inherits AWS creds
    )

    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(), timeout=timeout
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        return {
            "command": " ".join(cmd),
            "returncode": -1,
            "stdout": "",
            "stderr": f"Command timed out after {timeout}s",
        }

    result = {
        "command": " ".join(cmd),
        "returncode": proc.returncode,
        "stdout": stdout_bytes.decode("utf-8", errors="replace"),
        "stderr": stderr_bytes.decode("utf-8", errors="replace"),
    }
    logger.info(
        "Finished: %s  rc=%s  stdout=%d bytes  stderr=%d bytes",
        " ".join(cmd),
        proc.returncode,
        len(result["stdout"]),
        len(result["stderr"]),
    )
    return result


# ── Public wrappers ──────────────────────────────────────────
async def init(cwd: Path) -> dict[str, Any]:
    """Run ``terraform init`` in the given workspace."""
    return await _run_terraform("init", "-no-color", "-input=false", cwd=cwd)


async def plan(cwd: Path) -> dict[str, Any]:
    """Run ``terraform plan`` in the given workspace."""
    return await _run_terraform("plan", "-no-color", "-input=false", cwd=cwd)


async def apply(cwd: Path, timeout: int = 600) -> dict[str, Any]:
    """Run ``terraform apply -auto-approve`` in the given workspace.

    Default timeout is 600s (10 min) because real AWS resource
    creation can take several minutes.
    """
    return await _run_terraform(
        "apply", "-auto-approve", "-no-color", "-input=false",
        cwd=cwd, timeout=timeout,
    )


async def destroy(cwd: Path, timeout: int = 600) -> dict[str, Any]:
    """Run ``terraform destroy -auto-approve`` in the given workspace."""
    return await _run_terraform(
        "destroy", "-auto-approve", "-no-color", "-input=false",
        cwd=cwd, timeout=timeout,
    )


async def output(cwd: Path) -> dict[str, Any]:
    """Run ``terraform output -json`` and return the raw result.

    The caller is responsible for parsing the JSON in ``stdout``.
    """
    return await _run_terraform("output", "-json", "-no-color", cwd=cwd)
