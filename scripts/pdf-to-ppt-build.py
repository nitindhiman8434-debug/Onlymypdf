"""Render PDF pages in parallel and build a PPTX with editable text layers.

Each slide shows the PDF page image. Full page text is stored in:
1) the slide Notes pane (primary — click Notes below the slide to edit), and
2) an off-slide "Page text" shape (View → Selection Pane → Page text).
"""
from __future__ import annotations

import json
import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from multiprocessing import cpu_count

try:
    import fitz
except ImportError:
    print(json.dumps({"error": "pymupdf not installed. Run: pip install pymupdf"}))
    sys.exit(1)

try:
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from PIL import Image
except ImportError:
    print(json.dumps({"error": "python-pptx and Pillow required. Run: pip install python-pptx pillow"}))
    sys.exit(1)

PT_PER_INCH = 72.0
MIN_TEXT_CHARS = 12
TEXT_MARGIN_IN = 0.12


def resolve_target_width(page_count: int) -> int:
    if page_count <= 30:
        return 1920
    if page_count <= 80:
        return 1440
    if page_count <= 200:
        return 1280
    if page_count <= 400:
        return 960
    return 720


def resolve_image_format(page_count: int) -> str:
    return "JPEG" if page_count > 80 else "PNG"


def resolve_jpeg_quality(page_count: int) -> int:
    """Lower quality slightly for long documents — visually identical on slides, much smaller files."""
    if page_count <= 80:
        return 85
    if page_count <= 200:
        return 80
    if page_count <= 400:
        return 76
    return 72


def save_slide_image(pix, out_path: str, image_format: str, jpeg_quality: int) -> None:
    if image_format == "JPEG":
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        img.save(
            out_path,
            format="JPEG",
            quality=jpeg_quality,
            optimize=True,
            progressive=True,
            subsampling=2,
        )
    else:
        pix.pil_save(out_path, format="PNG", optimize=True)


def pt_to_inches(pt: float) -> float:
    return pt / PT_PER_INCH


def clean_text(value: str) -> str:
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value)


def resolve_slide_size_inches(sizes: list[tuple[float, float]]) -> tuple[float, float]:
    if not sizes:
        return 10.0, 7.5
    if len(sizes) == 1:
        return sizes[0]
    portrait = sum(1 for w, h in sizes if h >= w)
    landscape = len(sizes) - portrait
    dominant_portrait = portrait >= landscape
    pool = [(w, h) for w, h in sizes if (h >= w if dominant_portrait else w > h)] or sizes
    return max(w for w, _ in pool), max(h for _, h in pool)


def add_page_text_layer(
    slide,
    page: fitz.Page,
    slide_w_in: float,
    slide_h_in: float,
) -> bool:
    lines = extract_page_lines(page)
    full_text = "\n".join(lines)
    if len(full_text.strip()) < MIN_TEXT_CHARS:
        return False

    # Primary edit surface: Notes pane (View → Notes in PowerPoint).
    notes_tf = slide.notes_slide.notes_text_frame
    notes_tf.clear()
    notes_tf.text = full_text
    for index, paragraph in enumerate(notes_tf.paragraphs):
        if paragraph.text.strip():
            paragraph.font.size = Pt(11)

    # Backup edit surface: Selection Pane → "Page text" (visible, off-slide).
    box = slide.shapes.add_textbox(
        Inches(-slide_w_in - 0.25),
        Inches(0),
        Inches(max(0.5, slide_w_in - TEXT_MARGIN_IN * 2)),
        Inches(max(0.5, slide_h_in - TEXT_MARGIN_IN * 2)),
    )
    box.name = "Page text"
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

    for index, line in enumerate(lines):
        paragraph = tf.paragraphs[0] if index == 0 else tf.add_paragraph()
        paragraph.text = line
        paragraph.font.size = Pt(11)

    return True


def extract_page_lines(page: fitz.Page) -> list[str]:
    lines: list[str] = []
    data = page.get_text("dict")
    text_blocks = sorted(
        [b for b in data.get("blocks", []) if b.get("type") == 0],
        key=lambda b: (round(b["bbox"][1], 1), round(b["bbox"][0], 1)),
    )
    for block in text_blocks:
        for line in block.get("lines", []):
            text = clean_text("".join(span.get("text", "") for span in line.get("spans", [])))
            if text.strip():
                lines.append(text)
    return lines


def render_one_page(
    pdf_path: str,
    page_index: int,
    target_width: int,
    output_dir: str,
    image_format: str,
    jpeg_quality: int,
) -> dict:
    doc = fitz.open(pdf_path)
    try:
        page = doc[page_index]
        scale = target_width / page.rect.width
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        ext = "jpg" if image_format == "JPEG" else "png"
        out_path = os.path.join(output_dir, f"slide{page_index + 1:04d}.{ext}")
        save_slide_image(pix, out_path, image_format, jpeg_quality)
        return {
            "page": page_index + 1,
            "path": out_path,
            "widthPt": round(page.rect.width, 4),
            "heightPt": round(page.rect.height, 4),
        }
    finally:
        doc.close()


def build_pptx(pdf_path: str, pages: list[dict], output_path: str) -> int:
    sizes = [(pt_to_inches(p["widthPt"]), pt_to_inches(p["heightPt"])) for p in pages]
    slide_w_in, slide_h_in = resolve_slide_size_inches(sizes)

    prs = Presentation()
    prs.slide_width = Inches(slide_w_in)
    prs.slide_height = Inches(slide_h_in)
    blank = prs.slide_layouts[6]

    doc = fitz.open(pdf_path)
    editable_slides = 0
    try:
        for page in pages:
            slide = prs.slides.add_slide(blank)
            slide.shapes.add_picture(
                page["path"],
                Inches(0),
                Inches(0),
                width=Inches(pt_to_inches(page["widthPt"])),
                height=Inches(pt_to_inches(page["heightPt"])),
            )
            pdf_page = doc[page["page"] - 1]
            if add_page_text_layer(slide, pdf_page, slide_w_in, slide_h_in):
                editable_slides += 1
    finally:
        doc.close()

    prs.save(output_path)
    return editable_slides


def main() -> None:
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: python pdf-to-ppt-build.py <input.pdf> <slides-dir> <output.pptx>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    output_path = sys.argv[3]

    if not os.path.isfile(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    doc = fitz.open(pdf_path)
    page_count = doc.page_count
    doc.close()

    if page_count == 0:
        print(json.dumps({"error": "No pages found in the PDF file."}))
        sys.exit(1)

    target_width = resolve_target_width(page_count)
    image_format = resolve_image_format(page_count)
    jpeg_quality = resolve_jpeg_quality(page_count)
    workers = max(1, min(4, cpu_count() or 1))

    pages: list[dict] = []
    tasks = [
        (pdf_path, i, target_width, output_dir, image_format, jpeg_quality)
        for i in range(page_count)
    ]

    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(render_one_page, *task) for task in tasks]
        for future in as_completed(futures):
            pages.append(future.result())

    pages.sort(key=lambda p: p["page"])
    editable_slides = build_pptx(pdf_path, pages, output_path)

    print(
        json.dumps(
            {
                "pageCount": page_count,
                "editableSlides": editable_slides,
                "targetWidth": target_width,
                "imageFormat": image_format,
                "jpegQuality": jpeg_quality,
                "workers": workers,
                "outputPath": output_path,
                "outputSizeBytes": os.path.getsize(output_path),
                "mode": "hybrid_editable",
            }
        )
    )


if __name__ == "__main__":
    main()
