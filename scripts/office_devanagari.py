"""Keep selectable Devanagari clusters together before Office layout/shaping.

PDF glyph positioning can split a pre-base vowel sign into a second, overlapping
text line. Rejoining that continuation in source order preserves the logical
Unicode string; sorting its characters by x coordinate would corrupt it.
"""
from __future__ import annotations

import copy
import os
import re
import unicodedata


def has_devanagari(text: str) -> bool:
    return any("\u0900" <= char <= "\u097f" for char in text)


def span_text(span: dict) -> str:
    return span.get("text", "".join(char["c"] for char in span.get("chars", [])))


def line_text(line: dict) -> str:
    return "".join(span_text(span) for span in line.get("spans", []))


def union_bounds(first, second) -> tuple:
    return (min(first[0], second[0]), min(first[1], second[1]),
            max(first[2], second[2]), max(first[3], second[3]))


def devanagari_font(source_name: str = "") -> str:
    """Resolve PDF internal names to Office families with a script-capable fallback."""
    name = re.sub(r"^[A-Z]{6}\+", "", source_name)
    if name.startswith("NirmalaUI"):
        return "Nirmala UI" if os.name == "nt" else "Noto Sans Devanagari"
    if name.startswith("NotoSansDevanagari"):
        return "Noto Sans Devanagari"
    if name.startswith("NotoSerifDevanagari"):
        return "Noto Serif Devanagari"
    if name.startswith("Mangal"):
        return "Mangal" if os.name == "nt" else "Noto Sans Devanagari"
    return "Nirmala UI" if os.name == "nt" else "Noto Sans Devanagari"


def _joins_cluster(previous: dict, following: dict) -> bool:
    text = line_text(following).lstrip()
    if not text or not (has_devanagari(text[0]) and unicodedata.category(text[0]).startswith("M")):
        return False
    previous_text = line_text(previous).rstrip()
    if not previous_text or not has_devanagari(previous_text[-1]):
        return False
    if previous.get("dir", (1, 0)) != following.get("dir", (1, 0)):
        return False
    left, right = previous["bbox"], following["bbox"]
    height = min(left[3] - left[1], right[3] - right[1])
    # A different row or a different table cell must never be joined.
    return (height > 0 and abs(left[1] - right[1]) <= max(0.5, height * 0.08)
            and min(left[2], right[2]) > max(left[0], right[0]))


def normalize_devanagari_blocks(blocks: list[dict]) -> list[dict]:
    """Return copies, merging only Devanagari mark continuations and compatible runs."""
    if not any(has_devanagari(line_text(line)) for block in blocks for line in block.get("lines", [])):
        return blocks
    result = copy.deepcopy(blocks)
    previous = None
    for block in result:
        if block.get("type", 0) != 0:
            previous = None
            continue
        kept = []
        for line in block.get("lines", []):
            if previous is not None and _joins_cluster(previous, line):
                previous["spans"].extend(line["spans"])
                previous["bbox"] = union_bounds(previous["bbox"], line["bbox"])
            else:
                kept.append(line)
                previous = line
        block["lines"] = kept

    for block in result:
        for line in block.get("lines", []):
            if not has_devanagari(line_text(line)):
                continue
            script_font = devanagari_font(next(
                (span.get("font", "") for span in line["spans"] if has_devanagari(span_text(span))), ""))
            runs = []
            for span in line["spans"]:
                # Explicit spaces in their own fallback-font run otherwise get
                # discarded by pdf2docx's Spans.restore(). Keep them in the run.
                span["font"] = script_font
                if "text" in span:
                    span["text"] = span["text"].replace("\u00a0", " ")
                for char in span.get("chars", []):
                    char["c"] = char["c"].replace("\u00a0", " ")
                if (runs and not span_text(span).strip()
                        and all(runs[-1].get(key) == span.get(key) for key in ("size", "color"))):
                    span["flags"] = runs[-1].get("flags")
                compatible = runs and all(
                    runs[-1].get(key) == span.get(key) for key in ("size", "color", "flags"))
                if compatible:
                    previous_span = runs[-1]
                    if "chars" in span:
                        previous_span.setdefault("chars", []).extend(span["chars"])
                    else:
                        previous_span["text"] = span_text(previous_span) + span_text(span)
                    previous_span["bbox"] = union_bounds(previous_span["bbox"], span["bbox"])
                else:
                    runs.append(span)
            line["spans"] = runs
        if block.get("lines"):
            bounds = block["lines"][0]["bbox"]
            for line in block["lines"][1:]:
                bounds = union_bounds(bounds, line["bbox"])
            block["bbox"] = bounds
    return [block for block in result if block.get("type", 0) != 0 or block.get("lines")]


