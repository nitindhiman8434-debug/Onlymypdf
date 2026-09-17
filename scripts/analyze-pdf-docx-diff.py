#!/usr/bin/env python3
"""Deep compare PDF source vs DOCX conversion output."""
from __future__ import annotations

import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

import fitz


def normalize_text(text: str) -> str:
    text = text.replace("\u00ad", "")  # soft hyphen
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()


def pdf_analysis(pdf_path: Path) -> dict:
    doc = fitz.open(pdf_path)
    pages = []
    all_text_parts: list[str] = []
    total_images = 0
    total_drawings = 0

    for i, page in enumerate(doc):
        text = page.get_text()
        words = page.get_text("words")
        imgs = page.get_images(full=True)
        drawings = page.get_drawings()
        blocks = page.get_text("dict")["blocks"]

        text_blocks = [b for b in blocks if b.get("type") == 0]
        image_blocks = [b for b in blocks if b.get("type") == 1]

        all_text_parts.append(text)
        total_images += len(imgs)
        total_drawings += len(drawings)

        pages.append(
            {
                "page": i + 1,
                "size_pt": (round(page.rect.width, 1), round(page.rect.height, 1)),
                "word_spans": len(words),
                "text_chars": len(text.strip()),
                "text_blocks": len(text_blocks),
                "image_blocks": len(image_blocks),
                "embedded_images": len(imgs),
                "drawings": len(drawings),
                "preview": normalize_text(text)[:160],
            }
        )

    full_text = "\n".join(all_text_parts)
    doc.close()

    # Unique lines/phrases from PDF
    lines = [normalize_text(l) for l in full_text.splitlines() if normalize_text(l)]
    line_counter = Counter(lines)

    return {
        "pages": len(pages),
        "size_mb": round(pdf_path.stat().st_size / 1024 / 1024, 2),
        "total_text_chars": len(full_text.strip()),
        "total_embedded_images": total_images,
        "total_drawings": total_drawings,
        "unique_lines": len(line_counter),
        "page_stats": pages,
        "top_repeated_lines": line_counter.most_common(15),
        "full_text_normalized": normalize_text(full_text),
    }


def docx_analysis(docx_path: Path) -> dict:
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read("word/document.xml").decode("utf-8", "replace")
        media = [n for n in z.namelist() if n.startswith("word/media/")]
        media_sizes = {n: z.getinfo(n).file_size for n in media}

    texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", xml)
    joined = "".join(texts)
    full_normalized = normalize_text(joined)

    pg = re.search(r'w:pgSz w:w="(\d+)" w:h="(\d+)"', xml)
    page_size = None
    if pg:
        page_size = (round(int(pg.group(1)) / 20, 1), round(int(pg.group(2)) / 20, 1))

    return {
        "size_mb": round(docx_path.stat().st_size / 1024 / 1024, 2),
        "text_chars": len(joined.strip()),
        "unique_snippets": len(set(t.strip() for t in texts if t.strip())),
        "media_count": len(media),
        "media_total_bytes": sum(media_sizes.values()),
        "anchors": xml.count("wp:anchor"),
        "inlines": xml.count("wp:inline"),
        "drawings": xml.count("w:drawing"),
        "tables": xml.count("<w:tbl"),
        "textboxes": xml.count("w:txbxContent"),
        "page_size_pt": page_size,
        "sample_texts": [t for t in texts if t.strip()][:30],
        "full_text_normalized": full_normalized,
    }


def compare_text(pdf_norm: str, docx_norm: str) -> dict:
    pdf_words = set(re.findall(r"[a-z0-9]{3,}", pdf_norm))
    docx_words = set(re.findall(r"[a-z0-9]{3,}", docx_norm))

    missing_words = sorted(pdf_words - docx_words)
    extra_words = sorted(docx_words - pdf_words)

    # Long tokens likely to be part numbers, addresses
    missing_important = [w for w in missing_words if len(w) >= 4][:80]

    coverage = 0.0
    if pdf_words:
        coverage = round(100 * len(pdf_words & docx_words) / len(pdf_words), 1)

    return {
        "pdf_unique_tokens": len(pdf_words),
        "docx_unique_tokens": len(docx_words),
        "token_coverage_pct": coverage,
        "missing_token_count": len(missing_words),
        "missing_important_sample": missing_important[:50],
        "extra_token_sample": extra_words[:30],
    }


def main() -> int:
    pdf_path = Path(sys.argv[1])
    docx_path = Path(sys.argv[2])

    pdf = pdf_analysis(pdf_path)
    docx = docx_analysis(docx_path)
    diff = compare_text(pdf["full_text_normalized"], docx["full_text_normalized"])

    print("=== PDF SUMMARY ===")
    print(json.dumps({k: v for k, v in pdf.items() if k not in ("page_stats", "full_text_normalized", "top_repeated_lines")}, indent=2))
    print("\n=== PDF PAGE SAMPLE (first 3) ===")
    print(json.dumps(pdf["page_stats"][:3], indent=2))
    print("\n=== PDF PAGE SAMPLE (last 2) ===")
    print(json.dumps(pdf["page_stats"][-2:], indent=2))

    print("\n=== DOCX SUMMARY ===")
    print(json.dumps({k: v for k, v in docx.items() if k not in ("sample_texts", "full_text_normalized")}, indent=2))

    print("\n=== TEXT DIFF ===")
    print(json.dumps(diff, indent=2))

    char_ratio = 0.0
    if pdf["total_text_chars"]:
        char_ratio = round(100 * docx["text_chars"] / pdf["total_text_chars"], 1)
    print(f"\nchar_coverage_pct: {char_ratio}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
