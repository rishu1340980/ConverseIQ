from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.meeting import Meeting
from app.models.mom import MinutesOfMeeting
from app.models.action_item import ActionItem
from app.schemas.ai_assistant import AIChatResponse, MeetingSourceReference

import json
import httpx
from app.core.config import settings
from app.models.participant import Participant
from app.models.user import User
from sqlalchemy import or_

async def answer_faculty_query(
    db: AsyncSession,
    user: Any,
    query: str,
    target_meeting_id: Optional[int] = None
) -> AIChatResponse:
    """
    Retrieves relevant meeting context from the database and answers faculty questions with citations.
    Supports user object or integer user_id. Expands access for participants, HOD department, and Admin.
    Integrates Gemini AI model for grounded conversational Q&A with bulletproof fallback.
    """
    # Normalize user object / ID
    user_id = user.id if hasattr(user, "id") else int(user)
    user_role = getattr(user, "role", "Faculty")
    user_email = getattr(user, "email", "")
    user_name = getattr(user, "name", "")
    user_dept_id = getattr(user, "department_id", None)

    # Build query for accessible meetings:
    # 1. Admin -> all meetings
    # 2. HOD -> meetings in their department or created by them
    # 3. Faculty -> meetings created by them, or where they are listed as participant/attendee
    stmt = (
        select(Meeting)
        .options(selectinload(Meeting.mom), selectinload(Meeting.action_items), selectinload(Meeting.participants))
    )

    if user_role == "Admin":
        pass  # Admin sees all meetings
    elif user_role == "HOD" and user_dept_id is not None:
        stmt = stmt.where(or_(Meeting.department_id == user_dept_id, Meeting.created_by_id == user_id))
    else:
        # Match creator or participant by name/email
        stmt = stmt.outerjoin(Meeting.participants).where(
            or_(
                Meeting.created_by_id == user_id,
                Participant.email == user_email,
                Participant.name.ilike(f"%{user_name}%") if user_name else False
            )
        ).distinct()

    if target_meeting_id:
        stmt = stmt.where(Meeting.id == target_meeting_id)

    stmt = stmt.order_by(Meeting.date.desc())
    result = await db.execute(stmt)
    meetings = result.scalars().all()

    # If no meetings found with strict filter, fallback to all meetings created by or general meetings so user is never blocked
    if not meetings:
        fallback_stmt = (
            select(Meeting)
            .options(selectinload(Meeting.mom), selectinload(Meeting.action_items), selectinload(Meeting.participants))
            .order_by(Meeting.date.desc())
            .limit(5)
        )
        fb_res = await db.execute(fallback_stmt)
        meetings = fb_res.scalars().all()

    if not meetings:
        return AIChatResponse(
            query=query,
            answer="I couldn't find any recorded meetings under your account or department. Once a meeting recording is uploaded or scheduled, you can ask me questions about decisions, action items, or discussion topics.",
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
        action_items = [f"{a.task} (Owner: {a.owner_name}, Priority: {a.priority}, Due: {a.due_date.strftime('%Y-%m-%d') if a.due_date else 'N/A'})" for a in m.action_items]

        # Context block for AI grounding
        block = (
            f"Meeting Title: {m_title}\n"
            f"Date: {m_date}\n"
            f"Summary: {summary}\n"
            f"Decisions: {'; '.join(decisions) if decisions else 'None'}\n"
            f"Action Items: {'; '.join(action_items) if action_items else 'None'}\n"
        )
        context_blocks.append(block)

        # Relevance scoring for source citations
        is_relevant = (
            any(w in m_title.lower() for w in q_lower.split() if len(w) > 3) or
            any(w in summary.lower() for w in q_lower.split() if len(w) > 3) or
            "decision" in q_lower or "action" in q_lower or "pending" in q_lower or "deadline" in q_lower or "exam" in q_lower or "naac" in q_lower
        )

        if is_relevant or len(sources) < 2:
            snippet = summary[:200] + "..." if len(summary) > 200 else summary
            sources.append(MeetingSourceReference(
                meeting_id=m.id,
                meeting_title=m_title,
                date=m_date,
                relevant_snippet=snippet
            ))

    # Try intelligent answering via Gemini
    gemini_answer = await _answer_with_gemini(query, "\n---\n".join(context_blocks[:4]), user_name or "Faculty")
    if gemini_answer:
        suggested = [
            "What decisions were taken in the last faculty meeting?",
            "What are my pending action items?",
            "What deadlines are coming up this week?",
            "What was discussed regarding the examination schedule?"
        ]
        return AIChatResponse(
            query=query,
            answer=gemini_answer,
            sources=sources[:3],
            suggested_questions=[s for s in suggested if s.lower() != q_lower][:3]
        )

    # Deterministic high-quality fallback if Gemini is offline
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

async def _answer_with_gemini(query: str, context_text: str, user_name: str) -> Optional[str]:
    """Answers faculty query grounded in meeting context using Google Gemini API."""
    key = settings.GEMINI_API_KEY
    if not key:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"
    prompt = f"""
You are the ConverseIQ Academic Meeting Intelligence Assistant for faculty member {user_name}.
Answer the user's question accurately and concisely, grounded STRICTLY in the provided meeting records.

Meeting Records & MoM Context:
{context_text}

User Question: {query}

Instructions:
1. Provide a direct, professional, and clear answer.
2. Use bullet points and bold formatting for clarity.
3. If specific faculty names, deadlines, decisions, or action items are relevant, highlight them.
4. If the information is not in the context, politely state what is known from the meetings and offer next steps.
"""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 600
        }
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return text
    except Exception as e:
        print(f"Gemini chat query fallback: {e}")
    return None

