"""Generate deterministic, source-visible PDFs for the Phase 2.3C workbook gate."""

import json
import os
import sys

import fitz


def table_page(doc, rows, *, landscape=False, ruled=True):
    page = doc.new_page(width=792 if landscape else 612, height=612 if landscape else 792)
    xs = [48, 270, 355, 455, 555] if len(rows[0]) == 4 else [48, 210, 365, 520]
    top = 65
    height = 36
    if ruled:
        for x in xs:
            page.draw_line((x, top), (x, top + len(rows) * height), color=(0.2, 0.2, 0.2))
        for row_index in range(len(rows) + 1):
            y = top + row_index * height
            page.draw_line((xs[0], y), (xs[-1], y), color=(0.2, 0.2, 0.2))
    for row_index, row in enumerate(rows):
        for col_index, value in enumerate(row):
            page.insert_text((xs[col_index] + 6, top + row_index * height + 23), value, fontsize=10)
    return page


def save(doc, output_dir, name):
    path = os.path.join(output_dir, name + ".pdf")
    doc.save(path, garbage=4, deflate=True)
    for page_index, page in enumerate(doc):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        pix.save(os.path.join(output_dir, f"{name}-page-{page_index + 1}.png"))
    doc.close()


def main(output_dir):
    os.makedirs(output_dir, exist_ok=True)

    invoice_rows = [
        ["Item", "Qty", "Unit Price", "Amount"],
        ["Notebook", "2", "$12.50", "$25.00"],
        ["Pen", "3", "$1.20", "$3.60"],
        ["Discount", "1", "(2.00)", "(2.00)"],
    ]
    doc = fitz.open()
    table_page(doc, invoice_rows)
    save(doc, output_dir, "ruled-invoice")

    borderless_rows = [
        ["Code", "Description", "Count", "Rate"],
        ["00123", "Paper Clips", "15", "12.5%"],
        ["00007", "Binder Box", "2", "7.0%"],
        ["1234567890123456", "=SUM(A1:A3)", "0", "0%"],
    ]
    doc = fitz.open()
    table_page(doc, borderless_rows, ruled=False)
    save(doc, output_dir, "borderless-table")

    doc = fitz.open()
    table_page(doc, [["Year", "Units", "Amount"], ["2024", "10", "1,250"], ["2025", "12", "1,500"]])
    table_page(doc, [["Year", "Units", "Amount"], ["2026", "15", "1,875"], ["2027", "18", "2,250"]])
    save(doc, output_dir, "multi-page-table")

    doc = fitz.open()
    cover = doc.new_page(width=612, height=792)
    cover.insert_text((48, 85), "Quarterly summary cover", fontsize=16)
    table_page(doc, [["Region", "Orders", "Value"], ["North", "42", "9,100"]], landscape=True)
    save(doc, output_dir, "mixed-orientation")

    doc = fitz.open()
    source = table_page(doc, invoice_rows)
    image_bytes = source.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).tobytes("png")
    doc.close()
    scanned = fitz.open()
    page = scanned.new_page()
    page.insert_image(page.rect, stream=image_bytes)
    save(scanned, output_dir, "image-only-table")

    print(json.dumps({"cases": 5, "outputDir": output_dir}))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: phase2-excel-corpus.py <output_dir>")
    main(sys.argv[1])
