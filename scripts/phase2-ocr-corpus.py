#!/usr/bin/env python3
"""Deterministic Phase 2.3B Hindi, mixed-language and difficult-scan corpus."""
from __future__ import annotations

import html
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
import zipfile
from dataclasses import dataclass
from difflib import SequenceMatcher
from io import BytesIO
from pathlib import Path
from typing import Callable

import pymupdf as fitz
from PIL import Image, ImageDraw, ImageFilter, ImageFont


PAGE_SIZE = (1275, 1650)
DEVANAGARI_FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansDevanagari-Regular.ttf",
    "C:/Windows/Fonts/Nirmala.ttf",
)
LATIN_FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arial.ttf",
)


@dataclass(frozen=True)
class CorpusCase:
    name: str
    expected_tokens: tuple[str, ...]
    min_recall: float
    min_chars: int
    expect_success: bool
    make_image: Callable[[ImageFont.FreeTypeFont, ImageFont.FreeTypeFont], Image.Image]


def _find_font(candidates: tuple[str, ...]) -> str:
    for candidate in candidates:
        if Path(candidate).is_file():
            return candidate
    raise FileNotFoundError(f"Required font not found: {', '.join(candidates)}")


def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def _canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", PAGE_SIZE, "white")
    return image, ImageDraw.Draw(image)


def _draw_lines(
    draw: ImageDraw.ImageDraw,
    lines: list[tuple[str, ImageFont.FreeTypeFont]],
    *,
    x: int = 90,
    y: int = 100,
    gap: int = 28,
) -> None:
    cursor = y
    for text, font in lines:
        draw.text((x, cursor), text, fill="black", font=font)
        box = draw.textbbox((x, cursor), text, font=font)
        cursor = box[3] + gap


def _draw_segments(
    draw: ImageDraw.ImageDraw,
    segments: list[tuple[str, ImageFont.FreeTypeFont]],
    *,
    x: int,
    y: int,
) -> None:
    cursor = x
    for text, font in segments:
        draw.text((cursor, y), text, fill="black", font=font)
        cursor = draw.textbbox((cursor, y), text, font=font)[2]


def _clean_hindi(hindi: ImageFont.FreeTypeFont, latin: ImageFont.FreeTypeFont) -> Image.Image:
    image, draw = _canvas()
    _draw_lines(
        draw,
        [
            ("ओनलीमायपीडीएफ गुणवत्ता परीक्षण", _font(hindi.path, 54)),
            ("चालान 58241 - सितंबर 2026", _font(hindi.path, 43)),
            ("यह स्कैन संपादन योग्य पाठ में बदलना चाहिए।", _font(hindi.path, 39)),
            ("कुल राशि 1475 रुपये", _font(hindi.path, 43)),
        ],
    )
    return image


def _mixed_language(hindi: ImageFont.FreeTypeFont, latin: ImageFont.FreeTypeFont) -> Image.Image:
    image, draw = _canvas()
    latin_52 = _font(latin.path, 52)
    latin_42 = _font(latin.path, 42)
    hindi_42 = _font(hindi.path, 42)
    draw.text((90, 100), "OnlyMyPDF Mixed Language Test", fill="black", font=latin_52)
    _draw_segments(draw, [("Invoice 73195 - ", latin_42), ("चालान सितंबर 2026", hindi_42)], x=90, y=205)
    _draw_segments(draw, [("Editable text ", latin_42), ("और सटीक परिणाम", hindi_42)], x=90, y=300)
    _draw_segments(draw, [("Total ", latin_42), ("कुल राशि 2499 रुपये", hindi_42)], x=90, y=395)
    return image


def _skewed(hindi: ImageFont.FreeTypeFont, latin: ImageFont.FreeTypeFont) -> Image.Image:
    image, draw = _canvas()
    latin_50 = _font(latin.path, 50)
    latin_40 = _font(latin.path, 40)
    hindi_42 = _font(hindi.path, 42)
    hindi_40 = _font(hindi.path, 40)
    draw.text((90, 150), "OnlyMyPDF Skew Accuracy", fill="black", font=latin_50)
    draw.text((90, 250), "रसीद 84512 - गुणवत्ता जाँच", fill="black", font=hindi_42)
    _draw_segments(draw, [("Editable document ", latin_40), ("कुल राशि 3280", hindi_40)], x=90, y=345)
    _draw_segments(draw, [("September ", latin_40), ("सितंबर ", hindi_40), ("verified", latin_40)], x=90, y=440)
    return image.rotate(2.4, resample=Image.Resampling.BICUBIC, fillcolor="white")


