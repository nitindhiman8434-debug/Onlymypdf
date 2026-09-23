#!/usr/bin/env python3
"""Open-source PDF utility operations used by the Phase 2 advanced tools.

The script writes one JSON status line to stdout. Input files are created in a
private temporary directory by the Node service and removed after each request.
"""

from __future__ import annotations

import argparse
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import pymupdf as fitz
from PIL import Image, ImageChops, ImageDraw


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False))


def load_options(raw: str) -> dict:
    try:
        value = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid tool options") from exc
    if not isinstance(value, dict):
        raise ValueError("Tool options must be an object")
    return value


def open_pdf(path: str) -> fitz.Document:
    try:
        document = fitz.open(path)
    except Exception as exc:
        raise ValueError("The PDF is damaged beyond safe recovery or is not a valid PDF") from exc
    if document.needs_pass:
        document.close()
        raise ValueError("Password-protected PDFs must be unlocked before using this tool")
    if document.page_count < 1:
        document.close()
        raise ValueError("The PDF contains no pages")
    return document


def save_clean(document: fitz.Document, output_path: str) -> None:
    document.set_metadata({**document.metadata, "producer": "OnlyMyPDF"})
    document.save(output_path, garbage=4, clean=True, deflate=True)


def repair_pdf(input_path: str, output_path: str) -> dict:
    document = open_pdf(input_path)
    try:
        pages = document.page_count
        save_clean(document, output_path)
        return {"operation": "repair", "pageCount": pages}
    finally:
        document.close()


def ocr_pdf(input_path: str, output_path: str, options: dict) -> dict:
    languages = str(options.get("languages") or "eng+hin").strip()
    if not languages or len(languages) > 40 or not all(c.isalnum() or c in "+_-" for c in languages):
        raise ValueError("Invalid OCR language selection")
    dpi = max(150, min(int(options.get("dpi") or 220), 300))
    max_pages = max(1, min(int(options.get("maxPages") or 50), 50))
    source = open_pdf(input_path)
    output = fitz.open()
    recognized_pages = 0
    preserved_text_pages = 0
    try:
        if source.page_count > max_pages:
            raise ValueError(f"OCR supports up to {max_pages} pages per file")
        matrix = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        for page_number in range(source.page_count):
            page = source.load_page(page_number)
            if len(page.get_text("text").strip()) >= 20:
                output.insert_pdf(source, from_page=page_number, to_page=page_number)
                preserved_text_pages += 1
                continue
            pixmap = page.get_pixmap(matrix=matrix, alpha=False, colorspace=fitz.csRGB)
            try:
                searchable_bytes = pixmap.pdfocr_tobytes(language=languages)
            except Exception as exc:
                raise RuntimeError(
                    f"OCR engine or requested language data is unavailable ({languages})"
                ) from exc
            recognized = fitz.open(stream=searchable_bytes, filetype="pdf")
            try:
                output.insert_pdf(recognized)
            finally:
                recognized.close()
            recognized_pages += 1
        if output.page_count != source.page_count:
            raise RuntimeError("OCR output page count did not match the source")
        save_clean(output, output_path)
        return {
            "operation": "ocr",
            "pageCount": source.page_count,
            "recognizedPages": recognized_pages,
            "preservedTextPages": preserved_text_pages,
            "languages": languages,
            "dpi": dpi,
        }
    finally:
        output.close()
        source.close()


def redact_pdf(input_path: str, output_path: str, options: dict) -> dict:
    raw_terms = options.get("terms")
    if not isinstance(raw_terms, list):
        raise ValueError("Enter one or more words or phrases to redact")
    terms = []
    for value in raw_terms:
        term = str(value).strip()
        if term and term not in terms:
            terms.append(term)
    if not terms or len(terms) > 20 or any(len(term) > 120 for term in terms):
        raise ValueError("Enter 1 to 20 redaction terms, up to 120 characters each")

    document = open_pdf(input_path)
    matches = 0
    pages_changed = 0
    try:
        for page in document:
            page_matches = 0
            for term in terms:
                for rect in page.search_for(term):
                    page.add_redact_annot(rect, fill=(0, 0, 0), cross_out=False)
                    page_matches += 1
            if page_matches:
                page.apply_redactions()
                pages_changed += 1
                matches += page_matches
        if matches == 0:
            raise ValueError("No matching text was found. Scanned pages need OCR before text redaction")
        save_clean(document, output_path)
        return {
            "operation": "redact",
            "pageCount": document.page_count,
            "matchesRemoved": matches,
            "pagesChanged": pages_changed,
        }
    finally:
        document.close()


