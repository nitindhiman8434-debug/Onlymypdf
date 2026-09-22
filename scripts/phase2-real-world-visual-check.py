#!/usr/bin/env python3
"""Compare embedded Office page references with public PDF source renders."""

from __future__ import annotations

import io
import json
import re
import zipfile
from pathlib import Path

import fitz
from PIL import Image, ImageChops, ImageStat


ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "quality" / "phase2-production" / "real-world"
REPORT = ROOT / "quality" / "phase2-production" / "local-real-world-visual-report.json"
CASES = [
    ("irs-form-1040-2025", "pdf-to-word", ".docx", "word/media/"),
    ("irs-form-1040-2025", "pdf-to-ppt", ".pptx", "ppt/media/"),
    ("arxiv-2010.12647", "pdf-to-ppt", ".pptx", "ppt/media/"),
    ("archives-declaration-scan", "pdf-to-ppt", ".pptx", "ppt/media/"),
]


def media_number(name: str) -> int:
    match = re.search(r"image(\d+)", name)
    return int(match.group(1)) if match else 0


report = {"note": "Mean absolute RGB pixel difference (0-255) measures embedded page-reference images only, not complete editable Office layout.", "cases": []}
for stem, tool, extension, prefix in CASES:
    source = CORPUS / f"{stem}.pdf"
    output = CORPUS / f"{stem}-{tool}{extension}"
    with fitz.open(source) as pdf, zipfile.ZipFile(output) as archive:
        media = sorted((name for name in archive.namelist() if name.startswith(prefix)), key=media_number)
        if len(media) != len(pdf):
            raise ValueError(f"{output.name}: expected {len(pdf)} page images, found {len(media)}")
        page_mae = []
        for page, name in zip(pdf, media):
            embedded = Image.open(io.BytesIO(archive.read(name))).convert("RGB")
            rendered = page.get_pixmap(
                matrix=fitz.Matrix(embedded.width / page.rect.width, embedded.height / page.rect.height),
                colorspace=fitz.csRGB, alpha=False,
            )
            source_image = Image.frombytes("RGB", (rendered.width, rendered.height), rendered.samples)
            if source_image.size != embedded.size:
                source_image = source_image.resize(embedded.size, Image.Resampling.LANCZOS)
            difference = ImageChops.difference(source_image, embedded)
            page_mae.append(round(sum(ImageStat.Stat(difference).mean) / 3, 3))
        report["cases"].append({"source": source.name, "tool": tool, "pages": len(pdf),
                                "pageReferenceMae": page_mae, "maxMae": max(page_mae)})

REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
