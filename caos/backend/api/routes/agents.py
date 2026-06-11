"""Agent orchestration endpoints — trigger DAG runs, poll status."""

from uuid import UUID

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import AliasChoices, BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agents.orchestration.registry_runner import run_dag_via_registry
from api.middleware.jwt import get_current_user
from db.models import AgentOutput, DagRun, User
from db.session import get_db

logger = structlog.get_logger()
router = APIRouter()


class TriggerRunRequest(BaseModel):
    issuer_id: UUID
    document_id: UUID  # Trigger document (determines FULL vs DELTA)
    force_full_run: bool = False


class DagRunResponse(BaseModel):
    # ORM column is `id`; clients receive `dag_run_id`. AliasChoices lets
    # Pydantic populate the field from either `id` (SQLAlchemy attr) or
    # `dag_run_id` (dict shape) without renaming the wire contract.
    dag_run_id: UUID = Field(validation_alias=AliasChoices("dag_run_id", "id"))
    issuer_id: UUID
    run_type: str
    status: str

    model_config = {"from_attributes": True, "populate_by_name": True}


class AgentOutputResponse(BaseModel):
    id: UUID
    dag_run_id: UUID
    module_id: str
    status: str
    severity: str | None
    output: dict | None
    evidence_chain: dict | list | None
    blocked_reason: str | None

    model_config = {"from_attributes": True}


@router.post("/run", response_model=DagRunResponse, status_code=202)
async def trigger_run(
    body: TriggerRunRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a new CP-X DAG run for an issuer. Returns immediately; runs in background."""
    dag_run = DagRun(
        issuer_id=body.issuer_id,
        run_type="PENDING",  # CP-0 determines FULL_RUN vs DELTA_RUN
        status="PENDING",
        trigger_doc_id=body.document_id,
    )
    db.add(dag_run)
    # Commit before scheduling the background task: the runner opens its own
    # session and looks the row up by id, so it must already be persisted.
    await db.commit()
    await db.refresh(dag_run)

    background_tasks.add_task(
        run_dag_via_registry,
        dag_run_id=str(dag_run.id),
        issuer_id=str(body.issuer_id),
        document_id=str(body.document_id),
        force_full_run=body.force_full_run,
    )

    logger.info("DAG run triggered", dag_run_id=str(dag_run.id))
    return dag_run


@router.get("/runs/{dag_run_id}", response_model=DagRunResponse)
async def get_run(
    dag_run_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = await db.get(DagRun, dag_run_id)
    if not run:
        raise HTTPException(404, "DAG run not found")
    return run


@router.get("/runs/{dag_run_id}/outputs", response_model=list[AgentOutputResponse])
async def get_run_outputs(
    dag_run_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List individual agent module outputs for a DAG run."""
    result = await db.execute(
        select(AgentOutput)
        .where(AgentOutput.dag_run_id == dag_run_id)
        .order_by(AgentOutput.created_at)
    )
    return result.scalars().all()


@router.get("/runs", response_model=list[DagRunResponse])
async def list_runs(
    issuer_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(DagRun).order_by(DagRun.started_at.desc()).limit(50)
    if issuer_id:
        q = q.where(DagRun.issuer_id == issuer_id)
    result = await db.execute(q)
    return result.scalars().all()