def _low_resolution(hindi: ImageFont.FreeTypeFont, latin: ImageFont.FreeTypeFont) -> Image.Image:
    image, draw = _canvas()
    latin_48 = _font(latin.path, 48)
    latin_39 = _font(latin.path, 39)
    hindi_42 = _font(hindi.path, 42)
    hindi_39 = _font(hindi.path, 39)
    hindi_40 = _font(hindi.path, 40)
    draw.text((90, 100), "OnlyMyPDF Low Resolution", fill="black", font=latin_48)
    draw.text((90, 200), "चालान 91307 गुणवत्ता परीक्षण", fill="black", font=hindi_42)
    _draw_segments(draw, [("Editable ", latin_39), ("पाठ कुल राशि 1875", hindi_39)], x=90, y=295)
    draw.text((90, 390), "सितंबर 2026 परिणाम", fill="black", font=hindi_40)
    image = image.resize((510, 660), Image.Resampling.LANCZOS)
    image = image.filter(ImageFilter.GaussianBlur(0.35))
    return image.resize(PAGE_SIZE, Image.Resampling.BILINEAR)


def _multi_column(hindi: ImageFont.FreeTypeFont, latin: ImageFont.FreeTypeFont) -> Image.Image:
    image, draw = _canvas()
    _draw_segments(
        draw,
        [("OnlyMyPDF ", _font(latin.path, 49)), ("दो कॉलम परीक्षण", _font(hindi.path, 49))],
        x=80,
        y=70,
    )
    draw.line((620, 165, 620, 1430), fill=(170, 170, 170), width=3)
    _draw_lines(
        draw,
        [
            ("Invoice 46218", _font(latin.path, 38)),
            ("Editable English", _font(latin.path, 36)),
            ("Quality report", _font(latin.path, 36)),
            ("Subtotal 1250", _font(latin.path, 36)),
            ("Total 1475", _font(latin.path, 36)),
        ],
        x=80,
        y=210,
        gap=42,
    )
    _draw_lines(
        draw,
        [
            ("चालान 46218", _font(hindi.path, 38)),
            ("संपादन योग्य पाठ", _font(hindi.path, 36)),
            ("गुणवत्ता रिपोर्ट", _font(hindi.path, 36)),
            ("राशि 1250", _font(hindi.path, 36)),
            ("कुल 1475", _font(hindi.path, 36)),
        ],
        x=690,
        y=210,
        gap=42,
    )
    return image


def _table_form(hindi: ImageFont.FreeTypeFont, latin: ImageFont.FreeTypeFont) -> Image.Image:
    image, draw = _canvas()
    latin_50 = _font(latin.path, 50)
    latin_37 = _font(latin.path, 37)
    latin_30 = _font(latin.path, 30)
    hindi_50 = _font(hindi.path, 50)
    hindi_37 = _font(hindi.path, 37)
    hindi_30 = _font(hindi.path, 30)
    _draw_segments(draw, [("OnlyMyPDF Invoice ", latin_50), ("चालान", hindi_50)], x=80, y=70)
    _draw_segments(draw, [("Customer ", latin_37), ("ग्राहक: ", hindi_37), ("Nitin", latin_37)], x=80, y=155)
    _draw_segments(
        draw,
        [("Invoice 68429  Date ", latin_37), ("तारीख: ", hindi_37), ("18-09-2026", latin_37)],
        x=80,
        y=215,
    )
    left, top, right, bottom = 80, 330, 1190, 820
    rows = 5
    cols = (left, 650, 900, right)
    for x in cols:
        draw.line((x, top, x, bottom), fill="black", width=4)
    for row in range(rows + 1):
        y = top + int((bottom - top) * row / rows)
        draw.line((left, y, right, y), fill="black", width=4)
    cells = [
        ((("Item ", latin_30), ("वस्तु", hindi_30)), (("Qty ", latin_30), ("मात्रा", hindi_30)), (("Amount ", latin_30), ("राशि", hindi_30))),
        ((("Document", latin_30),), (("2", latin_30),), (("1000", latin_30),)),
        ((("OCR ", latin_30), ("सेवा", hindi_30)), (("1", latin_30),), (("250", latin_30),)),
        ((("Tax ", latin_30), ("कर", hindi_30)), (), (("225", latin_30),)),
        ((("Total ", latin_30), ("कुल", hindi_30)), (), (("1475", latin_30),)),
    ]
    for row, values in enumerate(cells):
        y = top + 28 + int((bottom - top) * row / rows)
        for x, segments in zip((left + 22, 670, 920), values):
            _draw_segments(draw, list(segments), x=x, y=y)
    _draw_segments(
        draw,
        [("Approved ", _font(latin.path, 38)), ("स्वीकृत: ", _font(hindi.path, 38)), ("Yes", _font(latin.path, 38))],
        x=80,
        y=900,
    )
    return image


