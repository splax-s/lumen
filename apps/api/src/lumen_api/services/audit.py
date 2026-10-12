"""The ops audit log: every staff action that reads personal data or changes anything."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import OpsAuditLog, ParentAccount


def audit(
    db: AsyncSession,
    staff: ParentAccount,
    action: str,
    target_type: str = "",
    target_id: object = "",
    detail: dict[str, Any] | None = None,
) -> None:
    db.add(
        OpsAuditLog(
            staff_id=staff.id,
            staff_email=staff.email,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            detail=detail or {},
        )
    )
