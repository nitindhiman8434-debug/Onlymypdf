from __future__ import annotations

import os
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_ROW_HEIGHT_RULE, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUTPUT = Path(
    os.environ.get(
        "PHASE1_DOCX_OUTPUT",
        r"C:\Users\NiTiN Dhiman\Documents\Cursor\onlymypdf-audit-2026-09-17\OnlyMyPDF_Phase_1_Dependable_Beta_Implementation_Checkpoint.docx",
    )
)

NAVY = "17365D"
BLUE = "2F75B5"
LIGHT_BLUE = "DDEBF7"
PALE_BLUE = "F2F7FC"
PALE_GRAY = "F7F7F7"
BORDER = "D9D9D9"
BLACK = RGBColor(0, 0, 0)
MUTED = RGBColor(89, 89, 89)


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=110, start=120, bottom=110, end=120) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_cell_width(cell, width_inches: float) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(int(width_inches * 1440)))
    tc_w.set(qn("w:type"), "dxa")


def set_table_borders(table, color: str = BORDER, size: str = "5") -> None:
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = borders.find(qn(f"w:{edge}"))
        if tag is None:
            tag = OxmlElement(f"w:{edge}")
            borders.append(tag)
        tag.set(qn("w:val"), "single")
        tag.set(qn("w:sz"), size)
        tag.set(qn("w:color"), color)


def set_repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    repeat = OxmlElement("w:tblHeader")
    repeat.set(qn("w:val"), "true")
    tr_pr.append(repeat)


def prevent_row_split(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    tr_pr.append(cant_split)


def add_field(paragraph, instruction: str) -> None:
    begin_run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    begin_run._r.append(begin)

    instruction_run = paragraph.add_run()
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    instruction_run._r.append(instr)

    separator_run = paragraph.add_run()
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    separator_run._r.append(separate)

    result_run = paragraph.add_run("1")

    end_run = paragraph.add_run()
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    end_run._r.append(end)

    for run in (begin_run, instruction_run, separator_run, result_run, end_run):
        run.font.name = "Aptos"
        run.font.size = Pt(9)
        run.font.color.rgb = MUTED


def clear_paragraph_borders(paragraph) -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    borders = p_pr.find(qn("w:pBdr"))
    if borders is None:
        borders = OxmlElement("w:pBdr")
        p_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "between", "bar"):
        node = borders.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            borders.append(node)
        node.set(qn("w:val"), "nil")


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run("Page ")
    run.font.size = Pt(9)
    run.font.color.rgb = MUTED
    add_field(paragraph, "PAGE")
    run = paragraph.add_run(" of ")
    run.font.size = Pt(9)
    run.font.color.rgb = MUTED
    add_field(paragraph, "NUMPAGES")


def add_heading(doc: Document, text: str, level: int = 1):
    paragraph = doc.add_paragraph(style=f"Heading {level}")
    paragraph.paragraph_format.keep_with_next = True
    paragraph.add_run(text)
    return paragraph


def add_body(doc: Document, text: str, bold_lead: str | None = None):
    paragraph = doc.add_paragraph(style="Body Text")
    if bold_lead and text.startswith(bold_lead):
        paragraph.add_run(bold_lead).bold = True
        paragraph.add_run(text[len(bold_lead) :])
    else:
        paragraph.add_run(text)
    return paragraph


def add_bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        paragraph = doc.add_paragraph(style="List Bullet")
        paragraph.paragraph_format.space_after = Pt(4)
        paragraph.add_run(item)


def add_numbered(doc: Document, items: list[str]) -> None:
    for item in items:
        paragraph = doc.add_paragraph(style="List Number")
        paragraph.paragraph_format.space_after = Pt(5)
        paragraph.add_run(item)