def _damaged_scan(hindi: ImageFont.FreeTypeFont, latin: ImageFont.FreeTypeFont) -> Image.Image:
    image, draw = _canvas()
    latin_48 = _font(latin.path, 48)
    latin_39 = _font(latin.path, 39)
    hindi_42 = _font(hindi.path, 42)
    hindi_39 = _font(hindi.path, 39)
    draw.text((90, 180), "OnlyMyPDF Damaged Scan", fill="black", font=latin_48)
    draw.text((90, 280), "चालान 55721 गुणवत्ता जाँच", fill="black", font=hindi_42)
    _draw_segments(draw, [("Editable ", latin_39), ("पाठ कुल राशि 3125", hindi_39)], x=90, y=375)
    _draw_segments(draw, [("September ", latin_39), ("सितंबर ", hindi_39), ("result", latin_39)], x=90, y=470)
    rng = random.Random(2309)
    for _ in range(750):
        x = rng.randrange(0, PAGE_SIZE[0])
        y = rng.randrange(0, PAGE_SIZE[1])
        shade = rng.randrange(120, 230)
        draw.ellipse((x, y, x + rng.randrange(1, 5), y + rng.randrange(1, 5)), fill=(shade,) * 3)
    for y in (315, 535, 760):
        draw.line((0, y, PAGE_SIZE[0], y + 16), fill=(225, 225, 225), width=10)
    return image.filter(ImageFilter.GaussianBlur(0.22))


def _unreadable(hindi: ImageFont.FreeTypeFont, latin: ImageFont.FreeTypeFont) -> Image.Image:
    image = Image.new("RGB", PAGE_SIZE, (205, 205, 205))
    draw = ImageDraw.Draw(image)
    rng = random.Random(991)
    for _ in range(45):
        x1 = rng.randrange(0, PAGE_SIZE[0])
        y1 = rng.randrange(0, PAGE_SIZE[1])
        x2 = min(PAGE_SIZE[0], x1 + rng.randrange(20, 150))
        y2 = min(PAGE_SIZE[1], y1 + rng.randrange(3, 25))
        shade = rng.randrange(150, 220)
        draw.rectangle((x1, y1, x2, y2), fill=(shade,) * 3)
    return image.filter(ImageFilter.GaussianBlur(4.5))


