import asyncio
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.core.config import settings
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.models.action_item import ActionItem
from backend_v2.app.models.mom import MinutesOfMeeting
from backend_v2.app.models.transcript import Utterance
from backend_v2.app.services.audit import log_audit_event

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


class ChatQueryRequest(BaseModel):
    query: str


class ChatQueryResponse(BaseModel):
    answer: str
    sources: Optional[List[Dict[str, Any]]] = []


async def _call_gemini_chat(prompt: str) -> Optional[str]:
    """Calls Google Gemini with the grounded institutional prompt."""
    key = settings.GEMINI_API_KEY
    if not key or not key.strip():
        return None

    candidate_models = [settings.GEMINI_MODEL, "gemini-2.5-flash", "gemini-flash-latest", "gemini-3.5-flash"]
    seen = set()
    models = [m for m in candidate_models if not (m in seen or seen.add(m))]

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1024,
        }
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            for attempt in range(2):
                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                return parts[0].get("text", "").strip()
                    elif resp.status_code in (503, 429):
                        await asyncio.sleep(1.0)
                    else:
                        break
                except Exception as e:
                    print(f"Gemini {model} query error: {e}")
                    await asyncio.sleep(0.5)

    return None


def _fallback_keyword_answer(query: str, meetings_data: List[Dict], actions_data: List[Dict]) -> str:
    """Keyword-based deterministic fallback if Gemini is offline."""
    q = query.lower()

    # Action items query
    if any(k in q for k in ["action", "task", "pending", "todo", "assigned", "responsible"]):
        if not actions_data:
            return "You currently have no recorded action items in the system."

        # Filter pending if requested
        items = actions_data
        if "pending" in q:
            items = [a for a in actions_data if a["status"] != "Completed"] or actions_data

        lines = ["Here are the relevant action items from your meetings:"]
        for it in items[:6]:
            due_str = f", Due: {it['due_date']}" if it['due_date'] else ""
            status_str = f" [{it['status']}]"
            lines.append(f"• **{it['task']}** — Assigned to: *{it['owner']}*{due_str} (Priority: {it['priority']}){status_str}")
        return "\n\n".join(lines)

    # Decision query
    if any(k in q for k in ["decision", "agreed", "resolution", "decided"]):
        all_decisions = []
        for m in meetings_data:
            for d in m.get("decisions", []):
                all_decisions.append(f"• **{d}** *(from meeting: '{m['title']}')*")
        if all_decisions:
            return "Here are the key decisions recorded in your department meetings:\n\n" + "\n".join(all_decisions[:8])
        else:
            return "No formal decisions were explicitly marked in your recorded meetings yet."

    # Meeting summary query
    if any(k in q for k in ["meeting", "summar", "discuss", "latest", "last"]):
        if not meetings_data:
            return "There are no recorded meetings in your department yet."
        latest = meetings_data[0]
        lines = [f"### Latest Meeting: {latest['title']} ({latest['date']})"]
        if latest.get("summary"):
            lines.append(f"**Summary:** {latest['summary']}")
        if latest.get("decisions"):
            lines.append("**Decisions Made:**\n" + "\n".join(f"• {d}" for d in latest["decisions"]))
        if latest.get("action_items"):
            lines.append("**Action Items:**\n" + "\n".join(f"• {a['task']} (*{a['owner']}*)" for a in latest["action_items"]))
        return "\n\n".join(lines)

    # Default general guidance
    return (
        f"I have analyzed {len(meetings_data)} meeting(s) and {len(actions_data)} action item(s) in your records. "
        "You can ask me about specific meeting summaries, decisions taken, pending tasks, or assigned responsibilities."
    )


