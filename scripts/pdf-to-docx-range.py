#!/usr/bin/env python3
"""Convert an inclusive page range from PDF to DOCX (chunk worker for large PDFs)."""
from __future__ import annotations

import os
import sys


def optimal_settings(page_count: int = 1, *, image_heavy: bool = False) -> dict:
    cpus = min(4, os.cpu_count() or 2)
    use_mp = page_count > 4 and sys.platform != "win32"
    parse_tables = not image_heavy and page_count <= 200
    return {
        "multi_processing": use_mp,
        "cpu_count": cpus if use_mp else 1,
        "ignore_page_error": True,
        "delete_end_line_hyphen": True,
        "parse_lattice_table": parse_tables,
        "parse_stream_table": False,
        "list_not_table": False,
    }


def main() -> int:
    if len(sys.argv) != 5:
        print(
            "Usage: pdf-to-docx-range.py <input.pdf> <output.docx> <start> <end>",
            file=sys.stderr,
        )
        return 1

    from pdf2docx import Converter

    pdf_path, docx_path, start, end = (
        sys.argv[1],
        sys.argv[2],
        int(sys.argv[3]),
        int(sys.argv[4]),
    )
    pages = end - start + 1
    cv = Converter(pdf_path)
    try:
        cv.convert(
            docx_path,
            start=start,
            end=end + 1,  # CLI chunk range is inclusive; pdf2docx is exclusive.
            **optimal_settings(pages, image_heavy=False),
        )
    finally:
        cv.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
