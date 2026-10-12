import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger("converseiq.email")

class EmailService:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("FROM_EMAIL", "notifications@converseiq.apsit.edu.in")
        self.sent_emails_log: List[Dict[str, Any]] = []

    def send_email_sync(self, to_email: str, subject: str, html_body: str, email_type: str = "general") -> bool:
        record = {
            "to": to_email,
            "subject": subject,
            "body": html_body,
            "type": email_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "QUEUED"
        }
        
        if not self.smtp_host or not self.smtp_user:
            record["status"] = "SENT_DEV_SIMULATED"
            self.sent_emails_log.append(record)
            logger.info(f"[EMAIL DEV SIMULATION] To: {to_email} | Subject: {subject}")
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"ConverseIQ Academic Governance <{self.from_email}>"
            msg["To"] = to_email

            part = MIMEText(html_body, "html")
            msg.attach(part)

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, msg.as_string())

            record["status"] = "SENT_SMTP"
            self.sent_emails_log.append(record)
            logger.info(f"[EMAIL DISPATCHED] To: {to_email} | Subject: {subject}")
            return True
        except Exception as e:
            record["status"] = f"ERROR: {str(e)}"
            self.sent_emails_log.append(record)
            logger.error(f"[EMAIL ERROR] Failed to send email to {to_email}: {e}")
            return False

    def send_meeting_invite(
        self,
        to_email: str,
        faculty_name: str,
        meeting_title: str,
        meeting_date: str,
        join_url: str,
        organizer_name: str = "HOD / Department Coordinator"
    ) -> bool:
        subject = f"Invitation: {meeting_title} - ConverseIQ Academic Meeting"
        html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
    <h2 style="color: #0f172a; margin-top: 0;">Academic Meeting Invitation</h2>
    <p>Dear {faculty_name},</p>
    <p>You have been formally invited to attend the following academic deliberation session:</p>
    <div style="background-color: #f1f5f9; padding: 14px; border-radius: 6px; margin: 16px 0;">
      <strong>Meeting:</strong> {meeting_title}<br>
      <strong>Date & Time:</strong> {meeting_date}<br>
      <strong>Convener:</strong> {organizer_name}
    </div>
    <p>Please click below to join the live studio. Attendance is tracked automatically:</p>
    <p><a href="{join_url}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold;">Join Live Meeting Studio</a></p>
    <p style="font-size: 12px; color: #64748b; margin-top: 24px;">ConverseIQ Governance Platform | APSIT, University of Mumbai</p>
  </div>
</body>
</html>"""
        return self.send_email_sync(to_email, subject, html_body, email_type="meeting_invite")

    def send_deadline_alert(
        self,
        to_email: str,
        faculty_name: str,
        task: str,
        meeting_title: str,
        due_date_str: str,
        tier: str = "T-24H"
    ) -> bool:
        if tier == "OVERDUE":
            subject = f"URGENT OVERDUE: Action Item '{task}' - ConverseIQ Governance"
            title_text = "Action Item Overdue Alert"
            color = "#dc2626"
        elif tier == "DAY_OF":
            subject = f"ACTION REQUIRED TODAY: '{task}' due at {due_date_str}"
            title_text = "Action Item Due Today"
            color = "#d97706"
        else:
            subject = f"Upcoming Deadline Reminder: '{task}' due in 24 Hours"
            title_text = "24-Hour Action Item Reminder"
            color = "#2563eb"

        html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-top: 4px solid {color}; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #0f172a; margin-top: 0;">{title_text}</h2>
    <p>Dear {faculty_name},</p>
    <p>This is an automated governance notification regarding your assigned deliverable:</p>
    <div style="background-color: #f8fafc; border-left: 3px solid {color}; padding: 12px; margin: 16px 0;">
      <strong>Deliverable:</strong> {task}<br>
      <strong>Meeting:</strong> {meeting_title}<br>
      <strong>Deadline:</strong> {due_date_str}
    </div>
    <p>Please update the task status upon completion in your ConverseIQ faculty dashboard.</p>
  </div>
</body>
</html>"""
        return self.send_email_sync(to_email, subject, html_body, email_type="deadline_alert")

email_service = EmailService()
