import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select
from backend_v2.app.core.database import AsyncSessionLocal
from backend_v2.app.models.schedule_event import ScheduleEvent
from backend_v2.app.services.email_service import send_event_timed_reminder

async def check_and_send_due_reminders() -> int:
    """
    Scans active scheduled events for upcoming reminder milestones:
    1. 24-Hour Notice: Events starting in next 24 hours where reminder_24h_sent is False.
    2. 4-to-5 Hour Notice: Events starting in next 5 hours where reminder_4h_sent is False.
    
    Returns the total number of dispatched reminders.
    """
    now = datetime.now(timezone.utc)
    in_24h = now + timedelta(hours=24)
    in_5h = now + timedelta(hours=5)
    dispatched_count = 0

    async with AsyncSessionLocal() as db:
        try:
            # 1. Check 24-hour event reminders
            stmt_24h = select(ScheduleEvent).filter(
                ScheduleEvent.status == "Scheduled",
                ScheduleEvent.start_time >= now,
                ScheduleEvent.start_time <= in_24h,
                ScheduleEvent.reminder_24h_sent == False,
            )
            res_24h = await db.execute(stmt_24h)
            events_24h = res_24h.scalars().all()

            for ev in events_24h:
                try:
                    await send_event_timed_reminder(ev, timeframe="24h", db=db)
                    ev.reminder_24h_sent = True
                    ev.reminder_sent = (ev.reminder_sent or 0) + 1
                    ev.reminder_sent_at = now
                    await db.commit()
                    dispatched_count += 1
                    print(f"[Scheduler] 24h reminder dispatched for '{ev.title}' -> {ev.faculty_email}")
                except Exception as ex:
                    print(f"[Scheduler] Error sending 24h reminder for event {ev.id}: {ex}")

            # 2. Check 4-hour event reminders
            stmt_4h = select(ScheduleEvent).filter(
                ScheduleEvent.status == "Scheduled",
                ScheduleEvent.start_time >= now,
                ScheduleEvent.start_time <= in_5h,
                ScheduleEvent.reminder_4h_sent == False,
            )
            res_4h = await db.execute(stmt_4h)
            events_4h = res_4h.scalars().all()

            for ev in events_4h:
                try:
                    await send_event_timed_reminder(ev, timeframe="4h", db=db)
                    ev.reminder_4h_sent = True
                    ev.reminder_sent = (ev.reminder_sent or 0) + 1
                    ev.reminder_sent_at = now
                    await db.commit()
                    dispatched_count += 1
                    print(f"[Scheduler] 4h reminder dispatched for '{ev.title}' -> {ev.faculty_email}")
                except Exception as ex:
                    print(f"[Scheduler] Error sending 4h reminder for event {ev.id}: {ex}")

        except Exception as e:
            print(f"[Scheduler] check_and_send_due_reminders encountered error: {e}")

    return dispatched_count


async def reminder_scheduler_loop(interval_seconds: int = 300):
    """
    Continuous background loop that runs every 5 minutes (300 seconds).
    Started during FastAPI lifespan startup.
    """
    print(f"[Scheduler] Background Academic Reminder Worker active (polling interval: {interval_seconds}s)")
    while True:
        try:
            await check_and_send_due_reminders()
        except asyncio.CancelledError:
            print("[Scheduler] Reminder worker received cancel signal, terminating gracefully.")
            break
        except Exception as e:
            print(f"[Scheduler] Worker error: {e}")

        try:
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            print("[Scheduler] Sleep cancelled, terminating.")
            break