def add_table(
    doc: Document,
    headers: list[str],
    rows: list[list[str]],
    widths: list[float],
    font_size: float = 9.0,
    header_fill: str = NAVY,
    center_columns: set[int] | None = None,
):
    center_columns = center_columns or set()
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    table.rows[0].height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
    set_repeat_table_header(table.rows[0])
    for index, header in enumerate(headers):
        cell = table.rows[0].cells[index]
        set_cell_width(cell, widths[index])
        set_cell_shading(cell, header_fill)
        set_cell_margins(cell)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        paragraph = cell.paragraphs[0]
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        paragraph.paragraph_format.space_after = Pt(0)
        run = paragraph.add_run(header)
        run.bold = True
        run.font.size = Pt(font_size)
        run.font.color.rgb = RGBColor(255, 255, 255)

    for row_index, values in enumerate(rows):
        row = table.add_row()
        prevent_row_split(row)
        fill = "FFFFFF" if row_index % 2 == 0 else PALE_BLUE
        for column_index, value in enumerate(values):
            cell = row.cells[column_index]
            set_cell_width(cell, widths[column_index])
            set_cell_shading(cell, fill)
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            paragraph = cell.paragraphs[0]
            paragraph.paragraph_format.space_after = Pt(0)
            paragraph.paragraph_format.line_spacing = 1.08
            if column_index in center_columns:
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = paragraph.add_run(value)
            run.font.size = Pt(font_size)
            run.font.color.rgb = BLACK

    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(1)
    return table


def add_page_break(doc: Document) -> None:
    paragraph = doc.add_paragraph()
    paragraph.add_run().add_break(WD_BREAK.PAGE)


def configure_document(doc: Document) -> None:
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.78)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.7)
    section.header_distance = Inches(0.32)
    section.footer_distance = Inches(0.28)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Aptos"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos")
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = BLACK
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.12

    body = styles["Body Text"]
    body.font.name = "Aptos"
    body._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos")
    body.font.size = Pt(10.5)
    body.font.color.rgb = BLACK
    body.paragraph_format.space_after = Pt(7)
    body.paragraph_format.line_spacing = 1.14

    title = styles["Title"]
    title.font.name = "Aptos Display"
    title._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos Display")
    title.font.size = Pt(28)
    title.font.bold = True
    title.font.color.rgb = BLACK
    title.paragraph_format.space_after = Pt(12)

    subtitle = styles["Subtitle"]
    subtitle.font.name = "Aptos"
    subtitle._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos")
    subtitle.font.size = Pt(14)
    subtitle.font.color.rgb = MUTED
    subtitle.paragraph_format.space_after = Pt(18)

    for name, size, before, after in (
        ("Heading 1", 18, 12, 7),
        ("Heading 2", 13, 10, 5),
        ("Heading 3", 11, 8, 4),
    ):
        style = styles[name]
        style.font.name = "Aptos Display"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos Display")
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = BLACK
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True

    for list_style in ("List Bullet", "List Number"):
        style = styles[list_style]
        style.font.name = "Aptos"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos")
        style.font.size = Pt(10.5)
        style.font.color.rgb = BLACK
        style.paragraph_format.left_indent = Inches(0.28)
        style.paragraph_format.first_line_indent = Inches(-0.18)
        style.paragraph_format.line_spacing = 1.1

    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.LEFT
    header_run = header.add_run("OnlyMyPDF Phase 1 Implementation Checkpoint")
    header_run.font.name = "Aptos"
    header_run.font.size = Pt(8.5)
    header_run.font.color.rgb = MUTED

    footer = section.footer.paragraphs[0]
    add_page_number(footer)

    doc.core_properties.title = "OnlyMyPDF Phase 1 Dependable Beta Implementation Checkpoint"
    doc.core_properties.subject = "Evidence based implementation and readiness checkpoint"
    doc.core_properties.author = "OnlyMyPDF Development"
    doc.core_properties.comments = "Generated from verified Phase 1 implementation evidence"


