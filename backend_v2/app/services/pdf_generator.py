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
BORDER_COLOR = colors.HexColor("#DCE7E2")
BG_CARD = colors.HexColor("#FFFFFF")
BG_LIGHT = colors.HexColor("#F5FAF8")

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
        
        # Subtle top border line for footer
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.5)
        self.line(40, 36, letter[0] - 40, 36)
        
        # Footer text
        left_text = "ConverseIQ Academic Intelligence Platform  |  Official Record"
        right_text = f"Page {self._pageNumber} of {page_count}"
        self.drawString(40, 24, left_text)
        self.drawRightString(letter[0] - 40, 24, right_text)
        self.restoreState()


def get_pdf_styles():
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=TEXT_PRIMARY,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        'DocSubtitle',
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=TEXT_SECONDARY,
    ))
    styles.add(ParagraphStyle(
        'SectionHeader',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=DEEP_SAGE,
        spaceBefore=14,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        'BodyDark',
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=TEXT_PRIMARY,
    ))
    styles.add(ParagraphStyle(
        'MetaLabel',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=TEXT_SECONDARY,
    ))
    styles.add(ParagraphStyle(
        'MetaValue',
        fontName='Helvetica',
        fontSize=9.5,
        leading=12,
        textColor=TEXT_PRIMARY,
    ))
    styles.add(ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    ))
    styles.add(ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=TEXT_PRIMARY,
    ))
    styles.add(ParagraphStyle(
        'TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=TEXT_PRIMARY,
    ))
    styles.add(ParagraphStyle(
        'BulletItem',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=TEXT_PRIMARY,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3,
    ))
    return styles


