import os
import json
import hashlib
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, HRFlowable, KeepTogether, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from PIL import Image as PILImage


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass ReportLab canvas to compute dynamic total page count (Page X of Y)
    and render official Sentinel AI header & footer on A4 pages.
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
        self.drawString(36, 810, "SENTINEL AI — DIGITAL FORENSICS & MEDIA ANALYSIS PORTAL")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#475569"))
        self.drawRightString(559, 810, "CONFIDENTIAL FORENSIC REPORT")
        self.setStrokeColor(colors.HexColor("#CC2200"))
        self.setLineWidth(1)
        self.line(36, 802, 559, 802)

        # Bottom Footer Line & Metadata
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 45, 559, 45)
        self.setFont("Helvetica-Bold", 7)
        self.setFillColor(colors.HexColor("#CC2200"))
        self.drawString(36, 32, "CONFIDENTIAL")
        self.setFont("Helvetica", 7)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(100, 32, "FOR AUTHORIZED FORENSIC & LAW ENFORCEMENT USE ONLY")
        self.drawRightString(559, 32, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def get_aspect_image(image_path: str, max_width: float = 245.0, max_height: float = 150.0) -> RLImage:
    """
    Helper function to load an image with PIL and calculate aspect-ratio preserved dimensions for ReportLab.
    """
    try:
        with PILImage.open(image_path) as im:
            w, h = im.size
            aspect = w / float(h)
            if aspect > max_width / max_height:
                target_w = max_width
                target_h = max_width / aspect
            else:
                target_h = max_height
                target_w = max_height * aspect
            return RLImage(image_path, width=target_w, height=target_h)
    except Exception:
        return RLImage(image_path, width=max_width, height=max_height)


def generate_forensic_pdf_report(case, creator_user, investigator_user, evidence_files, scan_record, output_path):
    """
    Generates an official Sentinel AI forensic PDF investigation report using ReportLab.
    Production quality layout: A4 sizing, selectable vector text, aspect-preserved evidence images,
    executive summary, detailed evidence analysis with heatmaps, methodology, and legal disclaimers.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
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
        textColor=colors.HexColor('#0F172A'),
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
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=14,
        spaceAfter=8
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1E293B')
    )

    body_regular = ParagraphStyle(
        'BodyRegular',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    disclaimer_style = ParagraphStyle(
        'DisclaimerText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#334155'),
        alignment=0
    )

    story = []
    base_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    # Title Block
    story.append(Paragraph("SENTINEL AI — DEEPFAKE INVESTIGATION REPORT", title_style))
    story.append(Paragraph(f"INVESTIGATION ID: {case.case_number} — DIGITAL EVIDENCE EXAMINATION", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#CC2200'), spaceAfter=12))

    results = scan_record.get("results", [])
    if isinstance(scan_record.get("results_json"), str):
        try:
            results = json.loads(scan_record["results_json"])
        except Exception:
            pass

    # 1. CASE & INVESTIGATION METADATA TABLE
    story.append(Paragraph("1. INVESTIGATION METADATA", section_heading))
    
    created_str = case.created_at.strftime("%Y-%m-%d %H:%M UTC") if case.created_at else "N/A"
    incident_str = case.incident_date.strftime("%Y-%m-%d") if case.incident_date else "N/A"
    scan_date_str = scan_record.get("created_at") or datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    
    creator_name = creator_user.full_name if creator_user else "N/A"
    investigator_name = investigator_user.full_name if investigator_user else "Assigned Forensic Analyst"
    status_val = case.status.value if hasattr(case.status, "value") else str(case.status)

    case_info_data = [
        [Paragraph("<b>Investigation ID:</b>", body_regular), Paragraph(f"<b>{case.case_number}</b>", body_regular),
         Paragraph("<b>Case Status:</b>", body_regular), Paragraph(f"<b>{status_val}</b>", body_regular)],
        [Paragraph("<b>Case Title:</b>", body_regular), Paragraph(case.title or "N/A", body_regular),
         Paragraph("<b>Evidence Items:</b>", body_regular), Paragraph(str(len(evidence_files)), body_regular)],
        [Paragraph("<b>Investigator / Owner:</b>", body_regular), Paragraph(creator_name, body_regular),
         Paragraph("<b>Assigned Expert:</b>", body_regular), Paragraph(investigator_name, body_regular)],
        [Paragraph("<b>Incident Date:</b>", body_regular), Paragraph(incident_str, body_regular),
         Paragraph("<b>Analysis Date:</b>", body_regular), Paragraph(scan_date_str, body_regular)],
        [Paragraph("<b>Created Date:</b>", body_regular), Paragraph(created_str, body_regular),
         Paragraph("<b>Model Version:</b>", body_regular), Paragraph("Sentinel AI V1.7-A Dual-Head", body_regular)],
    ]

    info_table = Table(case_info_data, colWidths=[110, 150, 110, 153])
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

    # 2. EXECUTIVE SUMMARY
    story.append(Paragraph("2. EXECUTIVE SUMMARY", section_heading))
    
    total_ev = len(results)
    tampered_count = sum(1 for r in results if r.get("classification") == "tampered" or r.get("assessment_code") == "DEEPFAKE" or r.get("deepfake_probability", 0) >= 50 or r.get("tampered_probability", 0) >= 0.40)
    authentic_count = total_ev - tampered_count
    loc_available_count = sum(1 for r in results if r.get("localization_available") or r.get("overlay_artifact_path") or r.get("overlay_path"))

    exec_summary_data = [
        [Paragraph("<b>Total Evidence Analyzed</b>", body_bold), Paragraph("<b>Tampered Classifications</b>", body_bold), Paragraph("<b>Authentic Classifications</b>", body_bold), Paragraph("<b>Localization Maps</b>", body_bold)],
        [Paragraph(f"<font size=12 color='#0F172A'><b>{total_ev}</b></font>", body_regular),
         Paragraph(f"<font size=12 color='#DC2626'><b>{tampered_count}</b></font>", body_regular),
         Paragraph(f"<font size=12 color='#166534'><b>{authentic_count}</b></font>", body_regular),
         Paragraph(f"<font size=12 color='#2563EB'><b>{loc_available_count} / {total_ev}</b></font>", body_regular)]
    ]

    exec_table = Table(exec_summary_data, colWidths=[130, 130, 130, 133])
    exec_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#FFFFFF')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(exec_table)
    story.append(Spacer(1, 14))

    # Page Break before Evidence Examination section for clean pagination
    story.append(PageBreak())

    # 3. DETAILED EVIDENCE ANALYSIS
    story.append(Paragraph("3. DETAILED EVIDENCE EXAMINATION", section_heading))

    for idx, res in enumerate(results, 1):
        item_story = []
        file_name = res.get("file_name") or res.get("original_name") or f"Evidence #{idx}"
        item_story.append(Paragraph(f"EVIDENCE ITEM E-00{idx}: {file_name}", body_bold))
        
        ev_obj = next((ef for ef in evidence_files if ef.id == res.get("evidence_id")), None) if res.get("evidence_id") else None
        
        file_size_bytes = res.get("file_size", 0) or (ev_obj.file_size if ev_obj else 0)
        file_size_kb = f"{(file_size_bytes / 1024):.2f} KB" if file_size_bytes else "N/A"
        sha_hash = res.get("sha256_hash") or (ev_obj.sha256_hash if ev_obj else "N/A")

        if ev_obj and getattr(ev_obj, "created_at", None):
            upload_ts_str = ev_obj.created_at.strftime("%Y-%m-%d %H:%M:%S UTC")
        else:
            upload_ts_str = res.get("upload_timestamp") or scan_date_str

        analysis_ts_str = res.get("analyzed_at") or scan_date_str

        meta_data = [
            [Paragraph("<b>Evidence ID:</b>", body_regular), Paragraph(str(res.get("evidence_id") or idx), body_regular),
             Paragraph("<b>MIME Type:</b>", body_regular), Paragraph(str(res.get("mime_type", "image/jpeg")), body_regular)],
            [Paragraph("<b>File Size:</b>", body_regular), Paragraph(file_size_kb, body_regular),
             Paragraph("<b>Upload Timestamp:</b>", body_regular), Paragraph(upload_ts_str, body_regular)],
            [Paragraph("<b>Analysis Timestamp:</b>", body_regular), Paragraph(analysis_ts_str, body_regular),
             Paragraph("<b>SHA-256 Hash:</b>", body_regular), Paragraph(f"<font size=6.5 fontName=Courier>{sha_hash}</font>", body_regular)]
        ]
        
        meta_table = Table(meta_data, colWidths=[100, 160, 100, 163])
        meta_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        item_story.append(meta_table)
        item_story.append(Spacer(1, 6))

        # Images Grid (Original + Localization Heatmap Overlay)
        storage_path = res.get("storage_path")
        if not storage_path and res.get("evidence_id"):
            ev_obj = next((ef for ef in evidence_files if ef.id == res.get("evidence_id")), None)
            if ev_obj:
                storage_path = ev_obj.storage_path

        if storage_path and os.path.exists(storage_path):
            try:
                orig_img = get_aspect_image(storage_path, max_width=250, max_height=150)
                overlay_path = res.get("overlay_artifact_path") or res.get("overlay_path")
                
                if overlay_path:
                    abs_overlay = os.path.join(base_backend_dir, overlay_path.lstrip('/'))
                    if os.path.exists(abs_overlay):
                        ov_img = get_aspect_image(abs_overlay, max_width=250, max_height=150)
                        img_table = Table(
                            [[orig_img, ov_img],
                             [Paragraph("<font size=7 color='#64748B'>Figure 1: Original Evidence Image</font>", body_regular),
                              Paragraph("<font size=7 color='#64748B'>Figure 2: Sentinel AI Heatmap Overlay</font>", body_regular)]],
                            colWidths=[261, 262]
                        )
                        img_table.setStyle(TableStyle([
                            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                        ]))
                        item_story.append(img_table)
                        item_story.append(Spacer(1, 6))
                    else:
                        item_story.append(orig_img)
                        item_story.append(Paragraph("<font size=7 color='#64748B'>Figure 1: Original Evidence Image</font>", body_regular))
                        item_story.append(Spacer(1, 6))
                else:
                    item_story.append(orig_img)
                    item_story.append(Paragraph("<font size=7 color='#64748B'>Figure 1: Original Evidence Image</font>", body_regular))
                    item_story.append(Spacer(1, 6))
            except Exception as img_err:
                print(f"Warning: Failed to load image in PDF generation: {img_err}")

        # Analysis Result Metrics Table
        is_tampered = res.get("classification") == "tampered" or res.get("assessment_code") == "DEEPFAKE" or res.get("tampered_probability", 0) >= 0.40 or res.get("deepfake_probability", 0) >= 50
        
        tampered_prob_val = res.get("tampered_probability")
        if tampered_prob_val is not None:
            tampered_pct_str = f"{(tampered_prob_val * 100):.1f}%"
            authentic_pct_str = f"{((1.0 - tampered_prob_val) * 100):.1f}%"
        else:
            tampered_pct_str = f"{res.get('deepfake_probability', 0):.1f}%"
            authentic_pct_str = f"{100 - res.get('deepfake_probability', 0):.1f}%"

        result_bg = colors.HexColor('#FEF2F2') if is_tampered else colors.HexColor('#F0FDF4')
        result_text_color = colors.HexColor('#991B1B') if is_tampered else colors.HexColor('#166534')
        assessment_label = "TAMPERED / MANIPULATED MEDIA" if is_tampered else "AUTHENTIC MEDIA"

        analysis_table_data = [
            [Paragraph("<b>Metric</b>", body_bold), Paragraph("<b>Sentinel AI V1.7-A Value</b>", body_bold), Paragraph("<b>Threshold Criteria</b>", body_bold)],
            [Paragraph("Classification Result", body_regular), 
             Paragraph(f"<font color='{result_text_color.hexval()}'><b>{assessment_label}</b></font>", body_regular),
             Paragraph("Threshold: 0.40", body_regular)],
            [Paragraph("Tampered Probability", body_regular), Paragraph(f"<b>{tampered_pct_str}</b>", body_regular), Paragraph("Range: [0.0% - 100.0%]", body_regular)],
            [Paragraph("Authentic Probability", body_regular), Paragraph(f"<b>{authentic_pct_str}</b>", body_regular), Paragraph("Range: [0.0% - 100.0%]", body_regular)],
            [Paragraph("Spatial Localization", body_regular), 
             Paragraph("Heatmap Artifact Generated" if res.get("overlay_artifact_path") or res.get("overlay_path") else "No Anomaly Detected", body_regular),
             Paragraph("Threshold: 0.35", body_regular)]
        ]

        analysis_table = Table(analysis_table_data, colWidths=[140, 243, 140])
        analysis_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
            ('BACKGROUND', (1,1), (1,1), result_bg),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))

        item_story.append(analysis_table)
        item_story.append(Spacer(1, 12))

        story.append(KeepTogether(item_story))

    # Page Break before Technical Methodology section
    story.append(PageBreak())

    # 4. MODEL METHODOLOGY & TECHNICAL INFORMATION
    story.append(Paragraph("4. MODEL METHODOLOGY & TECHNICAL DETAILS", section_heading))
    methodology_text = (
        "<b>Architecture Overview:</b> Sentinel AI V1.7-A is a frozen dual-head deep learning architecture optimized for image deepfake detection and pixel-level spatial localization.<br/>"
        "<b>Preprocessing Stream:</b> Input images are normalized and passed through a dual-stream RGB backbone (EfficientNet-B0) paired with a high-pass Laplacian residual filter bank capturing high-frequency forensic noise signatures.<br/>"
        "<b>Dual Heads:</b><br/>"
        "• <i>Classification Head:</i> Computes softmax probability across authentic vs. tampered classes using a calibrated decision threshold of <b>0.40</b>.<br/>"
        "• <i>Localization Head:</i> Generates pixel-level feature heatmaps highlighting manipulated regions using a spatial activation threshold of <b>0.35</b>."
    )
    methodology_table = Table([[Paragraph(methodology_text, body_regular)]], colWidths=[523])
    methodology_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(methodology_table)
    story.append(Spacer(1, 14))

    # 5. FORENSIC DISCLAIMER & INTERPRETATION
    story.append(Paragraph("5. FORENSIC INTERPRETATION & DISCLAIMER", section_heading))
    disclaimer_box_data = [[
        Paragraph(
            "<b>OFFICIAL FORENSIC DISCLAIMER</b><br/>"
            "This report presents automated deepfake classification and spatial localization results produced by Sentinel AI V1.7-A. "
            "These findings provide probabilistic indicators based on forensic noise, boundary inconsistencies, and facial feature distributions. "
            "This document is intended to assist law enforcement, legal experts, and digital forensic investigators as corroborative evidence. "
            "Final evidentiary conclusions should incorporate qualified human expert examination.",
            disclaimer_style
        )
    ]]
    
    disclaimer_table = Table(disclaimer_box_data, colWidths=[523])
    disclaimer_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#64748B')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(disclaimer_table)

    # Build PDF using NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    return output_path


