#!/usr/bin/env python3
"""Verify pdf2docx includes the last page in single, chunk and OCR paths."""

from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("pdf_to_docx", ROOT / "scripts" / "pdf-to-docx.py")
assert spec and spec.loader
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)


def docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    return "".join(node.text or "" for node in root.findall(".//w:t", ns))


def assert_pages(path: Path, expected: list[int]) -> None:
    text = docx_text(path)
    found = [page for page in range(1, 4) if f"LAST-PAGE-{page}" in text]
    if found != expected:
        raise AssertionError(f"{path.name}: expected {expected}, found {found}")


with tempfile.TemporaryDirectory(prefix="onlymypdf-last-page-") as temp_name:
    temp = Path(temp_name)
    pdf_path = temp / "three-pages.pdf"
    pdf = fitz.open()
    for page_no in range(1, 4):
        page = pdf.new_page()
        page.insert_text((72, 72), f"LAST-PAGE-{page_no} Important editable text", fontsize=16)
    pdf.save(pdf_path)
    pdf.close()

    single = temp / "single.docx"
    converter.convert_pdf_single(str(pdf_path), str(single), 3, image_heavy=False, drawing_heavy=False)
    assert_pages(single, [1, 2, 3])

    inprocess = temp / "inprocess-chunk.docx"
    converter._convert_page_range((str(pdf_path), 1, 2, str(inprocess), False))
    assert_pages(inprocess, [2, 3])

    subprocess_chunk = temp / "subprocess-chunk.docx"
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "pdf-to-docx-range.py"),
         str(pdf_path), str(subprocess_chunk), "1", "2"],
        check=True, capture_output=True, text=True,
    )
    assert_pages(subprocess_chunk, [2, 3])

    # The OCR recognition step is substituted with a known searchable PDF.
    # This checks page selection in the OCR conversion branch, not OCR quality.
    def prepared_searchable(source: str, target: str, *, language: str, dpi: int):
        shutil.copyfile(source, target)
        return 3, 120, ["LAST-PAGE-1", "LAST-PAGE-2", "LAST-PAGE-3"]

    converter._build_searchable_ocr_pdf = prepared_searchable
    ocr_branch = temp / "ocr-branch.docx"
    if not converter.convert_scanned_pdf_with_ocr(str(pdf_path), str(ocr_branch), language="eng"):
        raise AssertionError("OCR branch failed to create a DOCX from a searchable PDF")
    assert_pages(ocr_branch, [1, 2, 3])

print(json.dumps({"single": "3/3", "chunkInProcess": "2/2", "chunkSubprocess": "2/2",
                  "ocrConversionBranch": "3/3 (searchable input stub; OCR recognition not tested)"}))
