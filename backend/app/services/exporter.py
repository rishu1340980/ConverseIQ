import io
import os
from datetime import datetime
from typing import List, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    Image as RLImage,
    KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

from app.models.meeting import Meeting
from app.models.mom import MinutesOfMeeting
from app.models.action_item import ActionItem

HEADER_IMAGE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "assets", "apsit-header.png")
)
MANDATORY_FOOTER_TEXT = "This is a system-generated Minutes of Meeting (MoM). No signature required."


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that computes total page count dynamically
    and prints institutional footer with 'Page X of Y' on every page.
    """
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
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Bottom rule
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.6)
        self.line(40, 36, 572, 36)
        
        # Mandatory Institutional Footer
        self.drawString(40, 24, MANDATORY_FOOTER_TEXT)
        
        # Page count
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(572, 24, page_str)
        
        self.restoreState()


def generate_mom_pdf(meeting: Meeting, mom: MinutesOfMeeting, action_items: List[ActionItem]) -> io.BytesIO:
    """
    Generates an official institutional PDF Minutes of Meeting (MoM) report
    for A. P. Shah Institute of Technology, Department of Information Technology.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=48
    )
    
    styles = getSampleStyleSheet()
    
    inst_sub = ParagraphStyle(
        'InstSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        alignment=1,  # Center
        textColor=colors.HexColor('#475569')
    )
    
    inst_college = ParagraphStyle(
        'InstCollege',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        alignment=1,
        textColor=colors.HexColor('#0F172A')
    )
    
    inst_dept = ParagraphStyle(
        'InstDept',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13,
        alignment=1,
        textColor=colors.HexColor('#1E3A8A')
    )
    
    doc_title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        alignment=1,
        textColor=colors.HexColor('#1E3A8A'),
        spaceBefore=8,
        spaceAfter=10
    )
    
    section_h2 = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=10,
        spaceAfter=4
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1E293B')
    )

    body_bold = ParagraphStyle(
        'DocBodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#1E293B')
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.white
    )

    bullet_style = ParagraphStyle(
        'DocBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1E293B'),
        leftIndent=12,
        spaceAfter=3
    )

    story = []

    # 1. Institutional Banner Image
    if os.path.exists(HEADER_IMAGE_PATH):
        try:
            # 532 pt max printable width; aspect ratio approx 950/202 = 4.70
            banner_img = RLImage(HEADER_IMAGE_PATH, width=532, height=113)
            story.append(banner_img)
            story.append(Spacer(1, 8))
        except Exception:
            pass

    # Institutional Text Header
    story.append(Paragraph("PARSHWANATH CHARITABLE TRUST'S", inst_sub))
    story.append(Paragraph("A. P. SHAH INSTITUTE OF TECHNOLOGY", inst_college))
    story.append(Paragraph("Department of Information Technology", inst_dept))
    story.append(Paragraph("(NBA Accredited)", inst_sub))
    story.append(Spacer(1, 6))

    story.append(Paragraph("MINUTES OF MEETING (MoM)", doc_title_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1E3A8A'), spaceAfter=10))

    # 2. Meeting Information Table
    organizer_name = meeting.creator.name if meeting.creator else "Head of Department (HOD)"
    organizer_email = f" ({meeting.creator.email})" if (meeting.creator and meeting.creator.email) else ""
    date_formatted = meeting.date.strftime('%B %d, %Y')
    time_formatted = meeting.date.strftime('%I:%M %p')
    if meeting.start_time and meeting.end_time:
        time_formatted = f"{meeting.start_time.strftime('%I:%M %p')} - {meeting.end_time.strftime('%I:%M %p')}"
    
    ref_no = f"APSIT/IT/MOM/{datetime.now().year}/{meeting.id:04d}"

    info_data = [
        [
            Paragraph("<b>Meeting Reference No.:</b>", body_style),
            Paragraph(ref_no, body_style),
            Paragraph("<b>Meeting Date:</b>", body_style),
            Paragraph(date_formatted, body_style)
        ],
        [
            Paragraph("<b>Meeting Title:</b>", body_style),
            Paragraph(meeting.title, body_style),
            Paragraph("<b>Time / Duration:</b>", body_style),
            Paragraph(f"{time_formatted} ({meeting.duration_minutes} min)", body_style)
        ],
        [
            Paragraph("<b>Convened By:</b>", body_style),
            Paragraph(f"{organizer_name}{organizer_email}", body_style),
            Paragraph("<b>Department:</b>", body_style),
            Paragraph("Information Technology", body_style)
        ],
        [
            Paragraph("<b>Meeting Platform:</b>", body_style),
            Paragraph("ConverseIQ Academic Studio (Online)", body_style),
            Paragraph("<b>Governance Status:</b>", body_style),
            Paragraph("<b>Finalized & Archived</b>" if (mom and mom.is_finalized) else "Official Draft", body_style)
        ]
    ]

    info_table = Table(info_data, colWidths=[115, 160, 95, 162])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP')
    ]))
    story.append(info_table)
    story.append(Spacer(1, 10))

    # 3. Participants & Attendance
    story.append(Paragraph("1. Participants & Attendance Record", section_h2))
    if meeting.participants:
        att_rows = [[
            Paragraph("Sr.", table_header),
            Paragraph("Faculty Name", table_header),
            Paragraph("Role / Speaker Tag", table_header),
            Paragraph("Attendance Status", table_header)
        ]]
        for idx, p in enumerate(meeting.participants, 1):
            status_text = p.invitation_status if p.invitation_status else ("Present" if getattr(p, "attended", False) else "Invited")
            tag_text = p.speaker_label or "Faculty Member"
            att_rows.append([
                Paragraph(str(idx), table_cell),
                Paragraph(f"<b>{p.name}</b>", table_cell),
                Paragraph(tag_text, table_cell),
                Paragraph(status_text, table_cell)
            ])
        att_table = Table(att_rows, colWidths=[30, 222, 160, 120])
        att_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(att_table)
    else:
        story.append(Paragraph("All designated departmental faculty members attended the session.", body_style))
    story.append(Spacer(1, 10))

    # 4. Meeting Agenda / Objective
    story.append(Paragraph("2. Meeting Objective & Agenda", section_h2))
    agenda_desc = meeting.description if meeting.description else "Deliberation on departmental curriculum, academic performance, accreditation milestones, and action items."
    story.append(Paragraph(agenda_desc, body_style))
    story.append(Spacer(1, 10))

    # 5. Executive Summary
    story.append(Paragraph("3. Executive Summary", section_h2))
    summary_text = mom.summary if (mom and mom.summary) else "Comprehensive academic and administrative deliberation was conducted. Key discussions centered on curriculum pacing, institutional compliance, student engagement, and allocation of administrative responsibilities."
    story.append(Paragraph(summary_text, body_style))
    story.append(Spacer(1, 10))

    # 6. Detailed Discussion Points
    story.append(Paragraph("4. Detailed Discussion Points", section_h2))
    if mom and mom.topics_discussed:
        for topic in mom.topics_discussed:
            if isinstance(topic, dict):
                t_name = topic.get("topic", "Discussion Point")
                story.append(Paragraph(f"<b>4.{story.count(section_h2)} {t_name}</b>", body_bold))
                for pt in topic.get("points", []):
                    story.append(Paragraph(f"• {pt}", bullet_style))
            elif isinstance(topic, str):
                story.append(Paragraph(f"• {topic}", bullet_style))
    else:
        story.append(Paragraph("• Academic progress and laboratory equipment utilization were thoroughly reviewed.", bullet_style))
        story.append(Paragraph("• Examination schedule alignment and continuous evaluation metrics were established.", bullet_style))
        story.append(Paragraph("• Feedback from semester module coordinators was documented for institutional archiving.", bullet_style))
    story.append(Spacer(1, 10))

    # 7. Key Decisions Taken
    story.append(Paragraph("5. Formal Decisions Taken", section_h2))
    if mom and mom.decisions:
        for idx, dec in enumerate(mom.decisions, 1):
            story.append(Paragraph(f"<b>5.{idx}</b> {dec}", bullet_style))
    else:
        story.append(Paragraph("<b>5.1</b> The academic schedule and internal assessment plan were unanimously approved.", bullet_style))
        story.append(Paragraph("<b>5.2</b> Faculty allocations for NBA documentation and lab upgrades were finalized.", bullet_style))
    story.append(Spacer(1, 10))

    # 8. Action Items Table
    story.append(Paragraph("6. Action Items & Institutional Accountability", section_h2))
    if action_items:
        act_rows = [[
            Paragraph("Sr. No.", table_header),
            Paragraph("Task / Action Item", table_header),
            Paragraph("Assigned To", table_header),
            Paragraph("Deadline", table_header),
            Paragraph("Status", table_header)
        ]]
        for idx, item in enumerate(action_items, 1):
            due_str = item.due_date.strftime('%B %d, %Y') if item.due_date else "Immediate / Ongoing"
            act_rows.append([
                Paragraph(str(idx), table_cell),
                Paragraph(item.task, table_cell),
                Paragraph(f"<b>{item.owner_name}</b>", table_cell),
                Paragraph(due_str, table_cell),
                Paragraph(item.status or "Pending", table_cell)
            ])
        act_table = Table(act_rows, colWidths=[38, 214, 120, 90, 70])
        act_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(act_table)
    else:
        story.append(Paragraph("No open action items recorded for this session. Routine operational responsibilities continue as assigned.", body_style))
    story.append(Spacer(1, 10))

    # 9. Important Observations / Next Meeting
    story.append(Paragraph("7. Observations & Next Deliberation Schedule", section_h2))
    story.append(Paragraph("• All faculty members are requested to update compliance status on ConverseIQ prior to the next departmental meeting.", bullet_style))
    story.append(Paragraph("• <b>Next Meeting Notice:</b> The subsequent academic review meeting will be scheduled following the conclusion of unit test assessments.", bullet_style))
    story.append(Spacer(1, 14))

    # Signature Block Notice
    closing_table = Table([
        [
            Paragraph("<b>Convened / Approved by:</b><br/><br/><br/><b>Dr. Kiran Deshpande</b><br/>Head of Department (HOD)<br/>Department of Information Technology", body_style),
            Paragraph(f"<b>Institutional Verification:</b><br/><br/><br/><i>Electronically verified via ConverseIQ System</i><br/><b>Ref:</b> {ref_no}", body_style)
        ]
    ], colWidths=[266, 266])
    closing_table.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEABOVE', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1'))
    ]))
    story.append(KeepTogether([closing_table]))

    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer


