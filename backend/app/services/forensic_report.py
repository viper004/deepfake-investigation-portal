import os
import json
import hashlib
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, HRFlowable, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass ReportLab canvas to compute dynamic total page count (Page X of Y)
    and render official government-style header & footer.
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

    def draw_page_decorations(self, page_count):
        self.saveState()
        # Top Header Line & Title
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#CC2200"))
        self.drawString(36, 762, "SENTINEL AI — DIGITAL FORENSICS & MEDIA ANALYSIS PORTAL")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#444444"))
        self.drawRightString(576, 762, "CONFIDENTIAL FORENSIC REPORT")
        self.setStrokeColor(colors.HexColor("#CC2200"))
        self.setLineWidth(1)
        self.line(36, 754, 576, 754)

        # Bottom Footer Line & Metadata
        self.setStrokeColor(colors.HexColor("#CCCCCC"))
        self.setLineWidth(0.5)
        self.line(36, 45, 576, 45)
        self.setFont("Helvetica-Bold", 7)
        self.setFillColor(colors.HexColor("#CC2200"))
        self.drawString(36, 32, "CONFIDENTIAL")
        self.setFont("Helvetica", 7)
        self.setFillColor(colors.HexColor("#666666"))
        self.drawString(100, 32, "FOR AUTHORIZED FORENSIC & LAW ENFORCEMENT USE ONLY")
        self.drawRightString(576, 32, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


class MockForensicScanner:
    """
    Simulated AI Forensic Scanner.
    Generates deterministic deepfake & manipulation metrics based on evidence attributes.
    """
    @staticmethod
    def analyze_case_evidence(case, evidence_files):
        results = []
        for idx, item in enumerate(evidence_files, 1):
            file_name = getattr(item, "original_name", None) or getattr(item, "file_name", "evidence_file")
            sha_hash = getattr(item, "sha256_hash", "") or hashlib.sha256(file_name.encode()).hexdigest()
            file_type_val = item.file_type.value if hasattr(item.file_type, "value") else str(item.file_type)
            
            # Deterministic math using evidence ID & hash
            item_id = getattr(item, "id", idx)
            hash_sum = sum(ord(c) for c in sha_hash[:12])
            seed = (item_id * 31 + hash_sum) % 100

            is_manipulated = (seed % 2 == 1) or (seed > 45)
            
            if is_manipulated:
                prob = 68 + (seed % 28)  # 68% - 95%
                conf = 88 + (seed % 10)  # 88% - 97%
                assessment = "LIKELY MANIPULATED"
                assessment_code = "DEEPFAKE"
            else:
                prob = 5 + (seed % 20)    # 5% - 24%
                conf = 84 + (seed % 13)  # 84% - 96%
                assessment = "NO SIGNIFICANT MANIPULATION DETECTED"
                assessment_code = "REAL"

            results.append({
                "evidence_index": idx,
                "evidence_id": item_id,
                "file_name": file_name,
                "file_type": file_type_val,
                "mime_type": getattr(item, "mime_type", "application/octet-stream"),
                "file_size": getattr(item, "file_size", 0),
                "sha256_hash": sha_hash,
                "storage_path": getattr(item, "storage_path", ""),
                "deepfake_probability": prob,
                "manipulation_confidence": conf,
                "assessment": assessment,
                "assessment_code": assessment_code,
                "is_demonstration": True,
                "artifacts_summary": "Facial warping & frame boundary anomalies detected" if is_manipulated else "Consistent noise distribution & authentic EXIF markers"
            })
        return results


def generate_forensic_pdf_report(case, creator_user, investigator_user, evidence_files, scan_record, output_path):
    """
    Generates an official government-style forensic PDF report using ReportLab.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0A0A0A'),
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#CC2200'),
        spaceAfter=12
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#0A0A0A'),
        spaceBefore=14,
        spaceAfter=8
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1A1A1A')
    )

    body_regular = ParagraphStyle(
        'BodyRegular',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#333333')
    )

    disclaimer_style = ParagraphStyle(
        'DisclaimerText',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#991B1B'),
        alignment=1
    )

    story = []

    # Title Block
    story.append(Paragraph("FORENSIC MEDIA ANALYSIS REPORT", title_style))
    story.append(Paragraph(f"CASE FILE: {case.case_number} — DIGITAL EVIDENCE EXAMINATION", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#CC2200'), spaceAfter=12))

    # 1. CASE INFORMATION TABLE
    story.append(Paragraph("1. CASE INFORMATION", section_heading))
    
    created_str = case.created_at.strftime("%Y-%m-%d %H:%M UTC") if case.created_at else "N/A"
    incident_str = case.incident_date.strftime("%Y-%m-%d") if case.incident_date else "N/A"
    scan_date_str = scan_record.get("created_at") or datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    
    creator_name = creator_user.full_name if creator_user else "N/A"
    investigator_name = investigator_user.full_name if investigator_user else "Awaiting Assignment"
    
    status_val = case.status.value if hasattr(case.status, "value") else str(case.status)

    case_info_data = [
        [Paragraph("<b>Case Number:</b>", body_regular), Paragraph(f"<b>{case.case_number}</b>", body_regular),
         Paragraph("<b>Case Status:</b>", body_regular), Paragraph(f"<b>{status_val}</b>", body_regular)],
        [Paragraph("<b>Case Title:</b>", body_regular), Paragraph(case.title or "N/A", body_regular),
         Paragraph("<b>Evidence Count:</b>", body_regular), Paragraph(str(len(evidence_files)), body_regular)],
        [Paragraph("<b>Case Owner:</b>", body_regular), Paragraph(creator_name, body_regular),
         Paragraph("<b>Assigned Investigator:</b>", body_regular), Paragraph(investigator_name, body_regular)],
        [Paragraph("<b>Incident Date:</b>", body_regular), Paragraph(incident_str, body_regular),
         Paragraph("<b>Scan Date:</b>", body_regular), Paragraph(scan_date_str, body_regular)],
        [Paragraph("<b>Created Date:</b>", body_regular), Paragraph(created_str, body_regular),
         Paragraph("<b>Scan Duration:</b>", body_regular), Paragraph(f"{scan_record.get('scan_duration', 10.2)} seconds", body_regular)],
    ]

    info_table = Table(case_info_data, colWidths=[100, 170, 110, 160])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 14))

    # 2. EVIDENCE ITEMS & ANALYSIS
    story.append(Paragraph("2. EVIDENCE EXAMINATION & MOCK AI ANALYSIS", section_heading))
    
    results = scan_record.get("results", [])

    for idx, res in enumerate(results, 1):
        item_story = []
        item_story.append(Paragraph(f"EVIDENCE ITEM 0{idx}: {res.get('file_name')}", body_bold))
        
        file_size_kb = f"{(res.get('file_size', 0) / 1024):.2f} KB" if res.get('file_size') else "N/A"

        meta_data = [
            [Paragraph("<b>Evidence ID:</b>", body_regular), Paragraph(str(res.get("evidence_id")), body_regular),
             Paragraph("<b>MIME Type:</b>", body_regular), Paragraph(str(res.get("mime_type")), body_regular)],
            [Paragraph("<b>File Type:</b>", body_regular), Paragraph(str(res.get("file_type")), body_regular),
             Paragraph("<b>File Size:</b>", body_regular), Paragraph(file_size_kb, body_regular)],
            [Paragraph("<b>SHA-256 Hash:</b>", body_regular), Paragraph(f"<font size=7 fontName=Courier>{res.get('sha256_hash')}</font>", body_regular), "", ""]
        ]
        
        meta_table = Table(meta_data, colWidths=[90, 180, 80, 190])
        meta_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FFFFFF')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('SPAN', (1,2), (3,2)),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        item_story.append(meta_table)
        item_story.append(Spacer(1, 6))

        # Check for image preview
        storage_path = res.get("storage_path")
        if storage_path and os.path.exists(storage_path) and res.get("file_type") in ["IMAGE", "FileTypeEnum.IMAGE"]:
            try:
                img = RLImage(storage_path, width=180, height=120)
                item_story.append(Spacer(1, 4))
                item_story.append(img)
                item_story.append(Paragraph("<font size=7 color='#666666'>Figure 1 — Submitted Evidence Preview</font>", body_regular))
                item_story.append(Spacer(1, 6))
            except Exception:
                pass

        # Analysis Result Sub-Table
        is_deepfake = res.get("assessment_code") == "DEEPFAKE"
        result_bg = colors.HexColor('#FEF2F2') if is_deepfake else colors.HexColor('#F0FDF4')
        result_text_color = colors.HexColor('#991B1B') if is_deepfake else colors.HexColor('#166534')

        analysis_table_data = [
            [Paragraph("<b>Parameter</b>", body_bold), Paragraph("<b>Analysis Result</b>", body_bold), Paragraph("<b>Confidence</b>", body_bold)],
            [Paragraph("Deepfake Probability", body_regular), Paragraph(f"<b>{res.get('deepfake_probability')}%</b>", body_regular), Paragraph(f"{res.get('manipulation_confidence')}%", body_regular)],
            [Paragraph("Forensic Assessment", body_regular), 
             Paragraph(f"<font color='{result_text_color.hexval()}'><b>{res.get('assessment')}</b></font>", body_regular),
             Paragraph("High Confidence", body_regular)],
            [Paragraph("Artifacts Summary", body_regular), Paragraph(res.get("artifacts_summary", "N/A"), body_regular), Paragraph("Simulated Scan", body_regular)]
        ]

        analysis_table = Table(analysis_table_data, colWidths=[150, 240, 150])
        analysis_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
            ('BACKGROUND', (1,2), (1,2), result_bg),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))

        item_story.append(analysis_table)
        item_story.append(Spacer(1, 10))

        story.append(KeepTogether(item_story))

    story.append(Spacer(1, 8))

    # 3. INVESTIGATOR EXAMINATION NOTES (IF PRESENT)
    inv_notes_data = scan_record.get("investigator_notes", [])
    if inv_notes_data:
        story.append(Paragraph("3. INVESTIGATOR EXAMINATION NOTES", section_heading))
        for note in inv_notes_data:
            author_str = note.get("investigator_name", "Assigned Investigator")
            time_str = note.get("created_at") or "N/A"
            note_html = note.get("content", "").replace("<p>", "").replace("</p>", "<br/>")
            
            note_content_p = Paragraph(
                f"<b>Investigator:</b> {author_str} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Timestamp:</b> {time_str}<br/>"
                f"<font color='#333333'>{note_html}</font>",
                body_regular
            )
            note_table = Table([[note_content_p]], colWidths=[540])
            note_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
                ('TOPPADDING', (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('LEFTPADDING', (0,0), (-1,-1), 8),
                ('RIGHTPADDING', (0,0), (-1,-1), 8),
            ]))
            story.append(note_table)
            story.append(Spacer(1, 6))
        story.append(Spacer(1, 8))

    # 4. FINAL FORENSIC CONCLUSION & DISCLAIMER
    conclusion_title = "4. FINAL FORENSIC CONCLUSION" if inv_notes_data else "3. FINAL FORENSIC CONCLUSION"
    story.append(Paragraph(conclusion_title, section_heading))
    
    conclusion_text = (
        f"Based on simulated deepfake artifact detection algorithms, {len(results)} evidence items were examined. "
        "The automated system evaluated frame consistency, noise distribution, and spectral frequency anomalies. "
        "Detailed parameter scores are logged in the Sentinel AI audit registry."
    )
    story.append(Paragraph(conclusion_text, body_regular))
    story.append(Spacer(1, 12))

    # Prominent Disclaimer Box
    disclaimer_box_data = [[
        Paragraph(
            "<b>DEMONSTRATION REPORT — NOT AN ACTUAL FORENSIC DETERMINATION</b><br/>"
            "<font size=8 fontName=Helvetica color='#666666'>"
            "This report was generated using simulated demonstration scanner metrics. "
            "No production AI deepfake model has been executed. This document serves as an architectural prototype for the Sentinel AI Portal."
            "</font>",
            disclaimer_style
        )
    ]]
    
    disclaimer_table = Table(disclaimer_box_data, colWidths=[540])
    disclaimer_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FEF2F2')),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#EF4444')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(disclaimer_table)

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    return output_path