def _cases() -> tuple[CorpusCase, ...]:
    return (
        CorpusCase("clean-hindi", ("गुणवत्ता", "चालान", "सितंबर", "स्कैन", "संपादन", "पाठ", "कुल", "राशि", "रुपये", "58241"), 0.85, 80, True, _clean_hindi),
        CorpusCase("mixed-english-hindi", ("onlymypdf", "mixed", "invoice", "73195", "चालान", "सितंबर", "editable", "सटीक", "total", "राशि", "रुपये"), 0.85, 100, True, _mixed_language),
        CorpusCase("skewed-mixed", ("onlymypdf", "skew", "accuracy", "रसीद", "84512", "गुणवत्ता", "editable", "कुल", "राशि", "3280", "सितंबर"), 0.80, 90, True, _skewed),
        CorpusCase("low-resolution", ("onlymypdf", "resolution", "चालान", "91307", "गुणवत्ता", "editable", "पाठ", "कुल", "राशि", "1875", "सितंबर"), 0.70, 80, True, _low_resolution),
        CorpusCase("multi-column", ("onlymypdf", "कॉलम", "invoice", "46218", "editable", "quality", "चालान", "संपादन", "गुणवत्ता", "राशि", "कुल", "1475"), 0.80, 120, True, _multi_column),
        CorpusCase("table-form", ("onlymypdf", "invoice", "चालान", "customer", "ग्राहक", "68429", "वस्तु", "मात्रा", "राशि", "कर", "कुल", "1475", "स्वीकृत"), 0.80, 120, True, _table_form),
        CorpusCase("damaged-scan", ("onlymypdf", "damaged", "चालान", "55721", "गुणवत्ता", "editable", "पाठ", "कुल", "राशि", "3125", "सितंबर"), 0.60, 75, True, _damaged_scan),
        CorpusCase("unreadable-fail-closed", (), 1.0, 0, False, _unreadable),
    )


def _image_only_pdf(image: Image.Image, path: Path) -> None:
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    pdf = fitz.open()
    page = pdf.new_page(width=612, height=792)
    page.insert_image(page.rect, stream=buffer.getvalue())
    pdf.save(path, garbage=4, deflate=True)
    pdf.close()


def _render_pdf(pdf_path: Path, png_path: Path) -> None:
    pdf = fitz.open(pdf_path)
    try:
        pdf[0].get_pixmap(dpi=150, colorspace=fitz.csRGB, alpha=False).save(png_path)
    finally:
        pdf.close()


def _render_docx_preview(docx_path: Path, artifacts_dir: Path) -> bool:
    office = shutil.which("libreoffice") or shutil.which("soffice")
    if office is None:
        return False
    with tempfile.TemporaryDirectory(prefix="onlymypdf-phase23b-preview-") as temp:
        result = subprocess.run(
            [
                office,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                temp,
                str(docx_path),
            ],
            capture_output=True,
            text=True,
            timeout=90,
            check=False,
        )
        rendered = Path(temp) / f"{docx_path.stem}.pdf"
        if result.returncode != 0 or not rendered.is_file() or rendered.stat().st_size < 1000:
            return False
        output_pdf = artifacts_dir / f"{docx_path.stem}-output.pdf"
        output_png = artifacts_dir / f"{docx_path.stem}-output.png"
        shutil.copy2(rendered, output_pdf)
        _render_pdf(output_pdf, output_png)
        return output_png.is_file() and output_png.stat().st_size > 1000


def _docx_text(path: Path) -> tuple[str, int, bool]:
    try:
        with zipfile.ZipFile(path) as archive:
            xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
            media = sum(1 for name in archive.namelist() if name.startswith("word/media/"))
        chunks = [html.unescape(value) for value in re.findall(r"<w:t[^>]*>([^<]*)</w:t>", xml)]
        return " ".join(chunks), media, True
    except (FileNotFoundError, KeyError, zipfile.BadZipFile):
        return "", 0, False


