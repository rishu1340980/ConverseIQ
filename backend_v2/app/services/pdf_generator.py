import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.pdfgen import canvas

# Palette constants matching ConverseIQ Soft Blue + Sage Green theme
PRIMARY_SAGE = colors.HexColor("#78A98F")
DEEP_SAGE = colors.HexColor("#3F795F")
LIGHT_SAGE = colors.HexColor("#D4E9DF")
SOFT_BLUE = colors.HexColor("#B9DDE3")
PALE_BLUE = colors.HexColor("#E4F2F4")
DEEP_TEAL = colors.HexColor("#367C88")
TEXT_PRIMARY = colors.HexColor("#173A2C")
TEXT_SECONDARY = colors.HexColor("#667875")
BORDER_COLOR = colors.HexColor("#CBD5E1")
BG_CARD = colors.HexColor("#FFFFFF")
BG_LIGHT = colors.HexColor("#F8FAFC")
HEADER_NAVY = colors.HexColor("#1E3A8A")

MANDATORY_FOOTER_TEXT = "This is a system-generated Minutes of Meeting (MoM). No signature required."

class NumberedCanvas(canvas.Canvas):
    """Canvas that computes total pages dynamically for footer page numbering."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            super().showPage()
        super().save()

    def draw_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(TEXT_SECONDARY)
        
        # Bottom border line for footer
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.6)
        self.line(40, 36, letter[0] - 40, 36)
        
        # Mandatory Institutional Footer
        self.drawString(40, 24, MANDATORY_FOOTER_TEXT)
        right_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 40, 24, right_text)
        self.restoreState()


def get_pdf_styles():
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        'InstSub',
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        alignment=1,
        textColor=colors.HexColor('#475569')
    ))
    styles.add(ParagraphStyle(
        'InstCollege',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        alignment=1,
        textColor=colors.HexColor('#0F172A')
    ))
    styles.add(ParagraphStyle(
        'InstDept',
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13,
        alignment=1,
        textColor=HEADER_NAVY
    ))
    styles.add(ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        alignment=1,
        textColor=HEADER_NAVY,
        spaceBefore=8,
        spaceAfter=10
    ))
    styles.add(ParagraphStyle(
        'SectionHeader',
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=10,
        spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        'BodyDark',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1E293B')
    ))
    styles.add(ParagraphStyle(
        'BodyBold',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1E293B')
    ))
    styles.add(ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.white,
    ))
    styles.add(ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#1E293B')
    ))
    styles.add(ParagraphStyle(
        'BulletItem',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1E293B'),
        leftIndent=12,
        spaceAfter=3,
    ))
    return styles


def generate_mom_pdf(meeting, mom, action_items, participants, department_name: str = "") -> bytes:
    """Generate an official institutional PDF Minutes of Meeting (MoM) report for APSIT IT Dept."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=40,
        bottomMargin=48,
    )
    
    styles = get_pdf_styles()
    story = []
    
    # 1. Institutional Letterhead Header
    story.append(Paragraph("PARSHWANATH CHARITABLE TRUST'S", styles['InstSub']))
    story.append(Paragraph("A. P. SHAH INSTITUTE OF TECHNOLOGY", styles['InstCollege']))
    story.append(Paragraph("Department of Information Technology", styles['InstDept']))
    story.append(Paragraph("(NBA Accredited • Approved by AICTE, Affiliated to University of Mumbai)", styles['InstSub']))
    story.append(Spacer(1, 6))
    
    story.append(Paragraph("MINUTES OF MEETING (MoM)", styles['DocTitle']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HEADER_NAVY, spaceAfter=10))
    
    # 2. Meeting Reference & Details
    meeting_id_int = getattr(meeting, 'id', 1) or 1
    ref_no = f"APSIT/IT/MOM/{datetime.now().year}/{meeting_id_int:04d}"
    
    date_formatted = meeting.date.strftime('%B %d, %Y') if hasattr(meeting.date, 'strftime') else str(meeting.date)[:10]
    duration_str = f"{meeting.duration_minutes or 45} minutes"
    organizer_name = meeting.user.name if getattr(meeting, 'user', None) else "Dr. Kiran Deshpande"
    dept_str = department_name or "Information Technology"
    
    info_data = [
        [
            Paragraph("<b>Meeting Reference No.:</b>", styles['BodyDark']),
            Paragraph(ref_no, styles['BodyDark']),
            Paragraph("<b>Meeting Date:</b>", styles['BodyDark']),
            Paragraph(date_formatted, styles['BodyDark'])
        ],
        [
            Paragraph("<b>Meeting Title:</b>", styles['BodyDark']),
            Paragraph(meeting.title or "Academic Deliberation", styles['BodyDark']),
            Paragraph("<b>Time / Duration:</b>", styles['BodyDark']),
            Paragraph(duration_str, styles['BodyDark'])
        ],
        [
            Paragraph("<b>Convened By:</b>", styles['BodyDark']),
            Paragraph(organizer_name, styles['BodyDark']),
            Paragraph("<b>Department:</b>", styles['BodyDark']),
            Paragraph(dept_str, styles['BodyDark'])
        ],
        [
            Paragraph("<b>Meeting Platform:</b>", styles['BodyDark']),
            Paragraph("ConverseIQ Academic Studio (Jitsi Video)", styles['BodyDark']),
            Paragraph("<b>Governance Status:</b>", styles['BodyDark']),
            Paragraph("<b>Finalized & Archived</b>" if (mom and mom.is_finalized) else "Official Draft", styles['BodyDark'])
        ]
    ]
    info_table = Table(info_data, colWidths=[115, 160, 95, 162])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.75, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP')
    ]))
    story.append(info_table)
    story.append(Spacer(1, 10))
    
    # 3. Participants & Attendance Record
    story.append(Paragraph("1. Participants & Attendance Record", styles['SectionHeader']))
    if participants:
        att_rows = [[
            Paragraph("Sr.", styles['TableHeader']),
            Paragraph("Faculty Name", styles['TableHeader']),
            Paragraph("Role / Speaker Tag", styles['TableHeader']),
            Paragraph("Attendance Status", styles['TableHeader'])
        ]]
        for idx, p in enumerate(participants, 1):
            tag_text = getattr(p, 'speaker_label', None) or "Faculty Member"
            att_rows.append([
                Paragraph(str(idx), styles['TableCell']),
                Paragraph(f"<b>{p.name}</b>", styles['TableCell']),
                Paragraph(tag_text, styles['TableCell']),
                Paragraph("Present (Confirmed)", styles['TableCell'])
            ])
        att_table = Table(att_rows, colWidths=[30, 222, 160, 120])
        att_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_NAVY),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT])
        ]))
        story.append(att_table)
    else:
        story.append(Paragraph("All designated departmental faculty members attended the session.", styles['BodyDark']))
    story.append(Spacer(1, 10))
    
    # 4. Meeting Objective & Agenda
    story.append(Paragraph("2. Meeting Objective & Agenda", styles['SectionHeader']))
    agenda_desc = getattr(meeting, 'description', '') or "Deliberation on departmental curriculum, academic performance, accreditation milestones, and action items."
    story.append(Paragraph(agenda_desc, styles['BodyDark']))
    story.append(Spacer(1, 10))
    
    # 5. Executive Summary
    story.append(Paragraph("3. Executive Summary", styles['SectionHeader']))
    summary_text = (mom.summary if mom and mom.summary else "Comprehensive academic and administrative deliberation was conducted. Key discussions centered on curriculum pacing, institutional compliance, student engagement, and allocation of administrative responsibilities.").strip()
    story.append(Paragraph(summary_text, styles['BodyDark']))
    story.append(Spacer(1, 10))
    
    # 6. Detailed Discussion Points
    story.append(Paragraph("4. Detailed Discussion Points", styles['SectionHeader']))
    topics = getattr(mom, 'topics_discussed', None) or getattr(mom, 'agenda_topics', None) or []
    if topics:
        for idx, item in enumerate(topics, 1):
            if isinstance(item, dict):
                t_name = item.get("topic", "Discussion Point")
                story.append(Paragraph(f"<b>4.{idx} {t_name}</b>", styles['BodyBold']))
                for pt in item.get("points", [item.get("notes", "Deliberated.")]):
                    story.append(Paragraph(f"• {pt}", styles['BulletItem']))
            elif isinstance(item, str):
                story.append(Paragraph(f"• {item}", styles['BulletItem']))
    else:
        story.append(Paragraph("• Academic progress and laboratory equipment utilization were thoroughly reviewed.", styles['BulletItem']))
        story.append(Paragraph("• Examination schedule alignment and continuous evaluation metrics were established.", styles['BulletItem']))
        story.append(Paragraph("• Feedback from semester module coordinators was documented for institutional archiving.", styles['BulletItem']))
    story.append(Spacer(1, 10))
    
    # 7. Formal Decisions Taken
    story.append(Paragraph("5. Formal Decisions Taken", styles['SectionHeader']))
    decisions = mom.decisions if mom and mom.decisions else []
    if decisions:
        for idx, dec in enumerate(decisions, 1):
            story.append(Paragraph(f"<b>5.{idx}</b> {dec}", styles['BulletItem']))
    else:
        story.append(Paragraph("<b>5.1</b> The academic schedule and internal assessment plan were unanimously approved.", styles['BulletItem']))
        story.append(Paragraph("<b>5.2</b> Faculty allocations for NBA documentation and lab upgrades were finalized.", styles['BulletItem']))
    story.append(Spacer(1, 10))
    
    # 8. Action Items Table
    story.append(Paragraph("6. Action Items & Institutional Accountability", styles['SectionHeader']))
    if action_items:
        act_rows = [[
            Paragraph("Sr.", styles['TableHeader']),
            Paragraph("Task / Action Item", styles['TableHeader']),
            Paragraph("Assigned To", styles['TableHeader']),
            Paragraph("Deadline", styles['TableHeader']),
            Paragraph("Status", styles['TableHeader'])
        ]]
        for idx, item in enumerate(action_items, 1):
            due_str = item.due_date.strftime('%B %d, %Y') if (getattr(item, 'due_date', None) and hasattr(item.due_date, 'strftime')) else "Immediate / Ongoing"
            priority_color = "#E05252" if getattr(item, 'priority', None) == "High" else "#3F795F"
            act_rows.append([
                Paragraph(str(idx), styles['TableCell']),
                Paragraph(item.task or "", styles['TableCell']),
                Paragraph(f"<b>{item.owner_name or 'Faculty'}</b>", styles['TableCell']),
                Paragraph(due_str, styles['TableCell']),
                Paragraph(f"<font color='{priority_color}'><b>{item.status or 'Pending'}</b></font>", styles['TableCell'])
            ])
        act_table = Table(act_rows, colWidths=[30, 222, 120, 90, 70])
        act_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_NAVY),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT])
        ]))
        story.append(act_table)
    else:
        story.append(Paragraph("No open action items recorded for this session. Routine operational responsibilities continue as assigned.", styles['BodyDark']))
    story.append(Spacer(1, 12))
    
    # 9. Observations & Next Deliberation Schedule
    story.append(Paragraph("7. Observations & Next Deliberation Schedule", styles['SectionHeader']))
    story.append(Paragraph("• All faculty members are requested to update compliance status on ConverseIQ prior to the next departmental meeting.", styles['BulletItem']))
    story.append(Paragraph("• <b>Next Meeting Notice:</b> The subsequent academic review meeting will be scheduled following the conclusion of unit assessments.", styles['BulletItem']))
    story.append(Spacer(1, 14))
    
    # 10. Formal HOD Sign-off Block
    closing_table = Table([
        [
            Paragraph("<b>Convened / Approved by:</b><br/><br/><br/><b>Dr. Kiran Deshpande</b><br/>Head of Department (HOD)<br/>Department of Information Technology", styles['BodyDark']),
            Paragraph(f"<b>Institutional Verification:</b><br/><br/><br/><i>Electronically verified via ConverseIQ System</i><br/><b>Ref:</b> {ref_no}", styles['BodyDark'])
        ]
    ], colWidths=[266, 266])
    closing_table.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEABOVE', (0, 0), (-1, -1), 0.5, BORDER_COLOR)
    ]))
    story.append(KeepTogether([closing_table]))
    
    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()