def bounded_margin(options: dict, name: str) -> float:
    try:
        value = float(options.get(name, 0))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid {name} crop margin") from exc
    if value < 0 or value > 45:
        raise ValueError("Crop margins must be between 0% and 45%")
    return value


def crop_pdf(input_path: str, output_path: str, options: dict) -> dict:
    left = bounded_margin(options, "left")
    top = bounded_margin(options, "top")
    right = bounded_margin(options, "right")
    bottom = bounded_margin(options, "bottom")
    if left + right >= 90 or top + bottom >= 90:
        raise ValueError("Opposite crop margins leave too little page content")
    if left + top + right + bottom <= 0:
        raise ValueError("Set at least one crop margin above 0%")

    document = open_pdf(input_path)
    try:
        for page in document:
            rect = page.rect
            cropped = fitz.Rect(
                rect.x0 + rect.width * left / 100.0,
                rect.y0 + rect.height * top / 100.0,
                rect.x1 - rect.width * right / 100.0,
                rect.y1 - rect.height * bottom / 100.0,
            )
            page.set_cropbox(cropped)
        save_clean(document, output_path)
        return {
            "operation": "crop",
            "pageCount": document.page_count,
            "marginsPercent": {"left": left, "top": top, "right": right, "bottom": bottom},
        }
    finally:
        document.close()


def render_page(document: fitz.Document | None, page_number: int, width: int = 900) -> Image.Image:
    if document is None or page_number >= document.page_count:
        return Image.new("RGB", (width, int(width * 1.414)), "white")
    page = document.load_page(page_number)
    scale = width / max(page.rect.width, 1)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False, colorspace=fitz.csRGB)
    return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)


def pad_same_size(left: Image.Image, right: Image.Image) -> tuple[Image.Image, Image.Image]:
    width = max(left.width, right.width)
    height = max(left.height, right.height)
    a = Image.new("RGB", (width, height), "white")
    b = Image.new("RGB", (width, height), "white")
    a.paste(left, (0, 0))
    b.paste(right, (0, 0))
    return a, b


def png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def compare_pdf(input_path: str, second_path: str, output_path: str) -> dict:
    first = open_pdf(input_path)
    second = open_pdf(second_path)
    output = fitz.open()
    pages = max(first.page_count, second.page_count)
    changed_pages = 0
    try:
        if pages > 50:
            raise ValueError("Compare PDF supports up to 50 pages per document")
        for page_number in range(pages):
            image_a, image_b = pad_same_size(
                render_page(first, page_number), render_page(second, page_number)
            )
            difference = ImageChops.difference(image_a, image_b)
            mask = difference.convert("L").point(lambda value: 255 if value > 24 else 0)
            changed_pixels = mask.histogram()[255]
            if changed_pixels:
                changed_pages += 1
            overlay = image_b.copy()
            red = Image.new("RGB", overlay.size, (220, 38, 38))
            overlay.paste(red, mask=mask.point(lambda value: 120 if value else 0))
            draw = ImageDraw.Draw(overlay)
            draw.rectangle((0, 0, overlay.width - 1, overlay.height - 1), outline=(220, 38, 38), width=3)

            gap = 18
            title_height = 54
            panel_width = image_a.width
            panel_height = image_a.height
            report = output.new_page(
                width=panel_width * 3 + gap * 4,
                height=panel_height + title_height + gap * 2,
            )
            report.insert_text((gap, 30), f"Page {page_number + 1}: Original A | Original B | Differences", fontsize=16)
            for index, image in enumerate((image_a, image_b, overlay)):
                x0 = gap + index * (panel_width + gap)
                rect = fitz.Rect(x0, title_height, x0 + panel_width, title_height + panel_height)
                report.insert_image(rect, stream=png_bytes(image))
        save_clean(output, output_path)
        return {
            "operation": "compare",
            "pageCount": pages,
            "changedPages": changed_pages,
            "identicalPages": pages - changed_pages,
        }
    finally:
        output.close()
        first.close()
        second.close()


