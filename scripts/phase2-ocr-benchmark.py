#!/usr/bin/env python3
"""Deterministic Phase 2.3 image-only PDF to editable DOCX benchmark."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

import pymupdf as fitz


EXPECTED_TOKENS = {
    "onlymypdf",
    "invoice",
    "quality",
    "benchmark",
    "september",
    "48932",
    "editable",
    "accuracy",
    "table",
    "total",
}


def make_image_only_pdf(path: Path) -> None:
    source = fitz.open()
    page = source.new_page(width=612, height=792)
    page.insert_text((54, 80), "OnlyMyPDF OCR Quality Benchmark", fontsize=22)
    page.insert_text((54, 126), "Invoice 48932 - 18 September 2026", fontsize=15)
    page.insert_text((54, 176), "This image-only scan must become editable Word text.", fontsize=13)
    page.insert_text((54, 208), "Accuracy table: Subtotal 1250.00  Tax 225.00  Total 1475.00", fontsize=13)
    page.insert_text((54, 240), "Quality benchmark reference: conversion result verified.", fontsize=13)
    pix = page.get_pixmap(dpi=180, colorspace=fitz.csRGB, alpha=False)
    source.close()

    scan = fitz.open()
    scan_page = scan.new_page(width=612, height=792)
    scan_page.insert_image(scan_page.rect, stream=pix.tobytes("png"))
    scan.save(path, garbage=4, deflate=True)
    scan.close()


def docx_text(path: Path) -> tuple[str, int]:
    with zipfile.ZipFile(path) as archive:
        xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
        media = sum(1 for name in archive.namelist() if name.startswith("word/media/"))
    chunks = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", xml)
    return " ".join(chunks), media


def main() -> int:
    repo = Path(__file__).resolve().parent.parent
    output_arg = Path(sys.argv[1]) if len(sys.argv) > 1 else repo / "quality" / "phase2-pdf-to-word" / "latest-report.json"
    output_arg.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="onlymypdf-ocr-benchmark-") as temp:
        temp_dir = Path(temp)
        pdf_path = temp_dir / "image-only-scan.pdf"
        docx_path = temp_dir / "image-only-scan.docx"
        make_image_only_pdf(pdf_path)

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
                "PDF_OCR_LANGUAGES": "eng",
                "PDF_OCR_DPI": "220",
                "PDF_OCR_MAX_PAGES": "10",
                "OMP_THREAD_LIMIT": "1",
            },
        )
        duration_ms = round((time.perf_counter() - started) * 1000)

        text = ""
        media = 0
        if result.returncode == 0 and docx_path.exists():
            text, media = docx_text(docx_path)
        normalized = set(re.findall(r"[a-z0-9]+", text.lower()))
        matched = sorted(EXPECTED_TOKENS & normalized)
        token_recall = len(matched) / len(EXPECTED_TOKENS)
        passed = (
            result.returncode == 0
            and docx_path.exists()
            and docx_path.stat().st_size >= 1500
            and len(text.strip()) >= 120
            and token_recall >= 0.9
        )

        report = {
            "phase": "2.3A",
            "benchmark": "image-only PDF to editable DOCX",
            "passed": passed,
            "engine": "PyMuPDF + Tesseract + pdf2docx",
            "language": "eng",
            "durationMs": duration_ms,
            "sourceBytes": pdf_path.stat().st_size,
            "outputBytes": docx_path.stat().st_size if docx_path.exists() else 0,
            "editableCharacters": len(text.strip()),
            "mediaItems": media,
            "tokenRecall": round(token_recall, 4),
            "matchedTokens": matched,
            "expectedTokens": sorted(EXPECTED_TOKENS),
            "stderrTail": result.stderr[-2000:],
        }
        output_arg.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2))
        return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
