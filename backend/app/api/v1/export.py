from typing import List, Optional
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
from app.models.action_item import ActionItem
from app.services.exporter import generate_mom_pdf, generate_mom_docx, generate_action_items_pdf

router = APIRouter(prefix="/export", tags=["Export"])

@router.get("/action-items/pdf")
async def export_action_items_pdf(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Export all departmental action items and deliverables as an official institutional PDF.
    """
    stmt = select(ActionItem).order_by(ActionItem.due_date.asc())
    result = await db.execute(stmt)
    action_items = result.scalars().all()

    pdf_buffer = generate_action_items_pdf(action_items)
    filename = "ConverseIQ_Action_Items_Register.pdf"

    await log_audit_event(
        db=db,
        action="Action Items Register Exported",
        details=f"Exported PDF for {len(action_items)} action items",
        severity="Info",
        user_id=current_user.id,
        resource_type="ActionItem"
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/{meeting_id}/pdf")
@router.get("/mom/{meeting_id}/pdf")
async def export_meeting_pdf(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 10: Export finalized Minutes of Meeting as an official institutional PDF.
    Accessible to all authenticated departmental faculty and administrators.
    """
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.creator),
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

    pdf_buffer = generate_mom_pdf(meeting, meeting.mom, meeting.action_items)
    safe_title = "".join(c for c in meeting.title if c.isalnum() or c in (' ', '_', '-')).rstrip()
    date_str = meeting.date.strftime('%Y%m%d') if meeting.date else "deliberation"
    filename = f"MoM_{safe_title}_{date_str}.pdf"

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
@router.get("/mom/{meeting_id}/docx")
async def export_meeting_docx(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 10: Export finalized Minutes of Meeting as an editable Word (.docx) document.
    Accessible to all authenticated departmental faculty and administrators.
    """
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.creator),
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

    docx_buffer = generate_mom_docx(meeting, meeting.mom, meeting.action_items)
    safe_title = "".join(c for c in meeting.title if c.isalnum() or c in (' ', '_', '-')).rstrip()
    date_str = meeting.date.strftime('%Y%m%d') if meeting.date else "deliberation"
    filename = f"MoM_{safe_title}_{date_str}.docx"

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


# Reports alias router (/reports/mom/{id}/pdf, /reports/action-items/pdf)
reports_router = APIRouter(prefix="/reports", tags=["Reports"])
reports_router.add_api_route("/action-items/pdf", export_action_items_pdf, methods=["GET"])
reports_router.add_api_route("/mom/{meeting_id}/pdf", export_meeting_pdf, methods=["GET"])
reports_router.add_api_route("/{meeting_id}/pdf", export_meeting_pdf, methods=["GET"])
reports_router.add_api_route("/mom/{meeting_id}/docx", export_meeting_docx, methods=["GET"])
reports_router.add_api_route("/{meeting_id}/docx", export_meeting_docx, methods=["GET"])

# MoM export alias router (/mom/{id}/export/docx, /mom/{id}/export/pdf)
mom_export_router = APIRouter(prefix="/mom", tags=["MoM Export"])
mom_export_router.add_api_route("/{meeting_id}/export/pdf", export_meeting_pdf, methods=["GET"])
mom_export_router.add_api_route("/{meeting_id}/export/docx", export_meeting_docx, methods=["GET"])
mom_export_router.add_api_route("/{meeting_id}/pdf", export_meeting_pdf, methods=["GET"])
mom_export_router.add_api_route("/{meeting_id}/docx", export_meeting_docx, methods=["GET"])


