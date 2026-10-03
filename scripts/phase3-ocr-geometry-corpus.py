#!/usr/bin/env python3
"""English-only, loopback HTTP OCR geometry regression; never runs OCR directly."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import platform
import re
import time
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path

import fitz
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
GEOMETRY_TOLERANCE_PT = 0.05
RENDER_DPI = 96
RASTER_DPI = 300

# Reuse only the existing hardened HTTP transport, never its fixture generators.
_spec = importlib.util.spec_from_file_location("document_corpus_transport", ROOT / "scripts/phase3-document-corpus.py")
_transport_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_transport_module)
LocalTransport = _transport_module.LocalTransport


def normalize_text(value: str) -> str:
    """Collapse whitespace runs, preserving word boundaries, case and punctuation."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", value)).strip()


def case_definitions() -> list[dict]:
    def page(size, title, ending, **metadata):
        return {"size": size, "text": f"{title}\nThe garden has green trees\nEvery page keeps its original size\n{ending}", **metadata}

    return [
        {"caseId": "letter-portrait", "pages": [page((612, 792), "Letter portrait page", "End of letter page")]},
        {"caseId": "a4-fractional", "pages": [page((595.276, 841.890), "Fractional paper page", "End of fractional page")]},
        {"caseId": "landscape", "pages": [page((792, 612), "Landscape paper page", "End of landscape page")]},
        {"caseId": "rotated-crop-mixed", "pages": [
            page((480, 640), "First rotated page", "End of first page", media=(700, 550), crop=(30, 40, 670, 520), rotation=90),
            page((720, 405), "Middle landscape page", "End of middle page"),
            page((450, 650), "Last rotated page", "End of final page", media=(500, 720), crop=(20, 30, 470, 680), rotation=180),
        ]},
        {"caseId": "searchable-passthrough", "searchable": True, "pages": [
            page((480, 640), "Searchable original page", "End of searchable page", media=(700, 550), crop=(30, 40, 670, 520), rotation=90),
        ]},
    ]


def path_label(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def page_metadata(page) -> dict:
    return {"width": page.rect.width, "height": page.rect.height, "rotation": page.rotation,
            "mediaBox": list(page.mediabox), "cropBox": list(page.cropbox)}


def generate_fixture(case: dict, directory: Path) -> dict:
    directory.mkdir(parents=True, exist_ok=True)
    source_path = directory / f"{case['caseId']}-source.pdf"
    input_path = directory / f"{case['caseId']}-input.pdf"
    source = fitz.open()
    for spec in case["pages"]:
        # The literal English text is the independent oracle, never extracted OCR.
        visual = fitz.open()
        page = visual.new_page(width=spec["size"][0], height=spec["size"][1])
        for line_number, line in enumerate(spec["text"].splitlines()):
            page.insert_text((36, 65 + line_number * 40), line, fontname="helv", fontsize=18)
        media = spec.get("media", spec["size"])
        target = source.new_page(width=media[0], height=media[1])
        if "crop" in spec:
            target.set_cropbox(fitz.Rect(spec["crop"]))
        rotation = spec.get("rotation", 0)
        target.show_pdf_page(target.rect, visual, 0, rotate=rotation, keep_proportion=False)
        target.set_rotation(rotation)
        visual.close()
    source.save(source_path, garbage=4, deflate=True)
    source.close()
    expected = []
    raster = fitz.open()
    with fitz.open(source_path) as source:
        for index, page in enumerate(source):
            literal = normalize_text(case["pages"][index]["text"])
            actual = normalize_text(page.get_text(sort=False))
            if literal != actual:
                raise ValueError(f"Literal source validation failed on page {index + 1}: {actual!r}")
            metadata = page_metadata(page)
            expected.append({**metadata, "text": literal})
            if case.get("searchable"):
                continue
            # Render before page rotation, then restore identical CropBox/Rotation
            # on the image-only input, so this exercises real rotated PDF metadata.
            page.set_rotation(0)
            pixmap = page.get_pixmap(dpi=RASTER_DPI, alpha=False)
            target = raster.new_page(width=page.mediabox.width, height=page.mediabox.height)
            target.set_cropbox(page.cropbox)
            target.insert_image(target.rect, stream=pixmap.tobytes("png"))
            target.set_rotation(metadata["rotation"])
    if case.get("searchable"):
        input_path.write_bytes(source_path.read_bytes())
    else:
        raster.save(input_path, garbage=4, deflate=True)
    raster.close()
    with fitz.open(input_path) as input_pdf:
        if len(input_pdf) != len(expected):
            raise ValueError("Input fixture page count changed")
        selectable = [normalize_text(page.get_text()) for page in input_pdf]
        if not case.get("searchable") and any(selectable):
            raise ValueError("Raster fixture unexpectedly has selectable text")
        if case.get("searchable") and selectable != [page["text"] for page in expected]:
            raise ValueError("Searchable fixture lost original text")
        for index, page in enumerate(input_pdf):
            if abs(page.rect.width - expected[index]["width"]) > GEOMETRY_TOLERANCE_PT or abs(page.rect.height - expected[index]["height"]) > GEOMETRY_TOLERANCE_PT:
                raise ValueError("Input fixture geometry changed during rasterization")
    return {"sourcePath": path_label(source_path), "inputPath": path_label(input_path),
            "inputBytes": input_path.stat().st_size, "inputSha256": hashlib.sha256(input_path.read_bytes()).hexdigest(),
            "literalSourceTextValidated": True, "imageOnly": not case.get("searchable", False),
            "selectableTextCharacters": sum(map(len, selectable)), "pages": expected}


def render_page(page, path: Path) -> Image.Image:
    pixmap = page.get_pixmap(dpi=RENDER_DPI, colorspace=fitz.csRGB, alpha=False)
    pixmap.save(path)
    return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)


