import os
import asyncio
import base64
import json
import mimetypes
import time
import httpx
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional
from backend_v2.app.core.config import settings

def _get_audio_mime_type(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    mapping = {
        ".mp3": "audio/mp3",
        ".wav": "audio/wav",
        ".m4a": "audio/m4a",
        ".ogg": "audio/ogg",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
        ".webm": "audio/webm"
    }
    return mapping.get(ext, mimetypes.guess_type(file_path)[0] or "audio/mp3")

async def transcribe_audio_with_diarization(
    audio_path: str,
    speaker_mapping: Optional[Dict[str, str]] = None,
    participants: Optional[List[str]] = None,
    meeting_title: Optional[str] = None
) -> Dict[str, Any]:
    """
    Transcribes audio with multi-speaker diarization and bilingual support.
    1. Primary engine: AssemblyAI (if ASSEMBLYAI_API_KEY is configured)
    2. Multimodal engine: Google Gemini 3.6 Flash (if audio is provided)
    3. Graceful fallback: Realistic academic dialogue attributed to invited participants.
    """
    mapping = speaker_mapping or {}
    faculty_roster = participants or []

    # 1. Primary Engine: AssemblyAI
    if settings.ASSEMBLYAI_API_KEY and settings.ASSEMBLYAI_API_KEY.strip():
        try:
            assembly_result = await _transcribe_with_assemblyai(audio_path, mapping)
            if assembly_result and assembly_result.get("text"):
                return assembly_result
        except Exception as e:
            print(f"AssemblyAI transcription error, falling back: {e}")

    # 2. Secondary Engine: Google Gemini 3.6 Flash Multimodal
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
        try:
            gemini_result = await _transcribe_with_gemini(audio_path, faculty_roster, mapping)
            if gemini_result and gemini_result.get("text"):
                return gemini_result
        except Exception as e:
            print(f"Gemini multimodal transcription error, falling back: {e}")

    # 3. If both engines fail, return empty — do NOT fabricate fake dialogue
    return {
        "text": "",
        "utterances": []
    }

async def _transcribe_with_assemblyai(audio_path: str, speaker_mapping: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """AssemblyAI multi-speaker diarization and transcription."""
    api_key = settings.ASSEMBLYAI_API_KEY
    headers = {"authorization": api_key}

    async with httpx.AsyncClient(timeout=60.0) as client:
        with open(audio_path, "rb") as f:
            upload_resp = await client.post("https://api.assemblyai.com/v2/upload", headers=headers, content=f.read())

        if upload_resp.status_code != 200:
            return None

        upload_url = upload_resp.json().get("upload_url")
        post_resp = await client.post(
            "https://api.assemblyai.com/v2/transcript",
            headers=headers,
            json={"audio_url": upload_url, "speaker_labels": True}
        )
        if post_resp.status_code not in (200, 201):
            return None

        transcript_id = post_resp.json().get("id")
        polling_url = f"https://api.assemblyai.com/v2/transcript/{transcript_id}"

        for _ in range(30):
            poll_resp = await client.get(polling_url, headers=headers)
            status_data = poll_resp.json()
            if status_data.get("status") == "completed":
                utterances = status_data.get("utterances", [])
                formatted = []
                for u in utterances:
                    raw_spk = f"Speaker {u.get('speaker', 'A')}"
                    real_spk = speaker_mapping.get(raw_spk, raw_spk)
                    ms = u.get("start", 0)
                    mins = int(ms // 60000)
                    secs = int((ms % 60000) // 1000)
                    ts = f"{mins:02d}:{secs:02d}"
                    formatted.append({
                        "speaker": real_spk,
                        "raw_speaker": raw_spk,
                        "text": u.get("text", ""),
                        "translation": u.get("text", ""),
                        "language": "English",
                        "timestamp": ts,
                    })
                return {
                    "text": status_data.get("text", ""),
                    "utterances": formatted
                }
            elif status_data.get("status") == "error":
                break
            time.sleep(2)

    return None

async def _transcribe_with_gemini(
    audio_path: str,
    participants: List[str],
    speaker_mapping: Dict[str, str]
) -> Optional[Dict[str, Any]]:
    """Calls Gemini 3.6 Flash for multi-speaker transcription & diarization."""
    key = settings.GEMINI_API_KEY
    if not key or not os.path.exists(audio_path):
        return None

    file_size = os.path.getsize(audio_path)
    mime_type = _get_audio_mime_type(audio_path)

    # For files under 15MB, use inlineData
    if file_size > 15 * 1024 * 1024:
        return None

    with open(audio_path, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")

    prompt = f"""
You are an expert bilingual academic meeting transcription and speaker diarization engine for ConverseIQ.
Analyze this audio recording of a university faculty meeting.
Invited Faculty Roster: {', '.join(participants)}

Instructions:
1. Transcribe the audio accurately.
2. Separate distinct speaker turns into utterances. Attribute them to the faculty names from the roster where possible.
3. For Hindi or Hinglish utterances, provide English translation.
4. Output strictly JSON with this schema:
{{
  "text": "Full concatenated transcript text",
  "utterances": [
    {{
      "speaker": "Faculty Name or Speaker A",
      "raw_speaker": "Speaker A",
      "text": "Spoken sentence",
      "translation": "English translation if applicable",
      "language": "English" | "Hindi" | "Hinglish",
      "timestamp": "00:00"
    }}
  ]
}}
Return ONLY raw JSON with no backticks.
"""

    payload = {
        "contents": [{
            "parts": [
                {"inlineData": {"mimeType": mime_type, "data": audio_b64}},
                {"text": prompt}
            ]
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1
        }
    }

    candidate_models = [settings.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.6-flash"]
    seen = set()
    models = [m for m in candidate_models if not (m in seen or seen.add(m))]

    async with httpx.AsyncClient(timeout=90.0) as client:
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            try:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                    return json.loads(raw)
                elif resp.status_code in (503, 429):
                    print(f"Transcription model {model} returned {resp.status_code}, trying fallback...")
                    await asyncio.sleep(1.0)
                else:
                    print(f"Transcription model {model} status {resp.status_code}")
            except Exception as e:
                print(f"Transcription model {model} error: {e}")

    return None




async def generate_mom_and_actions(
    transcript_text: str,
    participants: Optional[List[str]] = None,
    meeting_title: Optional[str] = None
) -> Dict[str, Any]:
    """
    Uses Google Gemini Pro (gemini-3.6-flash) for structured MoM extraction.
    Generates: summary, formal decisions, agenda topics, and action items with exact faculty owners.
    """
    roster = participants or []
    roster_str = ", ".join(roster) if roster else "Attendees identified from speech"

    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
        try:
            mom = await _generate_mom_with_gemini(transcript_text, roster, meeting_title)
            if mom and "summary" in mom:
                return mom
        except Exception as e:
            print(f"Gemini MoM generation error, falling back: {e}")

    return _fallback_mom(transcript_text, roster, meeting_title)

async def _generate_mom_with_gemini(
    transcript_text: str,
    participants: List[str],
    meeting_title: Optional[str] = None
) -> Dict[str, Any]:
    """Calls Google Gemini with strict grounding instructions for institutional MoM."""
    key = settings.GEMINI_API_KEY
    candidate_models = [settings.GEMINI_MODEL, "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.6-flash"]
    # De-duplicate while preserving order
    seen = set()
    models = [m for m in candidate_models if not (m in seen or seen.add(m))]

    roster_str = ", ".join(participants) if participants else "Attendees identified in audio"

    prompt = f"""
You are an expert academic meeting intelligence AI for ConverseIQ.
Analyze this meeting transcript and extract factual Minutes of Meeting (MoM).

Meeting Title: {meeting_title or "Recorded Meeting"}
Attendees: {roster_str}

Transcript:
{transcript_text}

CRITICAL ACCURACY & GROUNDING RULES:
1. ONLY include information that was EXPLICITLY spoken in the transcript.
2. SUMMARY: High-level factual summary of what was actually discussed.
3. DECISIONS: Concrete decisions actually agreed upon. IF NO DECISIONS WERE EXPLICITLY MADE, RETURN AN EMPTY LIST []. NEVER FABRICATE DECISIONS.
4. TOPICS DISCUSSED: Structured list of topics actually covered with key takeaways.
5. ACTION ITEMS: Concrete follow-up tasks explicitly assigned to someone.
   - IF NO ACTION ITEMS OR DELIVERABLES WERE EXPLICITLY ASSIGNED, RETURN AN EMPTY LIST [].
   - DO NOT invent speculative tasks, recommendations, or hypothetical responsibilities.
   - 'owner_name': Use the actual speaker's name from the conversation. If unassigned or unknown, do not fabricate a name.
   - 'priority': 'High', 'Medium', or 'Low'
   - 'days_until_due': Integer days until due date if specified, otherwise 3.
6. IF ANYTHING IS MISSING IN THE MEETING (no decisions, no action items), LEAVE IT MISSING ([]). DO NOT ADD EXTRA ASSUMPTIONS OR PLACEHOLDERS.

Output strictly valid JSON with this exact schema:
{{
  "summary": "Factual meeting summary string",
  "decisions": [
    "Decision string"
  ],
  "topics_discussed": [
    {{
      "topic": "Topic Name",
      "points": ["Takeaway 1"]
    }}
  ],
  "action_items": [
    {{
      "task": "Specific assigned task",
      "owner_name": "Actual speaker name",
      "priority": "High" | "Medium" | "Low",
      "days_until_due": 3
    }}
  ]
}}
Return ONLY raw JSON with no backticks.
"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1
        }
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            for attempt in range(2):
                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                        return json.loads(raw)
                    elif resp.status_code in (503, 429):
                        print(f"Gemini {model} returned {resp.status_code}, attempt {attempt+1}")
                        await asyncio.sleep(1.0)
                    else:
                        print(f"Gemini {model} failed with {resp.status_code}: {resp.text[:100]}")
                        break
                except Exception as e:
                    print(f"Gemini {model} call error: {e}")
                    await asyncio.sleep(0.5)

    return {}

def _fallback_mom(
    transcript_text: str,
    participants: List[str],
    meeting_title: Optional[str] = None
) -> Dict[str, Any]:
    """Fallback MoM structure without adding any fabricated decisions or action items."""
    title_str = meeting_title or "Recorded Session"

    return {
        "summary": f"Discussion recorded for '{title_str}'. Review the transcript for detailed spoken content.",
        "decisions": [],
        "topics_discussed": [
            {
                "topic": "Meeting Discussion",
                "points": ["Review transcript for complete discussion record."]
            }
        ],
        "action_items": []
    }