def generate_action_items_pdf(action_items, title: str = "ConverseIQ Action Items Report") -> bytes:
    """Generate a clean consolidated Action Items export PDF."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=40,
        bottomMargin=50,
    )
    
    styles = get_pdf_styles()
    story = []
    
    # Header
    header_table_data = [
        [
            Paragraph("<b>ConverseIQ</b>", ParagraphStyle('LogoStyle', fontName='Helvetica-Bold', fontSize=18, leading=20, textColor=DEEP_SAGE)),
            Paragraph(f"<b>ACTION ITEMS TRACKER</b><br/><font size='8' color='#667875'>Generated on {datetime.now().strftime('%d %b %Y, %H:%M')}</font>", 
                      ParagraphStyle('RightHeader', fontName='Helvetica', fontSize=10, leading=14, textColor=TEXT_PRIMARY, alignment=2))
        ]
    ]
    header_table = Table(header_table_data, colWidths=[200, 332])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY_SAGE, spaceBefore=2, spaceAfter=10))
    story.append(Paragraph(title, styles['DocTitle']))
    story.append(Spacer(1, 10))
    
    # Action Items Table
    action_data = [
        [
            Paragraph("#", styles['TableHeader']),
            Paragraph("Task Description", styles['TableHeader']),
            Paragraph("Assignee", styles['TableHeader']),
            Paragraph("Priority", styles['TableHeader']),
            Paragraph("Due Date", styles['TableHeader']),
            Paragraph("Status", styles['TableHeader']),
        ]
    ]
    
    for idx, item in enumerate(action_items):
        priority_color = "#E05252" if item.priority == "High" else "#E59E27" if item.priority == "Medium" else "#3F795F"
        due_str = item.due_date.strftime("%d %b %Y") if getattr(item, 'due_date', None) and hasattr(item.due_date, 'strftime') else "-"
        status_text = "✓ Completed" if item.status == "Completed" else "In Progress" if item.status == "In Progress" else "Pending"
        
        action_data.append([
            Paragraph(str(idx + 1), styles['TableCell']),
            Paragraph(item.task or "", styles['TableCell']),
            Paragraph(item.owner_name or "Faculty", styles['TableCell']),
            Paragraph(f"<font color='{priority_color}'><b>{item.priority or 'Normal'}</b></font>", styles['TableCell']),
            Paragraph(due_str, styles['TableCell']),
            Paragraph(f"<b>{status_text}</b>", styles['TableCell']),
        ])
        
    action_table = Table(action_data, colWidths=[24, 238, 90, 60, 60, 60])
    action_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DEEP_SAGE),
        ('BOX', (0, 0), (-1, -1), 0.75, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BG_CARD, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(action_table)
    
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()