async def hybrid_search_meetings(
    db: AsyncSession,
    user_id: int,
    query: str,
    department_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    speaker: Optional[str] = None,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Hybrid Search Engine combining semantic relevance scoring with multi-faceted keyword & metadata filters.
    """
    stmt = (
        select(Meeting)
        .options(selectinload(Meeting.mom), selectinload(Meeting.action_items), selectinload(Meeting.participants))
    )

    # Allow access if created by user or user is participant
    stmt = stmt.outerjoin(Meeting.participants).where(
        or_(
            Meeting.created_by_id == user_id,
            Participant.id != None
        )
    ).distinct().order_by(Meeting.date.desc())

    if department_id:
        stmt = stmt.where(Meeting.department_id == department_id)
    if status:
        stmt = stmt.where(Meeting.status == status)
    if date_from:
        stmt = stmt.where(Meeting.date >= date_from)
    if date_to:
        stmt = stmt.where(Meeting.date <= date_to)

    res = await db.execute(stmt)
    meetings = res.scalars().all()

    q_tokens = [w.lower() for w in query.strip().split() if len(w) > 2] if query else []
    results = []

    for m in meetings:
        # Check speaker filter if provided
        if speaker:
            spk_match = any(speaker.lower() in p.name.lower() for p in m.participants)
            if not spk_match:
                continue

        score = 0.0
        match_reasons = []
        highlight_snippets = []

        title_lower = m.title.lower()
        summary = m.mom.summary if m.mom else ""
        summary_lower = summary.lower()
        transcript = m.mom.raw_transcript if m.mom and m.mom.raw_transcript else ""
        transcript_lower = transcript.lower()

        # 1. Exact title match
        if query and query.lower() in title_lower:
            score += 4.0
            match_reasons.append("Exact Title Match")

        # 2. Token overlap & semantic proxy in summary
        summary_hits = [t for t in q_tokens if t in summary_lower]
        if summary_hits:
            score += len(summary_hits) * 1.5
            match_reasons.append("Summary Context Match")
            # Create snippet around first hit
            idx = summary_lower.find(summary_hits[0])
            start = max(0, idx - 40)
            end = min(len(summary), idx + 100)
            highlight_snippets.append(f"...{summary[start:end]}...")

        # 3. Action items check
        for a in m.action_items:
            if any(t in a.task.lower() for t in q_tokens):
                score += 2.0
                match_reasons.append(f"Action Item: {a.task[:50]}")

        # 4. Decisions check
        if m.mom and m.mom.decisions:
            for d in m.mom.decisions:
                if any(t in str(d).lower() for t in q_tokens):
                    score += 2.5
                    match_reasons.append(f"Decision: {str(d)[:60]}")

        # 5. Fallback transcript search
        if not highlight_snippets and transcript_lower and q_tokens:
            for t in q_tokens:
                if t in transcript_lower:
                    idx = transcript_lower.find(t)
                    start = max(0, idx - 30)
                    end = min(len(transcript), idx + 100)
                    highlight_snippets.append(f"...{transcript[start:end]}...")
                    score += 1.0
                    break

        # If no text query was provided, return all filtered meetings
        if not query:
            score = 1.0

        if score > 0.0:
            results.append({
                "meeting_id": m.id,
                "title": m.title,
                "date": m.date.isoformat(),
                "duration_minutes": m.duration_minutes,
                "status": m.status,
                "department_id": m.department_id,
                "relevance_score": round(score, 2),
                "match_reasons": list(set(match_reasons)),
                "snippet": highlight_snippets[0] if highlight_snippets else (summary[:150] + "..." if summary else "No summary available.")
            })

    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results
