#!/usr/bin/env python3
"""Page-by-page PDF vs DOCX text coverage + drawing-heavy page detection."""
from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path

import fitz


def norm(s: str) -> str:
    s = s.replace("\u00ad", "").replace("\uf0e3", "©")
    return re.sub(r"\s+", " ", s).strip().lower()


def docx_text_by_approx_page(xml: str) -> list[str]:
    """Split DOCX text on explicit page breaks."""
    parts = re.split(r'<w:br[^>]*w:type="page"[^>]*/>', xml)
    chunks = []
    for part in parts:
        texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", part)
        chunks.append(norm("".join(texts)))
    return chunks


def main() -> int:
    pdf_path = Path(sys.argv[1])
    docx_path = Path(sys.argv[2])

    doc = fitz.open(pdf_path)
    pdf_pages = []
    for page in doc:
        pdf_pages.append(norm(page.get_text()))
    doc.close()

    with zipfile.ZipFile(docx_path) as z:
        xml = z.read("word/document.xml").decode("utf-8", "replace")
    docx_pages = docx_text_by_approx_page(xml)

    print(f"pdf_pages={len(pdf_pages)} docx_page_chunks={len(docx_pages)}")
    print("\n=== LOW COVERAGE PAGES ===")
    low = []
    for i, pdf_text in enumerate(pdf_pages):
        docx_text = docx_pages[i] if i < len(docx_pages) else ""
        pdf_tokens = set(re.findall(r"[a-z0-9]{3,}", pdf_text))
        docx_tokens = set(re.findall(r"[a-z0-9]{3,}", docx_text))
        cov = 100 * len(pdf_tokens & docx_tokens) / max(1, len(pdf_tokens))
        if cov < 75 or len(docx_text) < len(pdf_text) * 0.6:
            low.append((i + 1, round(cov, 1), len(pdf_text), len(docx_text), pdf_text[:100]))
    for row in sorted(low, key=lambda x: x[1])[:20]:
        print(row)

    print("\n=== DRAWING-HEAVY PDF PAGES ===")
    doc = fitz.open(pdf_path)
    heavy = []
    for i, page in enumerate(doc):
        d = len(page.get_drawings())
        w = len(page.get_text("words"))
        if d > 100:
            heavy.append((i + 1, d, w, norm(page.get_text())[:80]))
    doc.close()
    for row in heavy[:15]:
        print(row)
    print(f"total_drawing_heavy_pages={len(heavy)}")

    # Missing hex/register patterns
    pdf_all = " ".join(pdf_pages)
    docx_all = " ".join(docx_pages)
    hex_pdf = set(re.findall(r"0x[0-9a-f]{2,4}", pdf_all))
    hex_docx = set(re.findall(r"0x[0-9a-f]{2,4}", docx_all))
    print(f"\nhex_in_pdf={len(hex_pdf)} hex_in_docx={len(hex_docx)} missing_hex={sorted(hex_pdf-hex_docx)[:30]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
