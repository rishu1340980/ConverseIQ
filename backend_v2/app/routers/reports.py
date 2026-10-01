from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.models.mom import MinutesOfMeeting
from backend_v2.app.models.action_item import ActionItem
from backend_v2.app.models.participant import MeetingParticipant
from backend_v2.app.services.pdf_generator import generate_mom_pdf, generate_action_items_pdf
from backend_v2.app.services.audit import log_audit_event

router = APIRouter(tags=["reports"])

@router.get("/reports/mom/{meeting_id}/pdf")
@router.get("/export/{meeting_id}/pdf")
@router.get("/mom/{meeting_id}/export/pdf")
async def download_mom_pdf(
    meeting_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and download a branded PDF of Minutes of Meeting (MoM)."""
    # Load meeting with related user, department, participants, and action items
    stmt = (
        select(Meeting)
        .filter(Meeting.id == meeting_id)
        .options(
            selectinload(Meeting.user),
            selectinload(Meeting.department),
            selectinload(Meeting.participants),
            selectinload(Meeting.action_items),
            selectinload(Meeting.mom),
        )
    )
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    # Permission check: Faculty can only export their own/department meetings, HOD/Admin can export all
    if current_user.role == "Faculty" and meeting.user_id != current_user.id:
        if meeting.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this meeting report")

    # Generate PDF bytes
    pdf_bytes = generate_mom_pdf(
        meeting=meeting,
        mom=meeting.mom,
        action_items=meeting.action_items,
        participants=meeting.participants,
        department_name=meeting.department.name if meeting.department else ""
    )
    
    # Audit log
    await log_audit_event(
        db=db,
        action="EXPORT_MOM_PDF",
        details=f"Exported PDF Minutes of Meeting for '{meeting.title}' (Meeting ID: {meeting.id}) by {current_user.email}",
        user_id=current_user.id,
        user_name=current_user.name,
    )
    
    # Clean filename
    clean_title = "".join(c for c in (meeting.title or "meeting") if c.isalnum() or c in (' ', '_', '-')).rstrip()
    filename = f"MoM_{clean_title.replace(' ', '_')}_{meeting.id}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/reports/action-items/pdf")
@router.get("/action-items/export/pdf")
async def download_action_items_pdf(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and download a consolidated PDF of all action items."""
    query = select(ActionItem)
    if current_user.role == "Faculty":
        query = query.filter(ActionItem.user_id == current_user.id)
    elif current_user.role == "HOD" and current_user.department_id:
        # Load department users' action items
        query = query.join(User, ActionItem.user_id == User.id).filter(User.department_id == current_user.department_id)
        
    result = await db.execute(query)
    action_items = result.scalars().all()
    
    pdf_bytes = generate_action_items_pdf(
        action_items=action_items,
        title=f"Action Items — {current_user.role} Export"
    )
    
    await log_audit_event(
        db=db,
        action="EXPORT_ACTION_ITEMS_PDF",
        details=f"Exported consolidated Action Items PDF ({len(action_items)} items) by {current_user.email}",
        user_id=current_user.id,
        user_name=current_user.name,
    )
    
    filename = f"ConverseIQ_Action_Items_{current_user.role}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
