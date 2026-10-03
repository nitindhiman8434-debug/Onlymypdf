#!/usr/bin/env python3
"""Synthetic, offline-generated PDF corpus and loopback-only conversion diagnostic.

No conversion implementation is changed. All artifacts stay in ignored tmp/.
The committed report contains synthetic fixture measurements only.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import http.cookiejar
import ipaddress
import json
import platform
import posixpath
import re
import shutil
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "tmp" / "pdfs" / "phase3.2"
REPORT = ROOT / "quality" / "phase3-document-corpus" / "latest-report.json"
TOOLS = {"pdf-to-word": ".docx", "pdf-to-excel": ".xlsx", "pdf-to-ppt": ".pptx"}
MIMES = {".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
         ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
         ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"}
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
S = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG_R = "{http://schemas.openxmlformats.org/package/2006/relationships}"
MAX_DOWNLOAD_BYTES = 128 * 1024 * 1024
LIMITATIONS = [
    "Synthetic selectable-text fixtures on one local machine; not real customer evidence or production capacity.",
    "Marker occurrence checks measure selected text and numeric preservation, not universal accuracy, reading order or visual fidelity.",
    "Unicode NFC and whitespace removal are used for comparisons; accents, script characters and decimal punctuation are retained.",
    "Numeric checks are strict lexical preservation of raw Office values; equivalent displayed Excel formatting is not evaluated and may fail this diagnostic.",
    "Excel primary and Source text recovery representations are counted separately; coverage uses their maximum occurrence count, not their sum. Recovery coverage does not prove correct table cells.",
    "PowerPoint notes are measured separately and never counted as visible editable on-slide text.",
    "No image-only scanned PDF, OCR recognition, handwritten text, Arabic, CJK, or accessibility semantics are evaluated.",
    "Hindi fixtures use simple text; complex conjunct coverage is excluded because this local PDF generator cannot preserve those source glyph mappings reliably.",
    "No external APIs, downloads, paid services, or cloud deployment are used by this runner.",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(value: str) -> str:
    """Allow line/run spacing and canonical Unicode only, never transliteration."""
    return unicodedata.normalize("NFC", re.sub(r"\s+", "", value))


def marker_check(text: str, expected: list[dict]) -> dict:
    normalized = normalize_text(text)
    counts, missing, duplicated = [], [], []
    for marker in expected:
        needle = normalize_text(marker["text"])
        if not needle:
            raise ValueError("Empty normalized marker is invalid")
        actual = normalized.count(needle)
        row = {"text": marker["text"], "expected": marker["expected"], "actual": actual}
        counts.append(row)
        if actual < marker["expected"]:
            missing.append(row)
        elif actual > marker["expected"]:
            duplicated.append(row)
    return {"passed": not missing and not duplicated, "missing": missing,
            "duplicated": duplicated, "counts": counts}


def markers(*values: str, repeats: dict[str, int] | None = None) -> list[dict]:
    return [{"text": value, "expected": 1} for value in values] + [
        {"text": value, "expected": count} for value, count in (repeats or {}).items()
    ]


def p(value: str) -> str:
    return f"<p>{html.escape(value)}</p>"


def table(rows: list[list[str]]) -> str:
    return "<table>" + "".join("<tr>" + "".join(f"<td>{html.escape(v)}</td>" for v in row)
                              + "</tr>" for row in rows) + "</table>"


def case_definitions() -> list[dict]:
    # All people, organizations, dates and invoice amounts are fictional test data.
    hindi = "<h1>सादा हिंदी नमूना</h1>" + p("यह नया काम है। नाम सीमा है। योजना पूरी है।")
    hindi += p("सभी पेज का पाठ देखो। यह केवल एक नमूना है।")
    hindi += table([["नाम", "मान"], ["पहचान", "HINDI_2026_017"],
                    ["कुल राशि", "12345.67"], ["अंतिम संकेत", "HINDI_END_917"]])
    bilingual = "<h1>नमूना चालान / Synthetic invoice</h1>" + p("Invoice INV_BI_2048")
    bilingual += table([["विवरण / Item", "Quantity", "Unit price", "Line total"],
                        ["सेवा / Service", "2", "125.25", "250.50"],
                        ["सहायता / Support", "3", "10.20", "30.60"]])
    bilingual += p("कुल देय राशि / Amount due INR 281.10") + p("BI_END_864")
    french = "<h1>Facture synthétique — français</h1>" + p("Référence FR_INV_4821")
    french += p("Société Démonstration — Élise, reçu à Noël")
    french += table([["Désignation", "Prix"], ["Crème brûlée", "12,50"],
                     ["Frais de dossier", "1 234,56"], ["Total dû", "1 247,06"],
                     ["Valeur littérale de test", "=2+3"]])
    french += p("FR_END_729")
    german = "<h1>Synthetische Rechnung — Deutsch</h1>" + p("Rechnung DE_INV_0084")
    german += p("Prüfung für Größe, Straße und äußere Maße")
    german += table([["Bezeichnung", "Wert"], ["Artikelkennung", "001234"],
                     ["Zwischensumme", "1.234,56"], ["Korrektur", "−12,50"],
                     ["Endsumme", "1.222,06"], ["Wörtlicher Testwert", "@SUM(1,2)"]])
    german += p("DE_END_635")
    mixed_pages = []
    for width, height, title, token, value in [
        (595, 842, "Portrait first page", "MIX_FIRST_111", "4821.09"),
        (842, 595, "Landscape middle page", "MIX_MIDDLE_222", "6723.40"),
        (595, 842, "Portrait last page", "MIX_LAST_333", "8965.72"),
    ]:
        mixed_pages.append({"size": (width, height), "html": f"<h1>{title}</h1>" + p(token)
                            + p("Repeated section marker") + table([["Reference", "Value"], [token + "-ROW", value]])})
    column_pages = []
    column_markers = []
    for page_no in range(1, 3):
        columns = []
        for column_no in range(1, 3):
            paragraphs = []
            for paragraph_no in range(1, 5):
                token = f"COL_{page_no}{column_no}{paragraph_no}_CHECK"
                column_markers.append(token)
                paragraphs.append(p(token + " — The test records document quality across each page. "
                                    "A readable result preserves identifiers and editable content. "
                                    "Different paragraphs must remain available after conversion. "
                                    "These are synthetic observations, with no customer information."))
            columns.append("<h2>Column " + str(column_no) + "</h2>" + "".join(paragraphs))
        column_pages.append({"size": (595, 842), "columns": columns,
                             "title": f"Dense two-column diagnostic — page {page_no}"})
    return [
        {"caseId": "hindi-memo", "label": "Hindi memo", "language": "hi", "documentClass": "memo",
         "pages": [{"size": (595, 842), "html": hindi}],
         "markers": markers("सादा हिंदी नमूना", "यह नया काम है। नाम सीमा है। योजना पूरी है।", "सभी पेज का पाठ देखो। यह केवल एक नमूना है।", "कुल राशि", "HINDI_2026_017", "12345.67", "HINDI_END_917")},
        {"caseId": "bilingual-invoice", "label": "Hindi and English invoice", "language": "hi-en", "documentClass": "invoice",
         "pages": [{"size": (595, 842), "html": bilingual}],
         "markers": markers("नमूना चालान", "सेवा", "कुल देय राशि", "INV_BI_2048", "125.25", "250.50", "30.60", "281.10", "BI_END_864")},
        {"caseId": "french-invoice", "label": "French accented invoice", "language": "fr", "documentClass": "invoice",
         "pages": [{"size": (595, 842), "html": french}],
         "markers": markers("Référence", "Société Démonstration", "Crème brûlée", "FR_INV_4821", "1 234,56", "1 247,06", "=2+3", "FR_END_729")},
        {"caseId": "german-invoice", "label": "German decimals and identifiers", "language": "de", "documentClass": "invoice",
         "pages": [{"size": (595, 842), "html": german}],
         "markers": markers("Prüfung", "Straße", "DE_INV_0084", "001234", "1.234,56", "−12,50", "1.222,06", "@SUM(1,2)", "DE_END_635")},
        {"caseId": "mixed-orientation", "label": "Mixed page orientation", "language": "en", "documentClass": "mixed-orientation",
         "pages": mixed_pages,
         "markers": markers("4821.09", "6723.40", "8965.72", repeats={"MIX_FIRST_111": 2, "MIX_MIDDLE_222": 2, "MIX_LAST_333": 2, "Repeated section marker": 3})},
        {"caseId": "two-column-article", "label": "Dense two-column article", "language": "en", "documentClass": "two-column",
         "pages": column_pages,
         "markers": markers(*column_markers, repeats={"document quality": 16})},
    ]


def find_fonts(destination: Path) -> dict[str, str]:
    candidates = {
        "latin": [Path("C:/Windows/Fonts/arial.ttf"), Path("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"),
                  Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")],
        "devanagari": [Path("C:/Windows/Fonts/Nirmala.ttc"),
                       Path("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf"),
                       Path("/usr/share/fonts/opentype/noto/NotoSansDevanagari-Regular.ttf")],
    }
    destination.mkdir(parents=True, exist_ok=True)
    selected = {}
    for family, options in candidates.items():
        source = next((candidate for candidate in options if candidate.is_file()), None)
        if source is None:
            raise FileNotFoundError(f"No local {family} font found. Install a local Noto font; runner never downloads fonts.")
        target = destination / (family + ".ttf")
        if source.suffix.lower() == ".ttc":
            from fontTools.ttLib import TTCollection

            collection = TTCollection(str(source))
            collection.fonts[0].save(str(target))
            collection.close()
        else:
            shutil.copyfile(source, target)
        selected[family] = str(source)
        selected[family + "Asset"] = target.name
    return selected


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def generate_fixture(case: dict, font_dir: Path, fonts: dict) -> dict:
    import fitz

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    path = ARTIFACTS / (case["caseId"] + ".pdf")
    css = (f"@font-face{{font-family:Latin;src:url('{fonts['latinAsset']}');}}"
           f"@font-face{{font-family:Devanagari;src:url('{fonts['devanagariAsset']}');}}"
           "body{font-family:Latin;font-size:12pt;color:#15243b;}.hindi{font-family:Devanagari;}"
           "h1{font-size:21pt;color:#204e80;}h2{font-size:14pt;}p{margin:12px 0;}"
           "table{border-collapse:collapse;width:100%;margin-top:16px;}"
           "td{border:1px solid #8ba0b8;padding:8px;font-size:11pt;}")
    archive = fitz.Archive(str(font_dir))
    pdf = fitz.open()
    for spec in case["pages"]:
        width, height = spec["size"]
        page = pdf.new_page(width=width, height=height)
        boxes = [(fitz.Rect(42, 36, width - 42, height - 36), spec.get("html", ""), css)]
        if "columns" in spec:
            boxes = [(fitz.Rect(42, 30, width - 42, 105), "<h1>" + spec["title"] + "</h1>", css)]
            for column_no, content in enumerate(spec["columns"]):
                x = 42 + column_no * 265
                boxes.append((fitz.Rect(x, 110, x + 246, height - 36), content,
                              css + "body{font-size:10pt;}p{margin:10px 0;}"))
        for rect, content, block_css in boxes:
            content = re.sub(r"[\u0900-\u097f]+", lambda match: '<span class="hindi">' + match[0] + '</span>', content)
            spare, _ = page.insert_htmlbox(rect, content, css=block_css, archive=archive, scale_low=1)
            if spare < 0:
                pdf.close()
                raise ValueError(f"Fixture text does not fit: {case['caseId']}")
    pdf.save(path, garbage=4, deflate=True)
    pdf.close()
    previews = []
    with fitz.open(path) as reopened:
        text = "\n".join(page.get_text(sort=False) for page in reopened)
        dimensions = []
        for index, page in enumerate(reopened):
            preview = ARTIFACTS / f"{case['caseId']}-page-{index + 1}.png"
            page.get_pixmap(matrix=fitz.Matrix(1.1, 1.1), alpha=False).save(preview)
            previews.append(relative(preview))
            dimensions.append({"width": page.rect.width, "height": page.rect.height})
        source = {"path": relative(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                  "pages": len(reopened), "bytes": path.stat().st_size, "selectableTextChars": len(text),
                  "expectedMarkers": case["markers"], "markerCheck": marker_check(text, case["markers"]),
                  "previewPaths": previews, "pageDimensions": dimensions,
                  "fontFiles": {key: Path(value).name for key, value in fonts.items() if not key.endswith("Asset")}}
    return source


def contact_sheet(cases: list[dict]) -> str | None:
    from PIL import Image, ImageDraw

    previews = [(case["caseId"], path) for case in cases for path in case.get("source", {}).get("previewPaths", [])]
    if not previews:
        return None
    width, height, columns = 310, 460, 3
    sheet = Image.new("RGB", (columns * width, ((len(previews) + columns - 1) // columns) * height), "#e9eef5")
    draw = ImageDraw.Draw(sheet)
    for index, (label, path) in enumerate(previews):
        image = Image.open(ROOT / path).convert("RGB")
        image.thumbnail((width - 18, height - 38))
        x, y = (index % columns) * width, (index // columns) * height
        draw.text((x + 9, y + 8), label, fill="#15243b")
        sheet.paste(image, (x + (width - image.width) // 2, y + 30))
    target = ARTIFACTS / "contact-sheet.png"
    sheet.save(target)
    return relative(target)


def validate_base_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ("http", "https") or parsed.username or parsed.password:
        raise ValueError("Only http(s) loopback URLs without credentials are allowed")
    host = parsed.hostname or ""
    try:
        loopback = host == "localhost" or ipaddress.ip_address(host).is_loopback
    except ValueError:
        loopback = host == "localhost"
    if not loopback or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ValueError("Target must be a loopback origin, for example http://127.0.0.1:3001")
    _ = parsed.port  # Reject malformed port syntax before any request.
    return url.rstrip("/")


class LoopbackRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, origin: str):
        self.origin = origin

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlsplit(newurl)
        target_origin = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
        validate_base_url(target_origin)
        if target_origin != self.origin:
            raise ValueError("Redirect to another origin refused")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class LocalTransport:
    def __init__(self, base_url: str, deadline_seconds: float):
        self.base_url = validate_base_url(base_url)
        self.deadline = time.monotonic() + deadline_seconds
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}),
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()), LoopbackRedirectHandler(self.base_url))

    def request(self, path: str, body: bytes | None = None, content_type: str | None = None,
                word: bool = False) -> tuple[int, bytes, dict]:
        if not path.startswith("/") or path.startswith("//"):
            raise ValueError("Only relative API paths are allowed")
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Conversion deadline exceeded")
        headers = {"Origin": self.base_url, "User-Agent": "OnlyMyPDF-local-document-corpus/1"}
        if content_type:
            headers["Content-Type"] = content_type
        if word:
            headers["X-Pdf-To-Word-Job"] = "1"
        req = urllib.request.Request(self.base_url + path, data=body, headers=headers,
                                     method="POST" if body is not None else "GET")
        try:
            response = self.opener.open(req, timeout=min(90, remaining))
        except urllib.error.HTTPError as error:
            response = error
        with response:
            chunks, total = [], 0
            while True:
                if time.monotonic() >= self.deadline:
                    raise TimeoutError("Download exceeded conversion deadline")
                chunk = response.read(64 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_DOWNLOAD_BYTES:
                    raise ValueError("Response exceeded local diagnostic download limit")
                chunks.append(chunk)
            return response.code, b"".join(chunks), {key.lower(): value for key, value in response.headers.items()}


def multipart(pdf_path: Path, word: bool) -> tuple[bytes, str]:
    boundary = "onlymypdf-corpus-" + uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{pdf_path.name}"\r\n'
            'Content-Type: application/pdf\r\n\r\n').encode() + pdf_path.read_bytes() + b"\r\n"
    if word:
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="options"\r\n\r\n{{}}\r\n'.encode()
    body += f"--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def convert(pdf_path: Path, tool: str, base_url: str, timeout: float) -> tuple[int, bytes, dict, str | None, float]:
    started = time.monotonic()
    transport = LocalTransport(base_url, timeout)
    payload, content_type = multipart(pdf_path, tool == "pdf-to-word")
    status, body, headers = transport.request("/api/tools/" + tool, payload, content_type, tool == "pdf-to-word")
    engine = None
    if tool == "pdf-to-word" and status == 202:
        job_id = json.loads(body)["jobId"]
        if not isinstance(job_id, str) or not job_id or len(job_id) > 200:
            raise ValueError("Invalid job identifier")
        query = urllib.parse.urlencode({"jobId": job_id})
        while True:
            status, body, headers = transport.request("/api/tools/pdf-to-word/status?" + query)
            if status != 200:
                break
            state = json.loads(body)
            if state.get("status") == "error":
                status = 500
                break
            if state.get("status") == "done":
                engine = state.get("engine")
                status, body, headers = transport.request("/api/tools/pdf-to-word/download?" + query)
                break
            if time.monotonic() + 1 >= transport.deadline:
                raise TimeoutError("Word queue polling deadline exceeded")
            time.sleep(1)
    return status, body, headers, engine, time.monotonic() - started


def xml_text(root: ET.Element, tag: str) -> str:
    return " ".join(node.text or "" for node in root.iter(tag))


def combine_marker_checks(primary: dict, recovery: dict) -> dict:
    counts = []
    for left, right in zip(primary["counts"], recovery["counts"]):
        counts.append({"text": left["text"], "expected": left["expected"],
                       "actual": max(left["actual"], right["actual"]),
                       "primaryActual": left["actual"], "recoveryActual": right["actual"]})
    missing = [row for row in counts if row["actual"] < row["expected"]]
    duplicated = [row for row in counts if row["actual"] > row["expected"]]
    return {"passed": not missing and not duplicated, "missing": missing, "duplicated": duplicated,
            "counts": counts, "representationRule": "max(primary occurrences, recovery text occurrences); metadata excluded"}


def excel_semantic_checks(rows: list[dict], case_id: str | None) -> list[dict]:
    requirements = {
        "french-invoice": [{"id": "french-decimal-table-cell", "rowLabel": "Crème brûlée", "kind": "number", "value": "12.5"}],
        "german-invoice": [{"id": "german-leading-zero-identifier", "rowLabel": "Artikelkennung", "kind": "string", "value": "001234"}],
    }
    results = []
    for requirement in requirements.get(case_id, []):
        candidates = []
        for row in rows:
            label_index = next((index for index, cell in enumerate(row["cells"])
                                if normalize_text(cell["value"]) == normalize_text(requirement["rowLabel"])), None)
            if label_index is not None:
                candidates.extend({"sheet": row["sheet"], **cell} for cell in row["cells"][label_index + 1:])
        matches = []
        for cell in candidates:
            matching = cell["kind"] == requirement["kind"]
            if requirement["kind"] == "number":
                try:
                    matching = matching and Decimal(cell["value"]) == Decimal(requirement["value"])
                except InvalidOperation:
                    matching = False
            else:
                matching = matching and cell["value"] == requirement["value"]
            matches.append(matching)
        # A backup sheet cannot satisfy a requirement for the typed primary row.
        passed = bool(candidates) and any(matches) and all(matches)
        results.append({"id": requirement["id"], "rowLabel": requirement["rowLabel"],
                        "expected": {"kind": requirement["kind"], "value": requirement["value"]},
                        "actualPrimaryCells": candidates, "passed": passed})
    return results


def inspect_excel(archive: zipfile.ZipFile, expected: list[dict], case_id: str | None) -> tuple[str, dict]:
    names = archive.namelist()
    rels_path = "xl/_rels/workbook.xml.rels"
    if rels_path not in names:
        raise ValueError("Missing workbook worksheet relationships")
    relationships = {}
    for node in ET.fromstring(archive.read(rels_path)).findall(PKG_R + "Relationship"):
        if node.get("TargetMode") == "External":
            continue
        target = node.get("Target", "")
        relationships[node.get("Id")] = posixpath.normpath(target.lstrip("/") if target.startswith("/") else posixpath.join("xl", target))
    sheets = []
    for node in ET.fromstring(archive.read("xl/workbook.xml")).iter(S + "sheet"):
        target = relationships.get(node.get(R + "id"))
        if not target or target not in names or not target.startswith("xl/worksheets/"):
            raise ValueError("Invalid or missing worksheet relationship")
        sheets.append((node.get("name", ""), target))
    if not sheets:
        raise ValueError("Missing worksheet XML")
    shared = []
    if "xl/sharedStrings.xml" in names:
        shared = [xml_text(node, S + "t") for node in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall(S + "si")]
    primary, recovery, primary_rows, formulas, populated = [], [], [], [], 0
    sheet_names = []
    for title, part in sheets:
        sheet_names.append(title)
        rows = []
        for row in ET.fromstring(archive.read(part)).iter(S + "row"):
            cells = []
            for cell in row.findall(S + "c"):
                reference = cell.get("r", "?")
                if cell.find(S + "f") is not None:
                    formulas.append({"sheet": title, "cell": reference})
                    continue
                node = cell.find(S + "v")
                kind = "string" if cell.get("t") in ("s", "inlineStr", "str") else "number"
                if cell.get("t") == "s" and node is not None:
                    index = int(node.text or "-1")
                    if not 0 <= index < len(shared):
                        raise ValueError("Invalid shared string index")
                    value = shared[index]
                elif cell.get("t") == "inlineStr":
                    value = xml_text(cell, S + "t")
                elif node is not None:
                    value = node.text or ""
                else:
                    continue
                cells.append({"cell": reference, "kind": kind, "value": value})
                populated += 1
            rows.append({"sheet": title, "cells": cells})
        if title.casefold() == "source text":
            if not rows:
                raise ValueError("Empty Source text recovery sheet")
            header = rows[0]["cells"]
            text_header = next((cell for cell in header if cell["value"] == "Selectable text not fully mapped to table cells"), None)
            page_header = next((cell for cell in header if cell["value"] == "Page"), None)
            if not text_header or not page_header:
                raise ValueError("Unknown Source text recovery schema")
            text_column = re.sub(r"\d", "", text_header["cell"])
            page_column = re.sub(r"\d", "", page_header["cell"])
            for row in rows[1:]:
                page_cell = next((cell for cell in row["cells"] if re.sub(r"\d", "", cell["cell"]) == page_column), None)
                if not page_cell or not page_cell["value"].isdigit():
                    continue  # Exclude Info, header and page-number metadata.
                recovery.extend(cell["value"] for cell in row["cells"]
                                if re.sub(r"\d", "", cell["cell"]) == text_column)
        else:
            primary_rows.extend(rows)
            primary.extend(cell["value"] for row in rows for cell in row["cells"])
    primary_text, recovery_text = "\n".join(primary), "\n".join(recovery)
    primary_check, recovery_check = marker_check(primary_text, expected), marker_check(recovery_text, expected)
    return primary_text + "\n" + recovery_text, {
        "sheets": len(sheets), "sheetNames": sheet_names, "populatedLiteralCells": populated,
        "formulaCells": formulas, "primaryTextChars": len(primary_text), "recoveryTextChars": len(recovery_text),
        "primaryMarkerCheck": primary_check, "recoveryMarkerCheck": recovery_check,
        "markerCheck": combine_marker_checks(primary_check, recovery_check),
        "semanticChecks": excel_semantic_checks(primary_rows, case_id),
    }


def inspect_office(path: Path, extension: str, expected: list[dict], case_id: str | None = None) -> dict:
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Office package contains duplicate entry names")
        bad = archive.testzip()
        if bad:
            raise ValueError("ZIP CRC failure: " + bad)
        required = {".docx": "word/document.xml", ".xlsx": "xl/workbook.xml", ".pptx": "ppt/presentation.xml"}[extension]
        for part in ("[Content_Types].xml", required):
            if part not in names:
                raise ValueError("Missing required Office XML: " + part)
            ET.fromstring(archive.read(part))
        details = {"zipCrcPassed": True, "requiredPartsPresent": True}
        if extension == ".docx":
            text = xml_text(ET.fromstring(archive.read(required)), W + "t")
            details["mediaParts"] = sum(name.startswith("word/media/") for name in names)
        elif extension == ".xlsx":
            text, excel_details = inspect_excel(archive, expected, case_id)
            details.update(excel_details)
        else:
            slides = sorted(name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name))
            if not slides:
                raise ValueError("Missing slide XML")
            text = "\n".join(xml_text(ET.fromstring(archive.read(name)), A + "t") for name in slides)
            notes = "\n".join(xml_text(ET.fromstring(archive.read(name)), A + "t") for name in names
                               if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name))
            details.update({"slides": len(slides), "onSlideTextChars": len(text), "notesTextChars": len(notes),
                            "notesMarkerCheck": marker_check(notes, expected)})
        check = details.get("markerCheck", marker_check(text, expected))
        details.update({"editableTextChars": len(text), "markerCheck": check,
                        "passed": check["passed"] and not details.get("formulaCells")
                        and all(item["passed"] for item in details.get("semanticChecks", []))})
        return details


def main() -> int:
    import fitz
    import PIL

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generate-only", action="store_true", help="Build/validate PDF fixtures without making HTTP requests")
    parser.add_argument("--case", action="append", choices=[case["caseId"] for case in case_definitions()])
    parser.add_argument("--tool", action="append", choices=list(TOOLS))
    parser.add_argument("--base-url", default="http://127.0.0.1:3001")
    parser.add_argument("--timeout", type=float, default=180, help="Bounded seconds per route, default 180")
    parser.add_argument("--report", type=Path, default=REPORT)
    args = parser.parse_args()
    base_url = validate_base_url(args.base_url)
    if not 1 <= args.timeout <= 600:
        parser.error("--timeout must be between 1 and 600 seconds")
    report = {"schemaVersion": 1, "generatedAt": utc_now(), "scope": "local", "baseUrl": base_url,
              "mode": "generate-only" if args.generate_only else "conversion", "limitations": LIMITATIONS,
              "environment": {"python": platform.python_version(), "os": platform.system(),
                              "architecture": platform.machine(), "pymupdf": fitz.VersionBind, "pillow": PIL.__version__},
              "cases": [], "results": []}
    font_dir = ARTIFACTS / "fonts"
    fonts = find_fonts(font_dir)
    selected = [case for case in case_definitions() if not args.case or case["caseId"] in args.case]
    for case in selected:
        item = {key: case[key] for key in ("caseId", "label", "language", "documentClass")}
        try:
            item["source"] = generate_fixture(case, font_dir, fonts)
            item["status"] = "passed" if item["source"]["markerCheck"]["passed"] else "failed"
        except Exception as error:
            item.update({"status": "error", "error": f"{type(error).__name__}: {error}"})
        report["cases"].append(item)
        print(f"Fixture {case['caseId']}: {item['status']}", flush=True)
        if args.generate_only or item["status"] != "passed":
            continue  # Never score a conversion against an invalid source fixture.
        for tool, extension in TOOLS.items():
            if args.tool and tool not in args.tool:
                continue
            result = {key: case[key] for key in ("caseId", "label", "language", "documentClass")}
            result.update({"tool": tool, "status": "error"})
            try:
                status, body, headers, engine, elapsed = convert(ROOT / item["source"]["path"], tool, base_url, args.timeout)
                result.update({"httpStatus": status, "elapsedSeconds": round(elapsed, 3), "engine": engine})
                if status != 200:
                    result["error"] = "HTTP conversion failed: " + body.decode("utf-8", "replace")[:300]
                else:
                    output = ARTIFACTS / (case["caseId"] + "-" + tool + extension)
                    output.write_bytes(body)
                    result.update({"outputBytes": len(body), "outputSha256": hashlib.sha256(body).hexdigest(),
                                   "outputPath": relative(output), "contentType": headers.get("content-type")})
                    mime = headers.get("content-type", "").split(";", 1)[0].strip().lower()
                    result.update({"expectedContentType": MIMES[extension], "contentTypeMatched": mime == MIMES[extension]})
                    try:
                        result["validation"] = inspect_office(output, extension, case["markers"], case["caseId"])
                        result["status"] = "passed" if result["validation"]["passed"] and result["contentTypeMatched"] else "failed"
                    except (zipfile.BadZipFile, ET.ParseError, ValueError, KeyError, IndexError) as error:
                        result.update({"status": "failed", "error": "Invalid Office artifact: " + str(error)})
            except Exception as error:
                result["error"] = f"{type(error).__name__}: {error}"
            report["results"].append(result)
            print(f"  {tool}: {result['status']} ({result.get('elapsedSeconds', '?')}s)", flush=True)
    report["contactSheet"] = contact_sheet(report["cases"])
    passed = sum(result["status"] == "passed" for result in report["results"])
    failed = sum(result["status"] == "failed" for result in report["results"])
    errors = sum(result["status"] == "error" for result in report["results"])
    fixture_failures = sum(case["status"] != "passed" for case in report["cases"])
    report["summary"] = {"cases": len(selected), "fixturesPassed": len(selected) - fixture_failures,
                         "fixturesFailed": fixture_failures, "routesTested": len(report["results"]),
                         "passed": passed, "failed": failed, "errors": errors,
                         "allPassed": None if args.generate_only else (not fixture_failures and not failed and not errors
                                                                       and len(report["results"]) > 0)}
    report["completedAt"] = utc_now()
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Saved " + str(args.report), flush=True)
    print(json.dumps(report["summary"]), flush=True)
    success = not fixture_failures if args.generate_only else report["summary"]["allPassed"]
    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main())