@router.post("/chat", response_model=ChatQueryResponse)
async def chat_with_assistant(
    payload: ChatQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    RAG-powered AI Query Assistant.
    Retrieves real institutional meeting context and answers questions strictly grounded in facts.
    """
    query_text = payload.query.strip()
    if not query_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query cannot be empty.")

    # 1. Fetch relevant meetings based on user role & department
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.mom),
            selectinload(Meeting.action_items),
            selectinload(Meeting.participants),
            selectinload(Meeting.utterances),
        )
    )

    if current_user.role in ("HOD", "Faculty"):
        stmt = stmt.filter(Meeting.department_id == current_user.department_id)
    # Admin sees all

    stmt = stmt.order_by(Meeting.date.desc()).limit(15)
    result = await db.execute(stmt)
    meetings = result.scalars().all()

    # 2. Extract structured context
    meetings_context = []
    all_action_items = []
    sources = []

    for m in meetings:
        mom_summary = m.mom.summary if m.mom else ""
        mom_decisions = m.mom.decisions if (m.mom and m.mom.decisions) else []
        participants_names = [p.name for p in m.participants] if m.participants else []

        meeting_actions = []
        if m.action_items:
            for it in m.action_items:
                act_info = {
                    "task": it.task,
                    "owner": it.owner_name,
                    "priority": it.priority,
                    "status": it.status,
                    "due_date": it.due_date.strftime("%b %d, %Y") if it.due_date else None,
                    "meeting_title": m.title,
                }
                meeting_actions.append(act_info)
                all_action_items.append(act_info)

        # Recent key transcript excerpts (up to 6 utterances)
        transcript_snippet = ""
        if m.utterances:
            snippets = [f"{u.speaker_name or u.speaker_label or 'Speaker'}: {u.text}" for u in m.utterances[:8]]
            transcript_snippet = "\n".join(snippets)

        m_data = {
            "id": m.id,
            "title": m.title,
            "date": m.date.strftime("%b %d, %Y") if m.date else "Recently",
            "duration": f"{m.duration_minutes} mins",
            "status": m.status,
            "participants": participants_names,
            "summary": mom_summary,
            "decisions": mom_decisions,
            "action_items": meeting_actions,
            "transcript_snippet": transcript_snippet,
        }
        meetings_context.append(m_data)
        sources.append({"type": "meeting", "id": m.id, "title": m.title})

    # 3. Construct prompt for Gemini
    user_info_str = f"User: {current_user.name} ({current_user.role}, {current_user.designation})"
    dept_str = f"Department: {current_user.department.name if current_user.department else 'Academic Department'}"

    context_lines = [
        f"=== USER PROFILE ===",
        user_info_str,
        dept_str,
        "",
        f"=== RECORDED MEETINGS ({len(meetings_context)} meetings) ==="
    ]

    for idx, m in enumerate(meetings_context, 1):
        context_lines.append(f"Meeting {idx}: {m['title']}")
        context_lines.append(f"Date: {m['date']} | Duration: {m['duration']} | Status: {m['status']}")
        if m['participants']:
            context_lines.append(f"Attendees: {', '.join(m['participants'])}")
        if m['summary']:
            context_lines.append(f"Summary: {m['summary']}")
        if m['decisions']:
            context_lines.append(f"Decisions: {'; '.join(m['decisions'])}")
        if m['action_items']:
            act_strs = [f"{a['task']} (Assigned to: {a['owner']}, Status: {a['status']})" for a in m['action_items']]
            context_lines.append(f"Action Items: {'; '.join(act_strs)}")
        if m['transcript_snippet']:
            context_lines.append(f"Transcript Excerpt:\n{m['transcript_snippet']}")
        context_lines.append("---")

    context_lines.append(f"=== ALL ACTION ITEMS ({len(all_action_items)} items) ===")
    for idx, it in enumerate(all_action_items, 1):
        due = f", Due: {it['due_date']}" if it['due_date'] else ""
        context_lines.append(
            f"{idx}. {it['task']} | Owner: {it['owner']} | Priority: {it['priority']} | Status: {it['status']}{due} | From Meeting: '{it['meeting_title']}'"
        )

    context_block = "\n".join(context_lines)

    prompt = f"""
You are the ConverseIQ AI Query Assistant, an intelligent academic copilot for higher education institutions.
You have access to the user's recorded meetings, minutes of meeting (MoM), decisions, action items, and schedules.

User Query: "{query_text}"

Institutional Context:
{context_block}

INSTRUCTIONS:
1. Answer the query thoroughly, accurately, and factually based ONLY on the institutional context above.
2. If the user asks about action items, list the task, who is assigned, status, and deadline.
3. If the user asks about decisions, state the exact decisions and the meeting they occurred in.
4. If the user asks about summaries, provide a clear, concise bulleted breakdown.
5. If the information is NOT mentioned in the context, explicitly state:
   "Based on the recorded meetings and action items, there is no mention of [topic]."
   NEVER invent, assume, or hallucinate details.
6. Use clean, professional Markdown formatting with bold text, bullet points, and headers.
"""

    # 4. Attempt Gemini Call
    answer = await _call_gemini_chat(prompt)

    # 5. Fallback if Gemini unavailable
    if not answer:
        answer = _fallback_keyword_answer(query_text, meetings_context, all_action_items)

    await log_audit_event(
        db=db,
        action="AI_QUERY",
        details=f"User {current_user.name} asked: '{query_text[:80]}'",
        severity="Info",
        user_id=current_user.id,
        user_name=current_user.name,
        resource_type="ai",
    )

    return ChatQueryResponse(
        answer=answer,
        sources=sources[:5]
    )