def install_pdf2docx_devanagari_support() -> None:
    """Adapt upstream extraction/formatting in this conversion process only."""
    from pdf2docx.page.RawPageFitz import RawPageFitz
    from pdf2docx.text.TextSpan import TextSpan
    from pdf2docx.table.TableBlock import TableBlock
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    if getattr(RawPageFitz, "_onlymypdf_devanagari", False):
        return
    original_extract = RawPageFitz._preprocess_text
    original_format = TextSpan._set_text_format
    original_table = TableBlock.make_docx

    def extract(self, **settings):
        return normalize_devanagari_blocks(original_extract(self, **settings))

    def format_span(self, run):
        original_format(self, run)
        if not has_devanagari(self.text):
            return
        props = run._element.get_or_add_rPr()
        font = devanagari_font(self.font)
        for script in ("ascii", "hAnsi", "eastAsia", "cs"):
            props.rFonts.set(qn("w:" + script), font)
        for tag, value in (("lang", "hi-IN"), ("szCs", str(round(self.size * 2)))):
            node = props.find(qn("w:" + tag))
            if node is None:
                node = OxmlElement("w:" + tag)
                props.append(node)
            node.set(qn("w:" + ("bidi" if tag == "lang" else "val")), value)
        run.font.cs_bold = bool(self.flags & 16)
        run.font.cs_italic = bool(self.flags & 2)

    def make_table(self, table):
        original_table(self, table)
        synchronize_fixed_table_grid(table)

    RawPageFitz._preprocess_text = extract
    TextSpan._set_text_format = format_span
    TableBlock.make_docx = make_table
    RawPageFitz._onlymypdf_devanagari = True


def synchronize_fixed_table_grid(table) -> bool:
    """Use agreed source cell widths instead of python-docx's equal default grid.

    Word and LibreOffice resolve contradictory grid/cell widths differently.
    Only change fixed, rectangular tables with explicit consistent widths; do
    not guess widths for merged, omitted, proportional or irregular cells.
    """
    from docx.oxml.ns import qn

    if table.autofit is not False:
        return False
    grid = table._tbl.tblGrid.gridCol_lst
    widths = None
    for row in table._tbl.tr_lst:
        if len(row.tc_lst) != len(grid):
            return False
        if row.trPr is not None and any(row.trPr.find(qn("w:" + tag)) is not None
                                       for tag in ("gridBefore", "gridAfter")):
            return False
        row_widths = []
        for cell in row.tc_lst:
            props = cell.tcPr
            if props is None or any(props.find(qn("w:" + tag)) is not None
                                    for tag in ("gridSpan", "vMerge")):
                return False
            width = props.find(qn("w:tcW"))
            if width is None or width.get(qn("w:type")) != "dxa":
                return False
            try:
                value = int(width.get(qn("w:w"), "0"))
            except ValueError:
                return False
            if value <= 0:
                return False
            row_widths.append(value)
        if widths is not None and row_widths != widths:
            return False
        widths = row_widths
    if not widths:
        return False
    for col, width in zip(grid, widths):
        col.set(qn("w:w"), str(width))
    table_width = table._tbl.tblPr.find(qn("w:tblW"))
    if table_width is not None:
        table_width.set(qn("w:type"), "dxa")
        table_width.set(qn("w:w"), str(sum(widths)))
    return True