def _tokens(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", text).lower()
    return re.findall(r"[a-z0-9]+|[\u0900-\u097f]+", normalized)


def _token_recall(expected: tuple[str, ...], actual_text: str) -> tuple[float, list[str]]:
    actual = _tokens(actual_text)
    compact = re.sub(r"[^a-z0-9\u0900-\u097f]+", "", unicodedata.normalize("NFKC", actual_text).lower())
    matched: list[str] = []
    for token in expected:
        expected_norm = unicodedata.normalize("NFKC", token).lower()
        threshold = 1.0 if expected_norm.isdigit() else 0.78
        if expected_norm in compact or any(
            SequenceMatcher(None, expected_norm, candidate).ratio() >= threshold
            for candidate in actual
        ):
            matched.append(token)
    recall = len(matched) / max(1, len(expected))
    return recall, matched


def _run_case(
    case: CorpusCase,
    *,
    repo: Path,
    temp_dir: Path,
    artifacts_dir: Path | None,
    hindi_font_path: str,
    latin_font_path: str,
) -> dict[str, object]:
    image = case.make_image(_font(hindi_font_path, 40), _font(latin_font_path, 40))
    pdf_path = temp_dir / f"{case.name}.pdf"
    docx_path = temp_dir / f"{case.name}.docx"
    _image_only_pdf(image, pdf_path)

    started = time.perf_counter()
    result = subprocess.run(
        [sys.executable, str(repo / "scripts" / "pdf-to-docx.py"), str(pdf_path), str(docx_path)],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=180,
        env={
            **os.environ,
            "PDF_OCR_ENABLED": "true",
            "PDF_OCR_REQUIRED": "true",
            "PDF_OCR_LANGUAGES": "eng+hin",
            "PDF_OCR_DPI": "220",
            "PDF_OCR_MAX_PAGES": "10",
            "OMP_THREAD_LIMIT": "1",
        },
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    text, media, valid_docx = _docx_text(docx_path)
    recall, matched = _token_recall(case.expected_tokens, text)
    output_preview = False
    if artifacts_dir is not None and valid_docx:
        artifacts_dir.mkdir(parents=True, exist_ok=True)
        output_preview = _render_docx_preview(docx_path, artifacts_dir)
    if case.expect_success:
        passed = (
            result.returncode == 0
            and valid_docx
            and len(text.strip()) >= case.min_chars
            and media >= 1
            and recall >= case.min_recall
            and (artifacts_dir is None or output_preview)
        )
    else:
        passed = result.returncode != 0 and not valid_docx

    if artifacts_dir is not None:
        artifacts_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pdf_path, artifacts_dir / pdf_path.name)
        _render_pdf(pdf_path, artifacts_dir / f"{case.name}.png")
        if valid_docx:
            shutil.copy2(docx_path, artifacts_dir / docx_path.name)

    method_match = re.search(r"OCR_RESULT method=([^\s]+)", result.stderr)
    return {
        "name": case.name,
        "passed": passed,
        "expectedSuccess": case.expect_success,
        "returnCode": result.returncode,
        "durationMs": duration_ms,
        "sourceBytes": pdf_path.stat().st_size,
        "outputBytes": docx_path.stat().st_size if docx_path.exists() else 0,
        "validDocx": valid_docx,
        "outputPreviewRendered": output_preview,
        "editableCharacters": len(text.strip()),
        "mediaItems": media,
        "tokenRecall": round(recall, 4),
        "minimumRecall": case.min_recall,
        "matchedTokens": matched,
        "expectedTokens": list(case.expected_tokens),
        "method": method_match.group(1) if method_match else None,
        "stderrTail": result.stderr[-1600:],
    }


def main() -> int:
    repo = Path(__file__).resolve().parent.parent
    report_path = Path(sys.argv[1]) if len(sys.argv) > 1 else repo / "quality" / "phase2-pdf-to-word" / "latest-corpus-report.json"
    artifacts_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    report_path.parent.mkdir(parents=True, exist_ok=True)
    hindi_font_path = _find_font(DEVANAGARI_FONT_CANDIDATES)
    latin_font_path = _find_font(LATIN_FONT_CANDIDATES)

    started = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="onlymypdf-phase23b-") as temp:
        temp_dir = Path(temp)
        results = [
            _run_case(
                case,
                repo=repo,
                temp_dir=temp_dir,
                artifacts_dir=artifacts_dir,
                hindi_font_path=hindi_font_path,
                latin_font_path=latin_font_path,
            )
            for case in _cases()
        ]

    passed = all(bool(result["passed"]) for result in results)
    report = {
        "phase": "2.3B",
        "benchmark": "Hindi, mixed-language and difficult image-only PDF corpus",
        "passed": passed,
        "engine": "PyMuPDF + Tesseract eng+hin + pdf2docx",
        "languages": "eng+hin",
        "durationMs": round((time.perf_counter() - started) * 1000),
        "caseCount": len(results),
        "passedCases": sum(1 for result in results if result["passed"]),
        "failedCases": [result["name"] for result in results if not result["passed"]],
        "cases": results,
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