def generate_mom_pdf(meeting, mom, action_items, participants, department_name: str = "") -> bytes:
    """Generate a high-polish branded PDF for a meeting's Minutes of Meeting."""
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
    
    # 1. Header Banner Box
    header_table_data = [
        [
            Paragraph("<b>ConverseIQ</b>", ParagraphStyle('LogoStyle', fontName='Helvetica-Bold', fontSize=18, leading=20, textColor=DEEP_SAGE)),
            Paragraph(f"<b>MINUTES OF MEETING (MoM)</b><br/><font size='8' color='#667875'>Generated on {datetime.now().strftime('%d %b %Y, %H:%M')}</font>", 
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
    
    # 2. Meeting Title
    meeting_title = meeting.title or "Academic Meeting"
    story.append(Paragraph(meeting_title, styles['DocTitle']))
    
    # Format date string
    date_str = meeting.date.strftime("%A, %d %B %Y") if hasattr(meeting.date, 'strftime') else str(meeting.date)[:10]
    duration_str = f"{meeting.duration_minutes or 45} minutes"
    dept_str = department_name or (meeting.department.name if getattr(meeting, 'department', None) else "Academic Council")
    organizer_str = meeting.user.name if getattr(meeting, 'user', None) else "Department Faculty"
    status_str = meeting.status or "Completed"
    
    # 3. Metadata Grid (Boxed Card)
    meta_data = [
        [
            Paragraph("DATE & TIME", styles['MetaLabel']),
            Paragraph("DURATION", styles['MetaLabel']),
            Paragraph("DEPARTMENT", styles['MetaLabel']),
            Paragraph("ORGANIZER", styles['MetaLabel']),
        ],
        [
            Paragraph(date_str, styles['MetaValue']),
            Paragraph(duration_str, styles['MetaValue']),
            Paragraph(dept_str, styles['MetaValue']),
            Paragraph(organizer_str, styles['MetaValue']),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[150, 90, 150, 142])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.75, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))
    
    # 4. Attendees Section
    attendee_names = [p.name for p in participants] if participants else []
    if not attendee_names and getattr(meeting, 'user', None):
        attendee_names = [meeting.user.name]
    if not attendee_names:
        attendee_names = ["All Department Faculty Members"]
        
    story.append(Paragraph("PARTICIPANTS & ATTENDEES", styles['SectionHeader']))
    attendees_text = " • ".join(attendee_names)
    attendees_card = Table([[Paragraph(attendees_text, styles['BodyDark'])]], colWidths=[532])
    attendees_card.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), PALE_BLUE),
        ('BOX', (0,0), (-1,-1), 0.5, SOFT_BLUE),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(attendees_card)
    story.append(Spacer(1, 10))
    
    # 5. Executive Summary
    summary_text = (mom.summary if mom and mom.summary else "No executive summary available for this meeting session.").strip()
    story.append(Paragraph("EXECUTIVE SUMMARY", styles['SectionHeader']))
    summary_card = Table([[Paragraph(summary_text.replace('\n', '<br/>'), styles['BodyDark'])]], colWidths=[532])
    summary_card.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(summary_card)
    story.append(Spacer(1, 10))
    
    # 6. Key Decisions Taken
    decisions = mom.decisions if mom and mom.decisions else []
    if isinstance(decisions, list) and len(decisions) > 0:
        story.append(Paragraph("KEY DECISIONS TAKEN", styles['SectionHeader']))
        decision_items = []
        for d in decisions:
            decision_items.append([Paragraph(f"✓  {str(d)}", styles['BulletItem'])])
        dec_table = Table(decision_items, colWidths=[532])
        dec_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F2FAF5")),
            ('BOX', (0,0), (-1,-1), 0.5, LIGHT_SAGE),
            ('INNERGRID', (0,0), (-1,-1), 0.25, LIGHT_SAGE),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
        ]))
        story.append(dec_table)
        story.append(Spacer(1, 10))
        
    # 7. Agenda Topics (if any)
    agenda_topics = mom.agenda_topics if mom and mom.agenda_topics else []
    if isinstance(agenda_topics, list) and len(agenda_topics) > 0:
        story.append(Paragraph("AGENDA & DISCUSSION TOPICS", styles['SectionHeader']))
        agenda_data = [
            [Paragraph("Topic / Module", styles['TableHeader']), Paragraph("Discussion Details & Notes", styles['TableHeader'])]
        ]
        for idx, item in enumerate(agenda_topics):
            topic_title = item.get("topic", f"Topic {idx+1}") if isinstance(item, dict) else str(item)
            topic_notes = item.get("notes", "") if isinstance(item, dict) else ""
            agenda_data.append([
                Paragraph(f"<b>{topic_title}</b>", styles['TableCellBold']),
                Paragraph(topic_notes or "Discussed and noted.", styles['TableCell'])
            ])
        agenda_table = Table(agenda_data, colWidths=[180, 352])
        agenda_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), DEEP_TEAL),
            ('BACKGROUND', (0, 1), (-1, -1), BG_CARD),
            ('BOX', (0, 0), (-1, -1), 0.75, BORDER_COLOR),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(agenda_table)
        story.append(Spacer(1, 10))

    # 8. Action Items Table
    story.append(KeepTogether([
        Paragraph("ACTION ITEMS & STRATEGIC TASKS", styles['SectionHeader']),
        HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceBefore=0, spaceAfter=6)
    ]))
    
    if action_items:
        action_data = [
            [
                Paragraph("#", styles['TableHeader']),
                Paragraph("Task Description", styles['TableHeader']),
                Paragraph("Assignee", styles['TableHeader']),
                Paragraph("Priority", styles['TableHeader']),
                Paragraph("Status", styles['TableHeader']),
            ]
        ]
        
        for idx, item in enumerate(action_items):
            priority_color = "#E05252" if item.priority == "High" else "#E59E27" if item.priority == "Medium" else "#3F795F"
            status_text = "Completed" if item.status == "Completed" else "In Progress" if item.status == "In Progress" else "Pending"
            
            action_data.append([
                Paragraph(str(idx + 1), styles['TableCell']),
                Paragraph(item.task or "", styles['TableCell']),
                Paragraph(item.owner_name or "Faculty", styles['TableCell']),
                Paragraph(f"<font color='{priority_color}'><b>{item.priority or 'Normal'}</b></font>", styles['TableCell']),
                Paragraph(f"<b>{status_text}</b>", styles['TableCell']),
            ])
            
        action_table = Table(action_data, colWidths=[24, 258, 110, 70, 70])
        action_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), DEEP_SAGE),
            ('BOX', (0, 0), (-1, -1), 0.75, BORDER_COLOR),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BG_CARD, BG_LIGHT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(action_table)
    else:
        no_actions = Table([[Paragraph("<i>No action items recorded for this session.</i>", styles['BodyDark'])]], colWidths=[532])
        no_actions.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
            ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('PADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(no_actions)
        
    story.append(Spacer(1, 20))
    
    # 9. Sign-off / Verification Box
    signoff_data = [
        [
            Paragraph("<b>Prepared By:</b><br/>AI Meeting Assistant (ConverseIQ)", styles['TableCell']),
            Paragraph("<b>Verified By:</b><br/>" + organizer_str, styles['TableCell']),
            Paragraph("<b>Approved By:</b><br/>Head of Department (HOD)", styles['TableCell']),
        ]
    ]
    signoff_table = Table(signoff_data, colWidths=[177, 177, 178])
    signoff_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('PADDING', (0,0), (-1,-1), 8),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(signoff_table)
    
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