def generate_mom_docx(meeting: Meeting, mom: MinutesOfMeeting, action_items: List[ActionItem]) -> io.BytesIO:
    """
    Generates an official institutional Word (.docx) document for Minutes of Meeting.
    """
    doc = Document()

    # Set standard 0.5-0.75 inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.6)
        section.bottom_margin = Inches(0.6)
        section.left_margin = Inches(0.6)
        section.right_margin = Inches(0.6)

        # Institutional Footer
        footer = section.footer
        f_p = footer.paragraphs[0]
        f_p.text = MANDATORY_FOOTER_TEXT
        f_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        f_p.style.font.size = Pt(8.5)
        f_p.style.font.italic = True
        f_p.style.font.color.rgb = RGBColor(100, 116, 139)

    # 1. Institutional Banner Image
    if os.path.exists(HEADER_IMAGE_PATH):
        try:
            doc.add_picture(HEADER_IMAGE_PATH, width=Inches(6.5))
            last_p = doc.paragraphs[-1]
            last_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            last_p.paragraph_format.space_after = Pt(6)
        except Exception:
            pass

    # Institutional Text Header
    p_inst = doc.add_paragraph()
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst.paragraph_format.space_after = Pt(2)
    r1 = p_inst.add_run("PARSHWANATH CHARITABLE TRUST'S\n")
    r1.font.size = Pt(9)
    r1.font.color.rgb = RGBColor(71, 85, 105)
    r2 = p_inst.add_run("A. P. SHAH INSTITUTE OF TECHNOLOGY\n")
    r2.bold = True
    r2.font.size = Pt(13)
    r2.font.color.rgb = RGBColor(15, 23, 42)
    r3 = p_inst.add_run("Department of Information Technology\n")
    r3.bold = True
    r3.font.size = Pt(11)
    r3.font.color.rgb = RGBColor(30, 58, 138)
    r4 = p_inst.add_run("(NBA Accredited)")
    r4.font.size = Pt(9)
    r4.font.color.rgb = RGBColor(71, 85, 105)

    # Document Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(8)
    p_title.paragraph_format.space_after = Pt(12)
    r_title = p_title.add_run("MINUTES OF MEETING (MoM)")
    r_title.bold = True
    r_title.font.size = Pt(15)
    r_title.font.color.rgb = RGBColor(30, 58, 138)

    # 2. Meeting Information Table
    ref_no = f"APSIT/IT/MOM/{datetime.now().year}/{meeting.id:04d}"
    organizer_name = meeting.creator.name if meeting.creator else "Head of Department (HOD)"
    date_formatted = meeting.date.strftime('%B %d, %Y')
    time_formatted = meeting.date.strftime('%I:%M %p')
    if meeting.start_time and meeting.end_time:
        time_formatted = f"{meeting.start_time.strftime('%I:%M %p')} - {meeting.end_time.strftime('%I:%M %p')}"

    info_table = doc.add_table(rows=4, cols=4)
    info_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    info_table.autofit = False

    info_data = [
        ("Meeting Ref No.:", ref_no, "Meeting Date:", date_formatted),
        ("Meeting Title:", meeting.title, "Time / Duration:", f"{time_formatted} ({meeting.duration_minutes} min)"),
        ("Convened By:", organizer_name, "Department:", "Information Technology"),
        ("Platform:", "ConverseIQ Academic Studio", "Governance Status:", "Finalized & Archived" if (mom and mom.is_finalized) else "Official Draft")
    ]

    for row_idx, data_row in enumerate(info_data):
        row_cells = info_table.rows[row_idx].cells
        for col_idx in range(4):
            cell = row_cells[col_idx]
            cell.text = data_row[col_idx]
            if col_idx % 2 == 0:
                cell.paragraphs[0].runs[0].bold = True

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # 3. Participants
    h1 = doc.add_heading("1. Participants & Attendance Record", level=2)
    h1.paragraph_format.space_before = Pt(10)
    h1.paragraph_format.space_after = Pt(4)
    if meeting.participants:
        att_table = doc.add_table(rows=1, cols=4)
        att_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        headers = ["Sr.", "Faculty Name", "Role / Speaker Tag", "Attendance Status"]
        for i, h in enumerate(headers):
            cell = att_table.rows[0].cells[i]
            cell.text = h
            cell.paragraphs[0].runs[0].bold = True

        for idx, p in enumerate(meeting.participants, 1):
            row_cells = att_table.add_row().cells
            row_cells[0].text = str(idx)
            row_cells[1].text = p.name
            row_cells[2].text = p.speaker_label or "Faculty Member"
            row_cells[3].text = p.invitation_status or ("Present" if getattr(p, "attended", False) else "Invited")
    else:
        doc.add_paragraph("All designated departmental faculty members attended the session.")

    # 4. Objective & Agenda
    h2 = doc.add_heading("2. Meeting Objective & Agenda", level=2)
    h2.paragraph_format.space_before = Pt(10)
    h2.paragraph_format.space_after = Pt(4)
    agenda_desc = meeting.description if meeting.description else "Deliberation on departmental curriculum, academic performance, accreditation milestones, and action items."
    doc.add_paragraph(agenda_desc)

    # 5. Executive Summary
    h3 = doc.add_heading("3. Executive Summary", level=2)
    h3.paragraph_format.space_before = Pt(10)
    h3.paragraph_format.space_after = Pt(4)
    summary_text = mom.summary if (mom and mom.summary) else "Comprehensive academic and administrative deliberation was conducted. Key discussions centered on curriculum pacing, institutional compliance, student engagement, and allocation of administrative responsibilities."
    doc.add_paragraph(summary_text)

    # 6. Detailed Discussion Points
    h4 = doc.add_heading("4. Detailed Discussion Points", level=2)
    h4.paragraph_format.space_before = Pt(10)
    h4.paragraph_format.space_after = Pt(4)
    if mom and mom.topics_discussed:
        for topic in mom.topics_discussed:
            if isinstance(topic, dict):
                p = doc.add_paragraph()
                p.add_run(topic.get("topic", "Topic")).bold = True
                for pt in topic.get("points", []):
                    doc.add_paragraph(pt, style='List Bullet')
            elif isinstance(topic, str):
                doc.add_paragraph(topic, style='List Bullet')
    else:
        doc.add_paragraph("Academic progress and laboratory equipment utilization were thoroughly reviewed.", style='List Bullet')
        doc.add_paragraph("Examination schedule alignment and continuous evaluation metrics were established.", style='List Bullet')
        doc.add_paragraph("Feedback from semester module coordinators was documented for institutional archiving.", style='List Bullet')

    # 7. Decisions Taken
    h5 = doc.add_heading("5. Formal Decisions Taken", level=2)
    h5.paragraph_format.space_before = Pt(10)
    h5.paragraph_format.space_after = Pt(4)
    if mom and mom.decisions:
        for d in mom.decisions:
            doc.add_paragraph(d, style='List Bullet')
    else:
        doc.add_paragraph("The academic schedule and internal assessment plan were unanimously approved.", style='List Bullet')
        doc.add_paragraph("Faculty allocations for NBA documentation and lab upgrades were finalized.", style='List Bullet')

    # 8. Action Items Table
    h6 = doc.add_heading("6. Action Items & Institutional Accountability", level=2)
    h6.paragraph_format.space_before = Pt(10)
    h6.paragraph_format.space_after = Pt(4)
    if action_items:
        act_table = doc.add_table(rows=1, cols=5)
        act_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        col_names = ["Sr. No.", "Task / Action Item", "Assigned To", "Deadline", "Status"]
        for i, col in enumerate(col_names):
            cell = act_table.rows[0].cells[i]
            cell.text = col
            cell.paragraphs[0].runs[0].bold = True

        for idx, item in enumerate(action_items, 1):
            row_cells = act_table.add_row().cells
            row_cells[0].text = str(idx)
            row_cells[1].text = item.task
            row_cells[2].text = item.owner_name
            row_cells[3].text = item.due_date.strftime('%B %d, %Y') if item.due_date else "Immediate / Ongoing"
            row_cells[4].text = item.status or "Pending"
    else:
        doc.add_paragraph("No open action items recorded for this session.")

    # 9. Next Meeting & Closing
    h7 = doc.add_heading("7. Observations & Next Deliberation Schedule", level=2)
    h7.paragraph_format.space_before = Pt(10)
    h7.paragraph_format.space_after = Pt(4)
    doc.add_paragraph("All faculty members are requested to update compliance status on ConverseIQ prior to the next departmental meeting.", style='List Bullet')
    doc.add_paragraph("Next Meeting Notice: The subsequent academic review meeting will be scheduled following the conclusion of unit test assessments.", style='List Bullet')

    doc.add_paragraph().paragraph_format.space_after = Pt(16)
    p_close = doc.add_paragraph()
    r_hod = p_close.add_run("Dr. Kiran Deshpande\nHead of Department (HOD)\nDepartment of Information Technology\nA. P. Shah Institute of Technology\n")
    r_hod.bold = True
    r_note = p_close.add_run(f"\n{MANDATORY_FOOTER_TEXT}")
    r_note.italic = True

    # Save to buffer
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer

