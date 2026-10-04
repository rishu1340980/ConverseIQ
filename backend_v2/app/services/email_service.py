import smtplib
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend_v2.app.core.config import settings
from backend_v2.app.models.notification_log import NotificationLog

def format_ist_datetime(dt: Optional[datetime]) -> str:
    """Formats datetime string for Indian Standard Time display."""
    if not dt:
        return "N/A"
    return dt.strftime("%A, %d %B %Y at %I:%M %p")

async def send_email_notification(
    recipient_email: str,
    recipient_name: str,
    subject: str,
    html_body: str,
    text_body: str,
    notification_type: str,
    db: Optional[AsyncSession] = None,
    event_id: Optional[int] = None,
    action_item_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Sends email via SMTP if credentials are configured.
    Falls back gracefully to simulated delivery with persistent audit logging so workflows never fail.
    """
    delivery_status = "Simulated"
    error_message = None

    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            def _sync_send():
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = settings.SMTP_FROM
                msg["To"] = recipient_email
                msg.attach(MIMEText(text_body, "plain"))
                msg.attach(MIMEText(html_body, "html"))

                if settings.SMTP_PORT == 465:
                    server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
                else:
                    server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
                    if settings.SMTP_TLS:
                        server.starttls()

                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, [recipient_email], msg.as_string())
                server.quit()

            await asyncio.to_thread(_sync_send)
            delivery_status = "Delivered"
            print(f"Email delivered successfully to {recipient_email}: '{subject}'")
        except Exception as e:
            error_message = str(e)
            print(f"SMTP delivery notice (switching to simulated mode): {e}")
            delivery_status = "Simulated"
    else:
        print(f"[Email Simulation] To: {recipient_name} <{recipient_email}> | Subject: {subject}")

    # Persist delivery history if DB session is provided
    if db:
        try:
            log_entry = NotificationLog(
                recipient_email=recipient_email,
                recipient_name=recipient_name,
                subject=subject,
                notification_type=notification_type,
                status=delivery_status,
                event_id=event_id,
                action_item_id=action_item_id,
                details=f"Status: {delivery_status}. Error if any: {error_message}"
            )
            db.add(log_entry)
            await db.commit()
        except Exception as db_err:
            print(f"Notification log persistence warning: {db_err}")

    return {
        "status": delivery_status,
        "recipient": recipient_email,
        "subject": subject,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "error": error_message
    }


async def send_event_invitation(
    event: Any,
    db: Optional[AsyncSession] = None,
    custom_recipient_email: Optional[str] = None,
    custom_recipient_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Sends institutional academic event invitation to assigned faculty."""
    rec_email = custom_recipient_email or event.faculty_email
    rec_name = custom_recipient_name or event.faculty_name or "Faculty Member"
    time_str = format_ist_datetime(event.start_time)
    
    subject = f"[ConverseIQ Academic Notice] {event.title} ({event.academic_year})"
    
    venue_info = event.venue_or_link or "ConverseIQ Studio"
    is_online = "meet.jit" in venue_info or "http" in venue_info

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F5FAF8; color: #173A2C; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #DCE7E2; overflow: hidden; }}
        .header {{ background: #173A2C; padding: 24px; color: #ffffff; text-align: left; }}
        .header h1 {{ margin: 0; font-size: 20px; letter-spacing: -0.5px; }}
        .header p {{ margin: 4px 0 0 0; font-size: 13px; color: #78A98F; }}
        .content {{ padding: 24px; }}
        .badge {{ display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; background: #E4F2F4; color: #367C88; margin-right: 6px; }}
        .year-badge {{ display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; background: #D4E9DF; color: #173A2C; }}
        .meta-box {{ background: #F5FAF8; border: 1px solid #DCE7E2; border-radius: 12px; padding: 16px; margin: 16px 0; }}
        .meta-row {{ margin-bottom: 8px; font-size: 13px; }}
        .meta-row:last-child {{ margin-bottom: 0; }}
        .meta-label {{ font-weight: bold; color: #667875; width: 120px; display: inline-block; }}
        .btn {{ display: inline-block; padding: 10px 20px; background: #3F795F; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; margin-top: 12px; }}
        .footer {{ padding: 16px 24px; background: #F5FAF8; border-top: 1px solid #DCE7E2; font-size: 11px; color: #667875; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ConverseIQ Academic Scheduling</h1>
          <p>Institutional Academic Session &amp; Faculty Delegation</p>
        </div>
        <div class="content">
          <p style="font-size: 15px; margin-top: 0;">Dear <strong>{rec_name}</strong>,</p>
          <p style="font-size: 13px; line-height: 1.5; color: #33443F;">
            You have been scheduled to conduct or attend an academic session delegated by the Department.
          </p>
          
          <div style="margin: 12px 0;">
            <span class="year-badge">{event.academic_year}</span>
            <span class="badge">{event.domain}</span>
            <span class="badge">{event.event_type}</span>
          </div>

          <div class="meta-box">
            <div class="meta-row"><span class="meta-label">Session Title:</span> <strong>{event.title}</strong></div>
            <div class="meta-row"><span class="meta-label">Target Batch:</span> {event.target_batch or "All Department Students"}</div>
            <div class="meta-row"><span class="meta-label">Date &amp; Time:</span> {time_str}</div>
            <div class="meta-row"><span class="meta-label">Duration:</span> {event.duration_minutes} Minutes</div>
            <div class="meta-row"><span class="meta-label">Mode / Venue:</span> {event.delivery_mode} ({venue_info})</div>
            <div class="meta-row"><span class="meta-label">Assigned By:</span> {event.created_by_role}</div>
          </div>

          {f'<p style="font-size: 13px; color: #4A5B55;"><strong>Agenda &amp; Objectives:</strong><br>{event.description}</p>' if event.description else ''}

          {f'<a href="{venue_info}" class="btn">Join Virtual Session Link</a>' if is_online else ''}
          <a href="https://converse-iq.vercel.app/schedule" class="btn" style="background: #173A2C; margin-left: 6px;">View in ConverseIQ Calendar</a>
        </div>
        <div class="footer">
          ConverseIQ Meeting Intelligence &amp; Academic Orchestration Platform &bull; Powered by Google DeepMind Technologies
        </div>
      </div>
    </body>
    </html>
    """

    text = f"""ConverseIQ Academic Notice: {event.title}
Dear {rec_name},

You have been scheduled for the following academic session:
- Title: {event.title}
- Academic Year: {event.academic_year}
- Target Batch: {event.target_batch or 'All Department Students'}
- Domain: {event.domain}
- Date & Time: {time_str}
- Duration: {event.duration_minutes} mins
- Mode / Venue: {event.delivery_mode} ({venue_info})
- Assigned By: {event.created_by_role}

Agenda:
{event.description or 'No specific agenda description provided.'}

View on calendar: https://converse-iq.vercel.app/schedule
"""

    return await send_email_notification(
        recipient_email=rec_email,
        recipient_name=rec_name,
        subject=subject,
        html_body=html,
        text_body=text,
        notification_type="Event_Invitation",
        db=db,
        event_id=getattr(event, "id", None),
    )


async def send_hod_task_assignment(
    action_item: Any,
    db: Optional[AsyncSession] = None,
    recipient_email: Optional[str] = None,
    recipient_name: Optional[str] = None,
    hod_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Dispatches formal email when HOD assigns an academic task/action item to a faculty member."""
    rec_email = recipient_email or "faculty@converseiq.edu"
    rec_name = recipient_name or action_item.owner_name or "Faculty Member"
    due_str = format_ist_datetime(action_item.due_date)
    hod_display = hod_name or action_item.assigned_by_name or "Head of Department (HOD)"
    year_badge = action_item.academic_year or "Departmental"

    subject = f"[ConverseIQ HOD Assignment] Priority: {action_item.priority} - {action_item.task[:50]}"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F5FAF8; color: #173A2C; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #DCE7E2; overflow: hidden; }}
        .header {{ background: #173A2C; padding: 24px; color: #ffffff; text-align: left; }}
        .header h1 {{ margin: 0; font-size: 20px; }}
        .content {{ padding: 24px; }}
        .meta-box {{ background: #F5FAF8; border: 1px solid #DCE7E2; border-radius: 12px; padding: 16px; margin: 16px 0; }}
        .meta-row {{ margin-bottom: 8px; font-size: 13px; }}
        .meta-label {{ font-weight: bold; color: #667875; width: 120px; display: inline-block; }}
        .btn {{ display: inline-block; padding: 10px 20px; background: #3F795F; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; }}
        .footer {{ padding: 16px 24px; background: #F5FAF8; border-top: 1px solid #DCE7E2; font-size: 11px; color: #667875; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>HOD Academic Task Assignment</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #78A98F;">Official Notice from Head of Department</p>
        </div>
        <div class="content">
          <p style="font-size: 15px; margin-top: 0;">Dear <strong>{rec_name}</strong>,</p>
          <p style="font-size: 13px; line-height: 1.5; color: #33443F;">
            You have received an academic task assignment from <strong>{hod_display}</strong>.
          </p>

          <div class="meta-box">
            <div class="meta-row"><span class="meta-label">Task:</span> <strong>{action_item.task}</strong></div>
            <div class="meta-row"><span class="meta-label">Target Year:</span> {year_badge}</div>
            <div class="meta-row"><span class="meta-label">Priority:</span> <strong style="color: {'#C53030' if action_item.priority == 'High' or action_item.priority == 'Urgent' else '#2C7A7B'};">{action_item.priority}</strong></div>
            <div class="meta-row"><span class="meta-label">Due Date:</span> {due_str}</div>
            <div class="meta-row"><span class="meta-label">Current Status:</span> {action_item.status}</div>
          </div>

          <a href="https://converse-iq.vercel.app/action-items" class="btn">View &amp; Update Action Item</a>
        </div>
        <div class="footer">
          ConverseIQ Department Intelligence System &bull; Automatic Notification
        </div>
      </div>
    </body>
    </html>
    """

    text = f"""HOD Task Assignment:
Dear {rec_name},

You have received an academic task assigned by {hod_display}:
Task: {action_item.task}
Academic Year: {year_badge}
Priority: {action_item.priority}
Deadline: {due_str}

Please update your progress at: https://converse-iq.vercel.app/action-items
"""

    return await send_email_notification(
        recipient_email=rec_email,
        recipient_name=rec_name,
        subject=subject,
        html_body=html,
        text_body=text,
        notification_type="HOD_Task_Assignment",
        db=db,
        action_item_id=getattr(action_item, "id", None),
    )