def build_document() -> Document:
    doc = Document()
    configure_document(doc)

    cover_spacer = doc.add_paragraph()
    cover_spacer.paragraph_format.space_after = Pt(52)
    title = doc.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    title.add_run("OnlyMyPDF Phase 1 Dependable Beta Implementation Checkpoint")
    clear_paragraph_borders(title)
    subtitle = doc.add_paragraph(style="Subtitle")
    subtitle.add_run("Developer evidence report and live activation gate")

    meta = doc.add_table(rows=4, cols=2)
    meta.alignment = WD_TABLE_ALIGNMENT.LEFT
    meta.autofit = False
    set_table_borders(meta, color="FFFFFF", size="0")
    meta_rows = [
        ("Report date", "18 September 2026"),
        ("Branch", "phase1-dependable-beta"),
        ("Current product readiness", "82 out of 100"),
        ("Phase 1 completion", "100 percent"),
    ]
    for index, (label, value) in enumerate(meta_rows):
        meta.rows[index].cells[0].width = Inches(1.9)
        meta.rows[index].cells[1].width = Inches(4.7)
        for cell in meta.rows[index].cells:
            set_cell_margins(cell, top=75, start=0, bottom=75, end=120)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p1 = meta.rows[index].cells[0].paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(label)
        r1.bold = True
        r1.font.size = Pt(10.5)
        p2 = meta.rows[index].cells[1].paragraphs[0]
        p2.paragraph_format.space_after = Pt(0)
        r2 = p2.add_run(value)
        r2.font.size = Pt(10.5)

    cover_note = doc.add_paragraph(style="Body Text")
    cover_note.paragraph_format.space_before = Pt(34)
    cover_note.add_run("Main conclusion  ").bold = True
    cover_note.add_run(
        "Phase 1 is 100 percent complete against its defined Dependable Beta gate. Persistent worker hosting, private R2 storage, the exact 200 MB path, scheduled cleanup, deletion retry, independent watchdog, and real in-app crash alert are live verified. Final checkpoint commit 5f8df5f is pushed and both Railway services passed post-push health checks. Phase 2 is eligible to start."
    )
    cover_scope = doc.add_paragraph(style="Body Text")
    cover_scope.add_run("Scope  ").bold = True
    cover_scope.add_run(
        "Conversion validity, quality corpus, queue durability, worker recovery, private storage, retention cleanup, upload boundaries, operational telemetry, and release gates."
    )

    add_page_break(doc)
    add_heading(doc, "Decision and current status", 1)
    add_body(
        doc,
        "Phase 1 is implemented and verified at 100 percent against its defined Dependable Beta acceptance gate. Supabase controls, Upstash queueing, private Cloudflare R2 storage, the persistent Railway conversion worker, authenticated health, browser signed upload, exact 25 MB and 200 MB jobs, scheduled retention cleanup, deletion retry, and the independent Railway watchdog all pass.",
    )
    add_body(
        doc,
        "Phase 2 is eligible to start. The remaining limits in this report must stay explicit in planning and customer claims: no finite corpus proves every real world PDF, the 200 MB fixture is not a worst case complex document, and paid ConvertAPI fallback remains unconfigured.",
    )
    add_table(
        doc,
        ["Measure", "Starting point", "Current", "After live gate"],
        [
            ["Product readiness", "70 out of 100", "82 out of 100", "82 out of 100"],
            ["Phase 1 completion", "0 percent", "100 percent", "100 percent"],
            ["Phase 2 status", "Not started", "Eligible to start", "Eligible to start"],
        ],
        [2.1, 1.65, 1.65, 1.65],
        font_size=9.5,
        center_columns={1, 2, 3},
    )
    add_heading(doc, "Environment status", 2)
    add_body(
        doc,
        "Supabase and Upstash are live connected. Migrations 001 through 022 are applied. Cloudflare R2 is private and accepts the exact 200 MB path. The Railway conversion worker is active, runs cleanup on startup and hourly, and reports a fresh heartbeat. The independent Railway watchdog runs every five minutes; healthy and forced failure executions were verified, and the failure produced a real in-app alert.",
    )
    add_table(
        doc,
        ["Configuration", "Status", "Meaning"],
        [
            ["CRON SECRET", "Available", "Local authenticated worker and cleanup routes can run"],
            ["PDF2DOCX PYTHON", "Available", "Local PDF to Word engine can run"],
            ["LIBREOFFICE PATH", "Available", "Local Office conversion engine can run"],
            ["Supabase URL and service role", "Live connected", "25 tables use RLS and 35 public policies"],
            ["Upstash Redis URL and token", "Live connected", "Pending and processing queues plus worker heartbeat verified"],
            ["Cloudflare R2", "Live connected", "Private scoped storage; exact 200 MB upload and cleanup verified"],
            ["Railway worker and watchdog", "Live active", "Post-push worker 07ef7dca and watchdog 7c433e3a verified healthy"],
            ["HEALTH CHECK SECRET", "Available", "Authenticated detailed health returned healthy"],
            ["ConvertAPI secret", "Missing", "Paid fallback is not configured or tested"],
        ],
        [2.35, 1.25, 3.45],
        font_size=9.0,
        center_columns={1},
    )

    add_page_break(doc)
    add_heading(doc, "Issues found and resolved", 1)
    add_body(
        doc,
        "Sixteen reliability gaps were identified and resolved during Phase 1. The live activation work preserved the conversion engine pipeline while adding durable infrastructure, cleanup, health evidence, and alerting.",
    )
    resolved_rows = [
        ["1", "API restart could lose background work", "Persistent FIFO queue, private staged input, and queued running done error lifecycle", "Live Redis and storage passed"],
        ["2", "Worker crash had no recovery path", "Processing list, 15 minute lease recovery, isolated worker command, and constrained worker container", "Persistent Railway worker active"],
        ["3", "A corrupt nonempty output could be marked complete", "Format aware openability, signature, page, slide, sheet, and package checks", "Resolved in code and tests"],
        ["4", "First guest job could fail polling with Access denied", "New guest cookie is forwarded into the same request and response", "Resolved by direct localhost job"],
        ["5", "Conversion outcome and latency were not measurable", "Event telemetry records engine, fallback, queue time, duration, validity, attempts, and failures", "Live events recorded; longer history pending"],
        ["6", "Crashed staged input could survive Redis expiry", "Startup and hourly storage scan removes PDF to Word inputs older than two hours and records failures", "Live deletion failure and retry passed"],
        ["7", "Signed URL could outlive file retention", "URL lifetime is capped by two hours and the database expiry deadline; bucket migration forces private access", "Migration and private policy verified live"],
        ["8", "Declared upload size could differ from returned bytes", "Server rejects size mismatch and enforces exact plan boundaries", "Validator and signed upload passed"],
        ["9", "No declared conversion quality corpus", "Deterministic 200 document corpus covers text, tables, scans, Hindi images, orientation, forms, fonts, and larger files", "Resolved for the tested operations"],
        ["10", "Large files crossed the app request body", "Owner bound signed upload sends configured clients directly to private object storage", "Exact 25 MB and 200 MB paths passed"],
        ["11", "Queued PDF passwords needed safe worker transport", "AES 256 GCM encrypted job payload; secret removed after completion or failure", "Resolved in code and tests"],
        ["12", "A deployed worker could be silently dead", "Upstash heartbeat every 15 seconds; independent Railway watchdog every five minutes exits nonzero on degradation", "Healthy run and real in app crash alert verified"],
        ["13", "Nested abandoned direct uploads escaped cleanup", "Bounded paginated directory traversal removes expired uploads UUID input PDF objects", "Hourly cleanup active"],
        ["14", "Output storage failure could still mark a distributed job done", "Production and Redis jobs fail closed until validated DOCX is in private storage", "Fail closed observed; success path reverified"],
        ["15", "Cleanup cron referenced a missing payments timestamp", "Migration 022 adds payments updated at and every claim transition refreshes it", "Live cleanup completed with zero failures"],
        ["16", "PDF only bucket MIME policy blocked DOCX output", "Private bucket allowlist now includes PDF input and DOCX output", "Browser API and dedicated worker output passed"],
    ]
    add_table(
        doc,
        ["ID", "Problem", "Implemented resolution", "Qualification"],
        resolved_rows,
        [0.45, 2.0, 3.1, 1.5],
        font_size=7.7,
        center_columns={0},
    )

    add_heading(doc, "Verification evidence", 1)
    add_body(
        doc,
        "The following results come from actual generated files, opened output packages, rendered comparisons, direct localhost API use, automated tests, type checking, linting, a production build, and a production dependency audit.",
    )
    evidence_rows = [
        ["Declared corpus", "Pass", "200 of 200 jobs succeeded against a 99.5 percent threshold"],
        ["Extractable text", "Pass", "155 of 155 applicable marker checks passed"],
        ["Rendered fidelity", "Pass", "40 of 40 comparisons passed; minimum similarity 97.99 percent"],
        ["Simple latency", "Pass", "Corpus p95 was 309 ms, below 15 seconds"],
        ["Office engines", "Pass", "7 of 7 PDF and Office conversions opened successfully"],
        ["PDF to Word", "Pass", "Word COM; 14.353 s; valid DOCX; 1,330 extracted characters"],
        ["PDF to Excel", "Pass", "2.126 s; valid workbook; two worksheets"],
        ["PDF to PowerPoint text", "Pass", "3.617 s; two slides; 1,330 characters; two editable slides reported"],
        ["PDF to PowerPoint scan", "Pass with limit", "3.353 s; valid two slide image presentation; no text expected"],
        ["Office to PDF", "Pass", "Word 3.313 s; Excel 3.678 s; PowerPoint 5.989 s"],
        ["Live localhost API job", "Pass", "1,096,734 byte PDF to 66,511 byte DOCX; 1.423 s queue; 4.851 s processing"],
        ["Artifact validation", "Pass", "DOCX signature and openability valid; 19 entries; one page; 1,052 text characters"],
        ["Protected download", "Pass", "First valid DOCX returned; repeated consume returned 404"],
        ["Live Supabase Upstash and R2", "Pass", "Private storage; queue depth zero; worker heartbeat healthy; scoped credentials"],
        ["Railway conversion worker", "Pass", "Post-push deployment 07ef7dca active; ready; queue pending zero processing zero"],
        ["Exact 25 MB worker path", "Pass", "26,214,400 byte PDF; 4.688 s queue; 2.573 s processing; valid DOCX"],
        ["Exact 200 MB worker path", "Pass", "209,715,200 byte R2 input; 20.630 s upload; 3.050 s queue; 8.963 s processing"],
        ["200 MB cleanup", "Pass", "Valid 66,627 byte DOCX; input and output removed; R2 prefix count zero"],
        ["Browser signed upload", "Pass", "Upload grant 201; direct private upload; job 202; DOCX download 200"],
        ["Authenticated cleanup", "Pass", "Completed run; zero file session and job deletion failures"],
        ["Retention deletion retry", "Pass", "Controlled failure deleted zero failed one; retry deleted one failed zero; marker gone"],
        ["Independent watchdog", "Pass", "Post-push deployment 7c433e3a; 04:25 runs healthy; idle worker; empty queue; forced false"],
        ["Alert delivery", "Pass", "Forced unhealthy run crashed and Railway delivered an in app Deployment crashed alert"],
        ["Authenticated health", "Pass", "All critical checks healthy; queue pending zero and processing zero"],
        ["Upload limits", "Pass live", "Exact 25 MB and 200 MB paths completed end to end"],
        ["Targeted reliability tests", "Pass", "5 of 5 across updated worker cleanup and health files"],
        ["Regression baseline", "Pass", "605 of 605 across 124 files before final infrastructure activation"],
        ["Type checking", "Pass", "TypeScript completed with no errors after final code changes"],
        ["Lint baseline", "Pass", "Zero errors and 18 existing warnings"],
        ["Production build baseline", "Pass", "154 of 154 static pages; upload and worker routes generated"],
        ["Production dependencies", "Pass", "Zero moderate high or critical production vulnerabilities"],
    ]
    add_table(
        doc,
        ["Gate", "Result", "Measured evidence"],
        evidence_rows,
        [2.0, 1.2, 4.05],
        font_size=8.7,
        center_columns={1},
    )

    add_heading(doc, "Phase 1 workstream status", 1)
    add_body(
        doc,
        "The completion score now includes both local implementation and live production activation evidence. Every weighted Phase 1 workstream reached its defined gate.",
    )
    workstream_rows = [
        ["200 document quality corpus", "20 percent", "20 percent", "Local gate passed"],
        ["Output validation and fidelity evidence", "15 percent", "15 percent", "Local gate passed"],
        ["Engine routing and fallback evidence", "10 percent", "10 percent", "Local gate passed"],
        ["Queue worker retry and crash recovery", "20 percent", "20 percent", "Persistent Railway worker and recovery controls verified"],
        ["Private storage and deletion evidence", "15 percent", "15 percent", "Private R2 and failed deletion retry verified"],
        ["25 and 200 MB upload path", "10 percent", "10 percent", "Both exact size paths passed end to end"],
        ["Monitoring and alerting", "10 percent", "10 percent", "Scheduled watchdog and real in app crash alert verified"],
        ["Total", "100 percent", "100 percent", "Phase 2 eligible"],
    ]
    add_table(
        doc,
        ["Workstream", "Weight", "Complete", "Status"],
        workstream_rows,
        [3.0, 1.1, 1.1, 2.05],
        font_size=9.0,
        center_columns={1, 2},
    )
    add_heading(doc, "Implemented processing path", 2)
    add_body(
        doc,
        "The PDF to Word path now follows a durable job lifecycle. Configured browsers upload large files directly to private storage with an owner bound grant. A queue entry is created, an isolated worker heartbeat proves the worker is alive, the worker claims and validates the input, conversion attempts and fallback are recorded, the output must persist to private storage, and the protected download is consumed once. Cleanup recursively removes expired staged input.",
    )
    add_table(
        doc,
        ["Stage", "Responsibility", "Recorded evidence"],
        [
            ["Request", "Validate plan limit owner and declared input bytes", "Owner and input size"],
            ["Direct upload", "Issue an expiring owner bound private storage grant", "Path size owner and one time claim"],
            ["Queue", "Persist FIFO job and staged private input", "Queued time and depth"],
            ["Worker", "Claim recover retry and route engines", "Attempts engines fallback and duration"],
            ["Validation", "Open and inspect final artifact", "Validity type counts and text"],
            ["Delivery", "Authorize and consume protected result", "Downloaded once then unavailable"],
            ["Cleanup", "Delete expired rows and staged objects", "Deleted and failed counts"],
        ],
        [1.2, 3.35, 2.7],
        font_size=9.0,
    )

    add_heading(doc, "Required live activation gate", 1)
    add_body(
        doc,
        "All six live activation actions are complete with reviewable runtime or artifact evidence.",
    )
    live_items = [
        "Completed: configure Supabase and Upstash, apply migrations 001 through 022, and verify object storage is private.",
        "Completed: deploy the dedicated conversion worker from Dockerfile.worker on Railway and verify its live Upstash heartbeat.",
        "Completed: call authenticated health and confirm private storage, fresh worker heartbeat, dedicated mode, queue depth, output validity, conversion latency, fallback rate, and cleanup status are healthy.",
        "Completed: run production cleanup on worker startup and hourly with a two hour TTL, then verify one controlled R2 deletion failure and successful retry.",
        "Completed: run exact 25 MB and 200 MB PDF to Word paths end to end and validate the downloaded DOCX artifacts.",
        "Completed: run an independent Railway watchdog every five minutes, verify healthy and forced unhealthy executions, and record a real in app crash alert.",
        "Completed: push final checkpoint commit 5f8df5f to GitHub and verify successful post-push Railway worker and watchdog deployments.",
    ]
    add_numbered(doc, live_items)
    add_heading(doc, "Acceptance evidence", 2)
    add_table(
        doc,
        ["Check", "Required proof", "Completion rule"],
        [
            ["Migration and storage", "Migration history and private bucket policy", "No public object read is possible"],
            ["Queue and worker", "Worker log plus queued running done lifecycle", "Restart does not lose a job"],
            ["Cleanup", "Cleanup run record plus failure and retry result", "Expired inputs are removed and failures remain retryable"],
            ["25 MB Free path", "End to end timing and valid downloaded artifact", "Plan limit and output contract pass"],
            ["200 MB Pro path", "End to end timing resource use and valid artifact", "No proxy storage or worker truncation"],
            ["Monitoring", "Healthy and forced failure watchdog runs plus delivered alert", "A responsible operator receives degradation evidence"],
        ],
        [1.65, 3.65, 1.95],
        font_size=9.0,
    )

    add_heading(doc, "Files and reproducible evidence", 1)
    add_body(
        doc,
        "The repository keeps the generators, reports, migration, tests, and operational documentation needed to reproduce this checkpoint.",
    )
    add_table(
        doc,
        ["Purpose", "Repository path"],
        [
            ["Phase 1 checkpoint", "docs/PHASE_1_IMPLEMENTATION_CHECKPOINT.md"],
            [
                "Corpus and API evidence",
                "quality/phase1-corpus/manifest.json; latest-report.json; engine-report.json; "
                "upload-boundary-report.json; local-api-smoke-report.json; live-200mb-report.json; "
                "retention-retry-report.json",
            ],
            ["Operational migrations", "supabase/migrations/021 and 022"],
            [
                "Worker stack",
                "scripts/phase1-dedicated-worker-smoke.ts; scripts/phase1-live-200mb.ts; "
                "workers/conversion-worker.ts; workers/conversion-watchdog.ts; Dockerfile.worker",
            ],
            [
                "Validation and telemetry",
                "src/lib/services/conversion-output-validation.ts; src/lib/ops/conversion-telemetry.ts",
            ],
            ["Health and operations", "src/app/api/health/route.ts; docs/OPERATIONS.md"],
        ],
        [2.35, 4.9],
        font_size=8.8,
    )
    add_heading(doc, "Final phase decision", 2)
    add_body(
        doc,
        "Phase 1 is 100 percent complete against its Dependable Beta acceptance gate. Live data services, private R2 storage, persistent conversion worker, independent watchdog, health, cleanup, exact 25 MB and 200 MB paths, deletion retry, and in app crash alert are verified. Phase 2 is eligible to start.",
    )
    add_body(
        doc,
        "Keep the evidence reports and Railway configuration with this checkpoint. Re-run the live gates after material storage, queue, worker, retention, or conversion changes.",
    )
    add_heading(doc, "Known limits", 2)
    add_bullets(
        doc,
        [
            "The corpus proves the tested operations and fixtures. It does not prove that every real world PDF can be converted with identical layout.",
            "The exact 200 MB fixture is a valid PDF extended to the exact boundary with zero padding. It proves the transfer and processing path, not a worst case complex 200 MB content benchmark.",
            "The image only scan presentation is valid by design and contains no extractable text. OCR quality is a separate product capability.",
            "Paid ConvertAPI fallback remains unconfigured and unverified.",
            "Railway delivered the controlled crash alert in app. Email and in app crash notifications are enabled, but mailbox delivery was not separately inspected.",
        ],
    )

    return doc


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = build_document()
    document.save(OUTPUT)
    print(f"Created {OUTPUT}")
    print(f"Bytes {OUTPUT.stat().st_size}")


if __name__ == "__main__":
    main()
