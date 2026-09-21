#!/usr/bin/env python3
"""Deterministic table-and-image PDFs for local capacity checks; no external data."""

from __future__ import annotations

import io
import json
import random
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "quality" / "phase2-production" / "generated"
OUTPUT.mkdir(parents=True, exist_ok=True)


def jpeg(seed: int) -> bytes:
    # Noise is a conservative, poorly-compressible stand-in for document photos.
    rng = random.Random(seed)
    picture = Image.frombytes("RGB", (1000, 700), rng.randbytes(1000 * 700 * 3))
    stream = io.BytesIO()
    picture.save(stream, format="JPEG", quality=88)
    return stream.getvalue()


def make_pdf(name: str, page_count: int) -> dict[str, object]:
    pdf = fitz.open()
    for page_no in range(1, page_count + 1):
        page = pdf.new_page(width=612, height=792)
        page.insert_text((48, 45), f"OnlyMyPDF capacity report - page {page_no}", fontsize=15)
        page.insert_text((48, 68), "Item                 Quantity       Amount", fontsize=11)
        for row in range(1, 9):
            y = 74 + row * 25
            page.draw_line((45, y + 6), (565, y + 6), color=(0.7, 0.7, 0.7))
            page.insert_text(
                (48, y),
                f"BENCH-P{page_no:02d}-R{row:02d}             {row + page_no:03d}           {row * 19.95:,.2f}",
                fontsize=10,
                fontname="cour",
            )
        for image_no, x in enumerate((48, 312), start=1):
            page.insert_image(
                fitz.Rect(x, 325, x + 250, 500),
                stream=jpeg(20260922 + page_no * 10 + image_no),
            )
        page.insert_text((48, 535), "Synthetic images plus selectable invoice rows", fontsize=10)
    target = OUTPUT / name
    pdf.save(target, garbage=4, deflate=True)
    pdf.close()
    return {"file": str(target.relative_to(ROOT)).replace("\\", "/"), "pages": page_count, "bytes": target.stat().st_size}


print(json.dumps({"fixtures": [
    make_pdf("mixed-4-page.pdf", 4),
    make_pdf("mixed-8-page.pdf", 8),
    make_pdf("mixed-22-page.pdf", 22),
    make_pdf("mixed-23-page.pdf", 23),
]}, indent=2))