def raster_comparison(before: Image.Image, after: Image.Image) -> dict:
    same_pixels = before.size == after.size
    result = {"beforePixels": list(before.size), "afterPixels": list(after.size), "samePixelDimensions": same_pixels}
    if not same_pixels:
        return {**result, "passed": False}
    difference = ImageChops.difference(before.convert("L"), after.convert("L"))
    histogram = difference.histogram()
    count = before.width * before.height
    mean = ImageStat.Stat(difference).mean[0]
    changed = sum(histogram[33:]) / count
    before_ink = before.convert("L").point(lambda value: 255 if value < 200 else 0)
    after_ink = after.convert("L").point(lambda value: 255 if value < 200 else 0)
    union = ImageChops.lighter(before_ink, after_ink).histogram()[255]
    intersection = ImageChops.darker(before_ink, after_ink).histogram()[255]
    ink_iou = intersection / union if union else 1.0
    return {**result, "meanAbsoluteGrayError": round(mean, 6), "fractionPixelsChangedOver32": round(changed, 6),
            "darkInkIntersectionOverUnion": round(ink_iou, 6),
            "passed": mean <= 2.0 and changed <= 0.02 and ink_iou >= 0.80}


def inspect_output(input_path: Path, output_path: Path, expected: list[dict], directory: Path,
                   case_id: str, searchable: bool = False) -> dict:
    directory.mkdir(parents=True, exist_ok=True)
    if not output_path.read_bytes().startswith(b"%PDF-"):
        return {"passed": False, "pdfMagic": False, "error": "Missing PDF magic"}
    with fitz.open(input_path) as before, fitz.open(output_path) as after:
        if after.needs_pass:
            return {"passed": False, "pdfMagic": True, "readable": False, "error": "Unexpected password protection"}
        count_match = len(after) == len(expected)
        rows = []
        for index, expectation in enumerate(expected):
            if index >= len(after):
                rows.append({"page": index + 1, "passed": False, "missing": True})
                continue
            page = after[index]
            geometry = page_metadata(page)
            geometry_match = all(abs(geometry[key] - expectation[key]) <= GEOMETRY_TOLERANCE_PT for key in ("width", "height"))
            actual_text = normalize_text(page.get_text(sort=False))
            text_match = actual_text == expectation["text"]
            outside = []
            words = page.get_text("words", sort=False)
            visible = page.rect + (-0.5, -0.5, 0.5, 0.5)
            for word in words:
                box = fitz.Rect(word[:4]) * page.rotation_matrix
                if not visible.contains(box):
                    outside.append({"text": word[4], "visibleBox": list(box)})
            before_png = directory / f"{case_id}-page-{index + 1}-before.png"
            after_png = directory / f"{case_id}-page-{index + 1}-after.png"
            comparison = raster_comparison(render_page(before[index], before_png), render_page(page, after_png))
            metadata_match = all(geometry[key] == expectation[key] for key in ("rotation", "mediaBox", "cropBox"))
            rows.append({"page": index + 1, "expected": expectation, "actual": {**geometry, "text": actual_text},
                         "dimensionsMatched": geometry_match, "fullTextAndOrderMatched": text_match,
                         "wordCount": len(words), "wordBoxesInsideVisiblePage": bool(words) and not outside,
                         "outOfBoundsWords": outside, "originalPageMetadataPreserved": metadata_match,
                         "render": comparison, "beforePreview": path_label(before_png), "afterPreview": path_label(after_png),
                         "passed": geometry_match and text_match and bool(words) and not outside and comparison["passed"]
                         and (not searchable or metadata_match)})
        return {"pdfMagic": True, "readable": True, "expectedPageCount": len(expected), "actualPageCount": len(after),
                "pageCountMatched": count_match, "lastPageTextMatched": bool(rows) and count_match and rows[-1].get("fullTextAndOrderMatched", False),
                "pages": rows, "passed": count_match and bool(rows) and all(row["passed"] for row in rows)}


