"""Render each PDF page to a PNG image using PyMuPDF."""
import sys
import os
import json

try:
    import fitz
except ImportError:
    print(json.dumps({"error": "pymupdf not installed. Run: pip install pymupdf"}))
    sys.exit(1)


def resolve_target_width(page_count: int) -> int:
    """Lower resolution for large PDFs — faster render, smaller PPTX, less memory."""
    if page_count <= 30:
        return 1920
    if page_count <= 80:
        return 1440
    if page_count <= 200:
        return 1280
    return 960


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python pdf-render-pages.py <input.pdf> <output-dir> [width|auto]"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    width_arg = sys.argv[3] if len(sys.argv) > 3 else "auto"

    if not os.path.isfile(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    pdf = fitz.open(pdf_path)
    page_count = pdf.page_count

    if width_arg == "auto":
        target_width = resolve_target_width(page_count)
    else:
        target_width = int(width_arg)

    pages = []

    for i in range(page_count):
        pg = pdf[i]
        scale = target_width / pg.rect.width
        mat = fitz.Matrix(scale, scale)
        pix = pg.get_pixmap(matrix=mat, alpha=False)

        out_path = os.path.join(output_dir, f"slide{i + 1}.png")
        pix.pil_save(out_path, format="PNG", optimize=True)

        pages.append({
            "page": i + 1,
            "width": pix.width,
            "height": pix.height,
            "widthPt": round(pg.rect.width, 4),
            "heightPt": round(pg.rect.height, 4),
            "path": out_path,
        })

    pdf.close()

    print(json.dumps({
        "pageCount": page_count,
        "targetWidth": target_width,
        "pages": pages,
    }))

if __name__ == "__main__":
    main()
