from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.ai_assistant import AIChatRequest, AIChatResponse
from app.services.rag_service import answer_faculty_query

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

@router.post("/chat", response_model=AIChatResponse)
async def chat_with_meetings(
    req: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 11: Grounded conversational Q&A assistant across meetings.
    """
    response = await answer_faculty_query(
        db=db,
        user_id=current_user.id,
        query=req.query,
        target_meeting_id=req.meeting_id
    )
    return response