def multipart(input_path: Path) -> tuple[bytes, str]:
    boundary = "ocr-geometry-" + uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{input_path.name}"\r\n'
            'Content-Type: application/pdf\r\n\r\n').encode() + input_path.read_bytes()
    body += f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="languages"\r\n\r\neng\r\n--{boundary}--\r\n'.encode()
    return body, "multipart/form-data; boundary=" + boundary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True, type=Path, help="New JSON path; existing reports are never overwritten")
    parser.add_argument("--case", action="append", choices=[case["caseId"] for case in case_definitions()])
    parser.add_argument("--generate-only", action="store_true")
    parser.add_argument("--base-url", default="http://127.0.0.1:3001")
    parser.add_argument("--timeout", type=float, default=180)
    args = parser.parse_args()
    if args.report.exists():
        parser.error("Report already exists; choose a new --report path to preserve the baseline")
    if not 1 <= args.timeout <= 600:
        parser.error("--timeout must be between 1 and 600 seconds")
    # Validate the loopback origin before generating any artifact or HTTP request.
    LocalTransport(args.base_url, args.timeout)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    directory = ROOT / "tmp/pdfs/phase3.2e-ocr-geometry" / f"{args.report.stem}-{stamp}"
    report = {"schemaVersion": 1, "generatedAt": stamp, "scope": "local-English-only", "baseUrl": args.base_url,
              "mode": "generate-only" if args.generate_only else "http-conversion", "language": "eng",
              "environment": {"python": platform.python_version(), "pymupdf": fitz.VersionBind},
              "criteria": {"dimensionTolerancePt": GEOMETRY_TOLERANCE_PT, "inputRasterDpi": RASTER_DPI,
                           "comparisonDpi": RENDER_DPI, "meanGrayErrorMaximum": 2, "changedFractionOver32Maximum": 0.02,
                           "darkInkIoUMinimum": 0.80, "textNormalization": "NFC; collapse whitespace runs to one space; case and punctuation retained"},
              "limitations": ["Synthetic clean English only; no production, noisy scans, handwriting or other-language claim.",
                              "OCR output may normalize CropBox and Rotation; visible physical geometry must remain unchanged.",
                              "Automated raster tolerances allow antialiasing; retained PNGs require human visual review.",
                              "Existing searchable pages must additionally preserve original page box and rotation metadata."], "cases": []}
    selected = [case for case in case_definitions() if not args.case or case["caseId"] in args.case]
    for case in selected:
        row = {"caseId": case["caseId"], "status": "error"}
        try:
            row["fixture"] = generate_fixture(case, directory)
            if args.generate_only:
                row["status"] = "passed"
            else:
                input_path = ROOT / row["fixture"]["inputPath"]
                payload, content_type = multipart(input_path)
                started = time.monotonic()
                status, body, headers = LocalTransport(args.base_url, args.timeout).request("/api/tools/ocr-pdf", payload, content_type)
                row.update({"httpStatus": status, "elapsedSeconds": round(time.monotonic() - started, 3),
                            "contentType": headers.get("content-type", ""), "outputBytes": len(body)})
                if status != 200:
                    raise ValueError(f"HTTP {status}: " + body.decode("utf-8", "replace")[:300])
                output_path = directory / f"{case['caseId']}-output.pdf"
                output_path.write_bytes(body)
                row.update({"outputPath": path_label(output_path), "outputSha256": hashlib.sha256(body).hexdigest(),
                            "contentTypeMatched": row["contentType"].split(";", 1)[0].strip().lower() == "application/pdf"})
                row["validation"] = inspect_output(input_path, output_path, row["fixture"]["pages"], directory,
                                                   case["caseId"], case.get("searchable", False))
                row["status"] = "passed" if row["contentTypeMatched"] and row["validation"]["passed"] else "failed"
        except Exception as error:
            row["error"] = f"{type(error).__name__}: {error}"
        report["cases"].append(row)
        print(f"{case['caseId']}: {row['status']}", flush=True)
    report["summary"] = {"cases": len(selected), **{status: sum(row["status"] == status for row in report["cases"]) for status in ("passed", "failed", "error")},
                         "allPassed": bool(report["cases"]) and all(row["status"] == "passed" for row in report["cases"])}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    with args.report.open("x", encoding="utf-8") as output:
        output.write(json.dumps(report, indent=2) + "\n")
    print(f"Saved {args.report}\n{json.dumps(report['summary'])}", flush=True)
    return 0 if report["summary"]["allPassed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