def find_ghostscript() -> str | None:
    configured = os.environ.get("GHOSTSCRIPT_PATH", "").strip()
    candidates = [configured, "gs", "gswin64c", "gswin32c"]
    for candidate in candidates:
        if candidate and (Path(candidate).is_file() or shutil.which(candidate)):
            return candidate
    return None


def find_srgb_profile() -> Path | None:
    configured = os.environ.get("PDFA_SRGB_ICC", "").strip()
    candidates = [
        configured,
        "/usr/share/color/icc/ghostscript/srgb.icc",
        "/usr/share/ghostscript/iccprofiles/srgb.icc",
        "/usr/share/color/icc/sRGB.icc",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate).resolve()
    return None


def pdfa_definition(profile: Path) -> str:
    profile_path = str(profile).replace("\\", "/").replace("(", "\\(").replace(")", "\\)")
    return f"""
/ICCProfile ({profile_path}) def
[/_objdef {{icc_PDFA}} /type /stream /OBJ pdfmark
[{{icc_PDFA}} << /N 3 >> /PUT pdfmark
[{{icc_PDFA}} ICCProfile (r) file /PUT pdfmark
[/_objdef {{OutputIntent_PDFA}} /type /dict /OBJ pdfmark
[{{OutputIntent_PDFA}} <<
  /Type /OutputIntent
  /S /GTS_PDFA1
  /DestOutputProfile {{icc_PDFA}}
  /OutputConditionIdentifier (sRGB)
  /Info (sRGB IEC61966-2.1)
>> /PUT pdfmark
[{{Catalog}} << /OutputIntents [{{OutputIntent_PDFA}}] >> /PUT pdfmark
"""


def pdfa_pdf(input_path: str, output_path: str, options: dict) -> dict:
    level = str(options.get("level") or "2b").lower()
    if level not in {"1b", "2b", "3b"}:
        raise ValueError("PDF/A level must be 1b, 2b or 3b")
    gs = find_ghostscript()
    profile = find_srgb_profile()
    if not gs or not profile:
        raise RuntimeError("PDF/A conversion requires Ghostscript and its sRGB ICC profile")

    with tempfile.TemporaryDirectory(prefix="onlymypdf-pdfa-") as folder:
        definition = Path(folder) / "PDFA_def.ps"
        definition.write_text(pdfa_definition(profile), encoding="utf-8")
        command = [
            gs,
            "-dBATCH",
            "-dNOPAUSE",
            "-dSAFER",
            f"-dPDFA={level[0]}",
            "-dPDFACompatibilityPolicy=1",
            "-sDEVICE=pdfwrite",
            "-sColorConversionStrategy=RGB",
            "-dEmbedAllFonts=true",
            "-dSubsetFonts=true",
            f"-sOutputFile={output_path}",
            str(definition),
            input_path,
        ]
        result = subprocess.run(command, capture_output=True, text=True, timeout=900, check=False)
        if result.returncode != 0 or not Path(output_path).is_file():
            detail = (result.stderr or result.stdout or "Ghostscript conversion failed").strip()
            raise RuntimeError(detail[-600:])
    verified = open_pdf(output_path)
    try:
        pages = verified.page_count
    finally:
        verified.close()
    return {"operation": "pdfa", "pageCount": pages, "level": level.upper()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["repair", "ocr", "redact", "crop", "compare", "pdfa"])
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("options", nargs="?", default="{}")
    parser.add_argument("--second")
    args = parser.parse_args()
    options = load_options(args.options)

    if args.operation == "repair":
        result = repair_pdf(args.input, args.output)
    elif args.operation == "ocr":
        result = ocr_pdf(args.input, args.output, options)
    elif args.operation == "redact":
        result = redact_pdf(args.input, args.output, options)
    elif args.operation == "crop":
        result = crop_pdf(args.input, args.output, options)
    elif args.operation == "compare":
        if not args.second:
            raise ValueError("A second PDF is required for comparison")
        result = compare_pdf(args.input, args.second, args.output)
    else:
        result = pdfa_pdf(args.input, args.output, options)

    output = Path(args.output)
    if not output.is_file() or output.stat().st_size < 5:
        raise RuntimeError("The PDF tool produced no usable output")
    emit({**result, "outputPath": str(output), "outputBytes": output.stat().st_size})


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        emit({"error": str(exc) or exc.__class__.__name__})
        sys.exit(1)
