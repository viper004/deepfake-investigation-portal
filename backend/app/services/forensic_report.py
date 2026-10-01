import os
import json
import hashlib
from datetime import datetime, timezone
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

    # 1. INVESTIGATION INFORMATION (Part 14)
    story.append(Paragraph("1. INVESTIGATION INFORMATION", section_heading))
    
    created_str = case.created_at.strftime("%d %B %Y, %H:%M UTC") if case.created_at else "N/A"
    incident_str = case.incident_date.strftime("%d %B %Y") if case.incident_date else "N/A"
    now_utc = datetime.now(timezone.utc)
    report_gen_date = now_utc.strftime("%d %B %Y, %H:%M UTC")
    scan_date_str = scan_record.get("created_at") or report_gen_date
    
    creator_name = creator_user.full_name if creator_user else "Case User"
    creator_id_str = f"USR-{creator_user.id:03d}" if creator_user else "N/A"
    inv_name = investigator_user.full_name if investigator_user else "Assigned Forensic Analyst"
    inv_id_str = f"INV-{investigator_user.id:03d}" if investigator_user else "N/A"
    status_raw = case.status.value if hasattr(case.status, "value") else str(case.status)
    status_display = status_raw.replace("CASE_", "").replace("_", " ").title()

    case_info_data = [
        [Paragraph("<b>Case ID:</b>", body_regular), Paragraph(f"<b>{case.case_number}</b>", body_regular),
         Paragraph("<b>Case Status:</b>", body_regular), Paragraph(f"<b>{status_display}</b>", body_regular)],
        [Paragraph("<b>Case Title:</b>", body_regular), Paragraph(case.title or "N/A", body_regular),
         Paragraph("<b>Report Generated:</b>", body_regular), Paragraph(report_gen_date, body_regular)],
        [Paragraph("<b>Investigator:</b>", body_regular), Paragraph(f"<b>{inv_name}</b>", body_regular),
         Paragraph("<b>Investigator ID:</b>", body_regular), Paragraph(f"<b>{inv_id_str}</b>", body_regular)],
        [Paragraph("<b>Case Submitter:</b>", body_regular), Paragraph(creator_name, body_regular),
         Paragraph("<b>Submitter ID:</b>", body_regular), Paragraph(creator_id_str, body_regular)],
        [Paragraph("<b>Incident Date:</b>", body_regular), Paragraph(incident_str, body_regular),
         Paragraph("<b>Analysis Engine:</b>", body_regular), Paragraph("Sentinel AI V1.7-A Dual-Head", body_regular)],
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

    # 2. EVIDENCE SUMMARY (Part 10 - Dynamic counts from actual case data)
    story.append(Paragraph("2. EVIDENCE SUMMARY", section_heading))
    
    total_evidence_count = len(evidence_files)
    user_uploaded_count = 0
    investigator_uploaded_count = 0

    for ef in evidence_files:
        is_inv = False
        if ef.uploaded_by_role and ef.uploaded_by_role.upper() == "INVESTIGATOR":
            is_inv = True
        elif getattr(ef, "uploader", None):
            u = ef.uploader
            if getattr(u, "role_id", None) == 2 or (getattr(u, "role", None) and u.role.role_name == "INVESTIGATOR"):
                is_inv = True
        elif investigator_user and ef.uploaded_by == investigator_user.id:
            is_inv = True
            
        if is_inv:
            investigator_uploaded_count += 1
        else:
            user_uploaded_count += 1

    active_ev_ids = {ef.id for ef in evidence_files}
    active_results = [r for r in results if r.get("evidence_id") in active_ev_ids]
    if not active_results and results:
        active_results = results[:total_evidence_count]

    ai_scanned_count = len([r for r in active_results if r.get("status") != "failed"])
    tampered_count = sum(1 for r in active_results if (
        r.get("classification") == "tampered" or
        r.get("assessment_code") == "DEEPFAKE" or
        r.get("tampered_probability", 0) >= 0.40 or
        r.get("deepfake_probability", 0) >= 50
    ))
    authentic_count = max(0, ai_scanned_count - tampered_count)

    ev_summary_table_data = [
        [Paragraph("<b>Category</b>", body_bold), Paragraph("<b>Count</b>", body_bold),
         Paragraph("<b>AI Forensic Classification</b>", body_bold), Paragraph("<b>Count</b>", body_bold)],
        [Paragraph("<b>Total Evidence:</b>", body_regular), Paragraph(f"<b>{total_evidence_count}</b>", body_regular),
         Paragraph("<b>AI Scanned:</b>", body_regular), Paragraph(f"<b>{ai_scanned_count}</b>", body_regular)],
        [Paragraph("<b>User Uploaded:</b>", body_regular), Paragraph(f"{user_uploaded_count}", body_regular),
         Paragraph("<b>Authentic:</b>", body_regular), Paragraph(f"<font color='#166534'><b>{authentic_count}</b></font>", body_regular)],
        [Paragraph("<b>Investigator Uploaded:</b>", body_regular), Paragraph(f"{investigator_uploaded_count}", body_regular),
         Paragraph("<b>Tampered:</b>", body_regular), Paragraph(f"<font color='#DC2626'><b>{tampered_count}</b></font>", body_regular)],
    ]

    summary_table = Table(ev_summary_table_data, colWidths=[140, 120, 150, 113])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#FFFFFF')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # Page Break before Evidence Examination section for clean forensic layout
    story.append(PageBreak())

    # 3. DETAILED EVIDENCE EXAMINATION & METADATA (Parts 9, 11, 12, 13)
    story.append(Paragraph("3. DETAILED EVIDENCE EXAMINATION", section_heading))

    for idx, ef in enumerate(evidence_files, 1):
        item_story = []
        ev_label = f"EV-{ef.id:05d}"
        item_story.append(Paragraph(f"EVIDENCE ITEM {idx} ({ev_label}) — {ef.original_name}", body_bold))
        
        # Match analysis result
        res = next((r for r in results if r.get("evidence_id") == ef.id), None)
        if not res:
            res = next((r for r in results if r.get("file_name") == ef.file_name or r.get("original_name") == ef.original_name), None)

        # Determine uploader metadata
        is_inv_uploader = False
        if ef.uploaded_by_role and ef.uploaded_by_role.upper() == "INVESTIGATOR":
            is_inv_uploader = True
        elif getattr(ef, "uploader", None) and (getattr(ef.uploader, "role_id", None) == 2 or (getattr(ef.uploader, "role", None) and ef.uploader.role.role_name == "INVESTIGATOR")):
            is_inv_uploader = True
        elif investigator_user and ef.uploaded_by == investigator_user.id:
            is_inv_uploader = True

        if is_inv_uploader:
            uploader_role_display = "Investigator"
            uploader_name_display = ef.uploader.full_name if getattr(ef, "uploader", None) else (investigator_user.full_name if investigator_user else "Investigator")
        elif ef.uploaded_by_role and ef.uploaded_by_role.upper() == "ADMIN":
            uploader_role_display = "Admin"
            uploader_name_display = ef.uploader.full_name if getattr(ef, "uploader", None) else "Administrator"
        else:
            uploader_role_display = "User"
            uploader_name_display = ef.uploader.full_name if getattr(ef, "uploader", None) else (creator_user.full_name if creator_user else "Case User")

        file_size_bytes = ef.file_size or (res.get("file_size", 0) if res else 0)
        file_size_kb = f"{(file_size_bytes / 1024):.2f} KB" if file_size_bytes else "N/A"
        sha_hash = ef.sha256_hash or (res.get("sha256_hash") if res else "N/A")

        upload_ts = ef.upload_time or getattr(ef, "created_at", None)
        upload_ts_str = upload_ts.strftime("%d %B %Y, %H:%M UTC") if upload_ts else "N/A"

        if res and res.get("status") != "failed":
            scan_status_str = "Completed"
            is_tampered = (
                res.get("classification") == "tampered" or
                res.get("assessment_code") == "DEEPFAKE" or
                res.get("tampered_probability", 0) >= 0.40 or
                res.get("deepfake_probability", 0) >= 50
            )
            prediction_str = "TAMPERED" if is_tampered else "AUTHENTIC"
            
            if res.get("tampered_probability") is not None:
                conf_val = (res["tampered_probability"] if is_tampered else (1.0 - res["tampered_probability"])) * 100
            elif res.get("manipulation_confidence") is not None:
                conf_val = float(res["manipulation_confidence"])
            elif res.get("confidence_score") is not None:
                c_val = float(res["confidence_score"])
                conf_val = c_val * 100 if c_val <= 1.0 else c_val
            else:
                conf_val = float(res.get("deepfake_probability", 0)) if is_tampered else (100.0 - float(res.get("deepfake_probability", 0)))
            confidence_str = f"{conf_val:.2f}%"
            model_version_str = res.get("model_version") or "Sentinel AI V1.7-A"
            scanned_ts_str = res.get("analyzed_at") or scan_date_str
        else:
            scan_status_str = "Failed" if (res and res.get("status") == "failed") else "Pending"
            prediction_str = "UNVERIFIED"
            confidence_str = "N/A"
            model_version_str = "Sentinel AI V1.7-A"
            scanned_ts_str = "N/A"
            is_tampered = False

        pred_color = "#DC2626" if prediction_str == "TAMPERED" else ("#166534" if prediction_str == "AUTHENTIC" else "#64748B")

        meta_data = [
            [Paragraph("<b>Evidence ID:</b>", body_regular), Paragraph(f"<b>{ev_label}</b>", body_regular),
             Paragraph("<b>AI Scan:</b>", body_regular), Paragraph(f"<b>{scan_status_str}</b>", body_regular)],
            [Paragraph("<b>Original Filename:</b>", body_regular), Paragraph(ef.original_name, body_regular),
             Paragraph("<b>Prediction:</b>", body_regular), Paragraph(f"<font color='{pred_color}'><b>{prediction_str}</b></font>", body_regular)],
            [Paragraph("<b>Uploaded By:</b>", body_regular), Paragraph(f"<b>{uploader_name_display}</b>", body_regular),
             Paragraph("<b>Confidence:</b>", body_regular), Paragraph(f"<b>{confidence_str}</b>", body_regular)],
            [Paragraph("<b>Uploader Role:</b>", body_regular), Paragraph(f"<b>{uploader_role_display}</b>", body_regular),
             Paragraph("<b>Model:</b>", body_regular), Paragraph(model_version_str, body_regular)],
            [Paragraph("<b>Uploaded At:</b>", body_regular), Paragraph(upload_ts_str, body_regular),
             Paragraph("<b>Scanned At:</b>", body_regular), Paragraph(scanned_ts_str, body_regular)],
            [Paragraph("<b>File Size:</b>", body_regular), Paragraph(file_size_kb, body_regular),
             Paragraph("<b>MIME Type:</b>", body_regular), Paragraph(str(ef.mime_type or "image/jpeg"), body_regular)],
            [Paragraph("<b>SHA-256 Hash:</b>", body_regular), Paragraph(f"<font size=6.5 fontName=Courier>{sha_hash}</font>", body_regular),
             Paragraph("", body_regular), Paragraph("", body_regular)],
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
        storage_path = ef.storage_path
        if storage_path and not os.path.exists(storage_path):
            alt1 = os.path.join(base_backend_dir, storage_path.lstrip("/"))
            alt2 = os.path.join(base_backend_dir, "uploads", os.path.basename(storage_path))
            if os.path.exists(alt1):
                storage_path = alt1
            elif os.path.exists(alt2):
                storage_path = alt2

        if storage_path and os.path.exists(storage_path):
            try:
                orig_img = get_aspect_image(storage_path, max_width=250, max_height=150)
                overlay_path = res.get("overlay_artifact_path") or res.get("overlay_path") if res else None
                
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
        if res and res.get("status") != "failed":
            tampered_prob_val = res.get("tampered_probability")
            if tampered_prob_val is not None:
                tampered_pct_str = f"{(tampered_prob_val * 100):.2f}%"
                authentic_pct_str = f"{((1.0 - tampered_prob_val) * 100):.2f}%"
            else:
                tampered_pct_str = f"{res.get('deepfake_probability', 0):.2f}%"
                authentic_pct_str = f"{100 - res.get('deepfake_probability', 0):.2f}%"

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


