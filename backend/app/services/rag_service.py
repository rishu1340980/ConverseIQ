from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.meeting import Meeting
from app.models.mom import MinutesOfMeeting
from app.models.action_item import ActionItem
from app.schemas.ai_assistant import AIChatResponse, MeetingSourceReference

async def answer_faculty_query(
    db: AsyncSession,
    user_id: int,
    query: str,
    target_meeting_id: Optional[int] = None
) -> AIChatResponse:
    """
    Retrieves relevant meeting context from the database and answers faculty questions with citations.
    """
    # Build query for accessible meetings
    stmt = (
        select(Meeting)
        .options(selectinload(Meeting.mom), selectinload(Meeting.action_items), selectinload(Meeting.participants))
        .where(Meeting.created_by_id == user_id)
        .order_by(Meeting.date.desc())
    )
    if target_meeting_id:
        stmt = stmt.where(Meeting.id == target_meeting_id)

    result = await db.execute(stmt)
    meetings = result.scalars().all()

    if not meetings:
        return AIChatResponse(
            query=query,
            answer="I couldn't find any recorded meetings under your account. Once you create or upload a meeting recording, you can ask me questions about decisions, action items, or discussion topics.",
            sources=[],
            suggested_questions=[
                "How do I upload a meeting recording?",
                "How do I map attendees to speakers?",
                "What format is supported for MoM export?"
            ]
        )

    # Collect meeting data into context
    context_blocks = []
    sources: List[MeetingSourceReference] = []
    q_lower = query.lower()

    for m in meetings:
        m_title = m.title
        m_date = m.date.strftime("%B %d, %Y")
        summary = m.mom.summary if m.mom else "No summary available."
        decisions = m.mom.decisions if m.mom else []
        action_items = [f"{a.task} (Owner: {a.owner_name}, Priority: {a.priority}, Due: {a.due_date})" for a in m.action_items]

        # Check keyword relevance
        is_relevant = (
            any(w in m_title.lower() for w in q_lower.split()) or
            any(w in summary.lower() for w in q_lower.split()) or
            "decision" in q_lower or "action" in q_lower or "pending" in q_lower or "deadline" in q_lower
        )

        if is_relevant or len(sources) < 2:
            snippet = summary[:200] + "..." if len(summary) > 200 else summary
            sources.append(MeetingSourceReference(
                meeting_id=m.id,
                meeting_title=m_title,
                date=m_date,
                relevant_snippet=snippet
            ))

    # Formulate answer grounded in data
    latest = meetings[0]
    ans_lines = []

    if "decision" in q_lower:
        ans_lines.append(f"Here are the decisions recorded from your recent meetings, particularly **{latest.title}** ({latest.date.strftime('%B %d, %Y')}):")
        if latest.mom and latest.mom.decisions:
            for idx, d in enumerate(latest.mom.decisions, 1):
                ans_lines.append(f"- **{idx}.** {d}")
        else:
            ans_lines.append("No specific formal decisions were logged for this session.")

    elif "action" in q_lower or "pending" in q_lower or "task" in q_lower:
        pending_items = [item for m in meetings for item in m.action_items if item.status == "Pending"]
        ans_lines.append(f"You currently have **{len(pending_items)} pending action items** across your meetings:")
        for item in pending_items[:5]:
            due = item.due_date.strftime('%b %d') if item.due_date else "No deadline"
            ans_lines.append(f"- **[{item.priority}]** {item.task} — Assigned to: *{item.owner_name}* (Due: {due})")

    elif "deadline" in q_lower or "schedule" in q_lower:
        ans_lines.append(f"Upcoming deadlines and calendar items based on your meeting discussions:")
        deadlines = [item for m in meetings for item in m.action_items if item.due_date]
        if deadlines:
            for item in deadlines[:4]:
                ans_lines.append(f"- **{item.due_date.strftime('%B %d, %Y')}**: {item.task} ({item.owner_name})")
        else:
            ans_lines.append("- No immediate strict deadlines found in recorded action items.")

    else:
        ans_lines.append(f"Based on your recent meeting **'{latest.title}'** ({latest.date.strftime('%B %d, %Y')}):")
        if latest.mom:
            ans_lines.append(f"\n**Summary:** {latest.mom.summary}\n")
            if latest.mom.decisions:
                ans_lines.append(f"**Key Decision:** {latest.mom.decisions[0]}")
        else:
            ans_lines.append("The meeting is scheduled or currently processing.")

    suggested = [
        "What decisions were taken in the last faculty meeting?",
        "What are my pending action items?",
        "What deadlines are coming up this week?",
        "What was discussed regarding the examination schedule?"
    ]

    return AIChatResponse(
        query=query,
        answer="\n".join(ans_lines),
        sources=sources[:3],
        suggested_questions=[s for s in suggested if s.lower() != q_lower][:3]
    )
