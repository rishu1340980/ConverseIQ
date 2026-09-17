import pytest
from datetime import datetime, timezone
from app.services.transcription import _get_simulated_bilingual_transcription, transcribe_audio_with_diarization
from app.services.llm_analysis import generate_mom_and_actions
from app.models.meeting import Meeting
from app.models.mom import MinutesOfMeeting
from app.models.action_item import ActionItem
from app.models.participant import Participant
from app.services.exporter import generate_mom_pdf, generate_mom_docx

def test_bilingual_diarization_structure():
    roster = ["Prof. Mehta", "Dr. Ananya Sharma", "Prof. Kavya Rao"]
    mapping = {}
    data = _get_simulated_bilingual_transcription(roster, mapping)
    
    assert "text" in data
    assert "utterances" in data
    assert len(data["utterances"]) >= 4
    
    # Check language differentiation
    languages = [u.get("language") for u in data["utterances"]]
    assert any(lang in ["Hindi", "Hinglish"] for lang in languages)
    
    # Check automatic faculty speaker attribution (No 'Speaker A')
    speakers = [u.get("speaker") for u in data["utterances"]]
    for spk in speakers:
        assert spk in roster
        assert not spk.startswith("Speaker ")

    # Check translations exist for Hindi/Hinglish
    for u in data["utterances"]:
        if u.get("language") in ["Hindi", "Hinglish"]:
            assert "translation" in u
            assert len(u["translation"]) > 0

@pytest.mark.asyncio
async def test_llm_mom_and_action_item_extraction():
    transcript = """
Dr. Ananya Sharma: Good morning everyone. Aaj hum computer science department ke semester exam dates par baat karenge.
Prof. Kavya Rao: I will coordinate with the central scheduling committee to book Tuesday and Thursday morning lab slots by this Friday.
Prof. Mehta: Excellent. Dr. Sharma, please prepare the syllabus completion review report by Wednesday.
Dr. Ananya Sharma: Yes Prof. Mehta, I will submit the report by Wednesday afternoon.
"""
    roster = ["Dr. Ananya Sharma", "Prof. Kavya Rao", "Prof. Mehta"]
    result = await generate_mom_and_actions(transcript, roster)
    
    assert "summary" in result and len(result["summary"]) > 0
    assert "decisions" in result and isinstance(result["decisions"], list)
    assert len(result["decisions"]) > 0
    assert "action_items" in result and isinstance(result["action_items"], list)
    assert len(result["action_items"]) > 0

    # Ensure assigned faculty names match real names from roster
    for item in result["action_items"]:
        assert item["owner_name"] in roster or "Sharma" in item["owner_name"] or "Rao" in item["owner_name"]
        assert item["priority"] in ["High", "Medium", "Low"]

def test_pdf_and_docx_export_with_decisions_and_actions():
    meeting = Meeting(
        id=99,
        title="Department Academic Council",
        date=datetime.now(timezone.utc),
        duration_minutes=45,
        status="Completed"
    )
    meeting.participants = [
        Participant(name="Dr. Ananya Sharma", speaker_label="Speaker A"),
        Participant(name="Prof. Kavya Rao", speaker_label="Speaker B")
    ]
    mom = MinutesOfMeeting(
        meeting_id=99,
        summary="Discussion on exam slots and accreditation deliverables.",
        decisions=["Approved Tuesday and Thursday extra lab examination slots."],
        topics_discussed=[{"topic": "Midterm Timetable", "points": ["Slots finalized", "Scheduling committee engaged"]}],
        raw_transcript="Full bilingual transcript",
        utterances=[
            {
                "speaker": "Dr. Ananya Sharma",
                "text": "Aaj hum timetable finalize karenge.",
                "translation": "Today we will finalize the timetable.",
                "language": "Hindi"
            }
        ],
        is_finalized=True
    )
    action_items = [
        ActionItem(
            meeting_id=99,
            task="Submit syllabus report",
            owner_name="Dr. Ananya Sharma",
            priority="High",
            status="Pending"
        )
    ]

    pdf_buffer = generate_mom_pdf(meeting, mom, action_items)
    pdf_bytes = pdf_buffer.getvalue()
    assert pdf_bytes.startswith(b"%PDF")

    docx_buffer = generate_mom_docx(meeting, mom, action_items)
    docx_bytes = docx_buffer.getvalue()
    assert len(docx_bytes) > 500
