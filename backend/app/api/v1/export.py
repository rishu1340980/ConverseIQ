from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.audit_logger import log_audit_event
from app.models.user import User
from app.models.meeting import Meeting
from app.services.exporter import generate_mom_pdf, generate_mom_docx

router = APIRouter(prefix="/export", tags=["Export"])

@router.get("/{meeting_id}/pdf")
async def export_meeting_pdf(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 10: Export finalized Minutes of Meeting as an official institutional PDF.
    """
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.participants),
            selectinload(Meeting.mom),
            selectinload(Meeting.action_items)
        )
        .where(Meeting.id == meeting_id)
    )
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if current_user.role != "Admin" and meeting.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    pdf_buffer = generate_mom_pdf(meeting, meeting.mom, meeting.action_items)
    safe_title = "".join(c for c in meeting.title if c.isalnum() or c in (' ', '_', '-')).rstrip()
    filename = f"MoM_{safe_title}_{meeting.date.strftime('%Y%m%d')}.pdf"

    await log_audit_event(
        db=db,
        action="MoM Exported",
        details=f"Exported PDF for meeting '{meeting.title}'",
        severity="Info",
        user_id=current_user.id,
        resource_type="Meeting",
        resource_id=meeting.id
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/{meeting_id}/docx")
async def export_meeting_docx(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 10: Export finalized Minutes of Meeting as an editable Word (.docx) document.
    """
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.participants),
            selectinload(Meeting.mom),
            selectinload(Meeting.action_items)
        )
        .where(Meeting.id == meeting_id)
    )
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if current_user.role != "Admin" and meeting.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    docx_buffer = generate_mom_docx(meeting, meeting.mom, meeting.action_items)
    safe_title = "".join(c for c in meeting.title if c.isalnum() or c in (' ', '_', '-')).rstrip()
    filename = f"MoM_{safe_title}_{meeting.date.strftime('%Y%m%d')}.docx"

    await log_audit_event(
        db=db,
        action="MoM Exported",
        details=f"Exported DOCX for meeting '{meeting.title}'",
        severity="Info",
        user_id=current_user.id,
        resource_type="Meeting",
        resource_id=meeting.id
    )

    return StreamingResponse(
        docx_buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
