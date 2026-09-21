"""
Extract tables from a PDF using PyMuPDF table detection + word-position grid fallback.
Outputs JSON with per-page export tables (Smallpdf-style: Table 1, Table 2, ...).

Usage: python pdf-extract-tables.py <input.pdf> <output_dir>
"""

import sys
import os
import json
import re
import warnings

warnings.filterwarnings("ignore")
os.environ["PYMUPDF_MESSAGE"] = "fd:2"

import fitz

try:
    fitz.TOOLS.mupdf_warnings(False)
except Exception:
    pass


def clean_cell(value, preserve_newlines=False):
    """Clean a cell value: strip whitespace, normalize newlines."""
    if value is None:
        return ""
    s = str(value).strip()
    if preserve_newlines:
        s = s.replace("\r\n", "\n").replace("\r", "\n")
        lines = []
        for line in s.split("\n"):
            line = line.strip()
            while "  " in line:
                line = line.replace("  ", " ")
            lines.append(line)
        return "\n".join(part for part in lines if part).strip()
    s = s.replace("\n", " ").replace("\r", " ")
    while "  " in s:
        s = s.replace("  ", " ")
    return s.strip()


def normalize_row(row):
    return tuple(clean_cell(c).lower() for c in row)


def is_likely_header(row):
    """A header row has mostly alphabetic/word-like cells."""
    cleaned = [clean_cell(c) for c in row]
    non_empty = [c for c in cleaned if c]
    if len(non_empty) < 2:
        return False

    alpha_word_count = 0
    for c in non_empty:
        stripped = c.replace(" ", "").replace(".", "").replace("-", "").replace("(", "").replace(")", "")
        if stripped and stripped[0].isalpha() and sum(1 for ch in stripped if ch.isalpha()) > len(stripped) * 0.6:
            alpha_word_count += 1

    return alpha_word_count >= len(non_empty) * 0.6


def trim_table_rows(rows, preserve_wide=False, preserve_newlines=False):
    """Drop empty edge columns and normalize row widths."""
    if not rows:
        return []

    max_cols = max(len(r) for r in rows)
    normalized = [list(r) + [""] * (max_cols - len(r)) for r in rows]

    if not preserve_wide:
        while max_cols > 1:
            if all(clean_cell(r[max_cols - 1]) == "" for r in normalized):
                max_cols -= 1
            else:
                break

    normalized = [r[:max_cols] for r in normalized]

    if not preserve_wide:
        populated_columns = [
            index
            for index in range(max_cols)
            if any(clean_cell(row[index]) for row in normalized)
        ]
        if populated_columns:
            normalized = [[row[index] for index in populated_columns] for row in normalized]
            max_cols = len(populated_columns)
        lead = 0
        while lead < max_cols - 1:
            if all(clean_cell(r[lead]) == "" for r in normalized):
                lead += 1
            else:
                break
        if lead:
            normalized = [r[lead:] for r in normalized]

    trimmed = []
    for row in normalized:
        trimmed.append(
            [clean_cell(c, preserve_newlines=preserve_newlines) for c in row]
        )

    return trimmed


def table_dict(rows, preserve_wide=False, preserve_newlines=False):
    rows = trim_table_rows(
        rows, preserve_wide=preserve_wide, preserve_newlines=preserve_newlines
    )
    if not rows:
        return None
    return {
        "rows": rows,
        "row_count": len(rows),
        "col_count": len(rows[0]),
    }


def is_meaningful_table(table):
    if not table:
        return False
    if table["row_count"] < 2 or table["col_count"] < 2:
        return False
    non_empty_cells = sum(
        1 for row in table["rows"] for cell in row if clean_cell(cell)
    )
    return non_empty_cells >= 4


def report_progress(page_idx, page_count):
    if page_count <= 0:
        return
    pct = min(99, int((page_idx + 1) / page_count * 100))
    print(f"PROGRESS pct={pct}", file=sys.stderr, flush=True)


def text_lines_to_grid(text):
    """Turn plain page text into rows/columns using tabs or multi-space gaps."""
    rows = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if "\t" in stripped:
            rows.append([clean_cell(c) for c in stripped.split("\t")])
            continue
        parts = [clean_cell(c) for c in re.split(r"\s{2,}", stripped) if clean_cell(c)]
        rows.append(parts if len(parts) > 1 else [stripped])
    return trim_table_rows(rows)


def words_to_grid(page, x_merge=5, y_tol=3.5, min_gap=8):
    """Build a spreadsheet grid from word positions when table detection fails."""
    words = page.get_text("words")
    if not words:
        return []

    all_x0 = sorted(round(w[0]) for w in words)
    col_x = []
    for x in all_x0:
        if not col_x or x - col_x[-1] > x_merge:
            col_x.append(x)
        else:
            col_x[-1] = (col_x[-1] + x) // 2

    rows_by_y = {}
    for w in words:
        x0, y0, x1, y1, text, *_rest = w
        y_key = round((y0 + y1) / 2 / y_tol) * y_tol
        rows_by_y.setdefault(y_key, []).append((x0, x1, text))

    grid = []
    for y_key in sorted(rows_by_y.keys()):
        items = sorted(rows_by_y[y_key], key=lambda t: t[0])
        cols = []
        current = ""
        last_x1 = None
        for x0, x1, text in items:
            if last_x1 is not None and x0 - last_x1 > min_gap:
                cols.append(clean_cell(current))
                current = text
            else:
                current = f"{current} {text}".strip() if current else text
            last_x1 = x1
        cols.append(clean_cell(current))
        if any(cols):
            grid.append(cols)

    if not grid:
        return []

    if len(col_x) >= 3:
        aligned = []
        for y_key in sorted(rows_by_y.keys()):
            cells = [""] * len(col_x)
            for x0, _x1, text in sorted(rows_by_y[y_key], key=lambda t: t[0]):
                col_idx = min(range(len(col_x)), key=lambda i: abs(col_x[i] - x0))
                if cells[col_idx]:
                    cells[col_idx] = f"{cells[col_idx]} {text}".strip()
                else:
                    cells[col_idx] = text
            if any(clean_cell(c) for c in cells):
                aligned.append([clean_cell(c) for c in cells])
        if aligned and max(len(r) for r in aligned) >= 3:
            return trim_table_rows(aligned)

    return trim_table_rows(grid)


def rows_from_table_object(table_obj, preserve_newlines=False):
    extracted = table_obj.extract()
    rows = []
    for row in extracted:
        cleaned = [clean_cell(c, preserve_newlines=preserve_newlines) for c in row]
        rows.append(cleaned)
    return rows


def extract_find_tables(page):
    """Detect tables; try alternate strategies only when the default finds nothing."""
    results = []
    seen = set()

    strategy_kwargs = [
        {},
        {"vertical_strategy": "lines_strict", "horizontal_strategy": "lines"},
    ]

    for kwargs in strategy_kwargs:
        try:
            tabs = page.find_tables(**kwargs) if kwargs else page.find_tables()
        except Exception:
            continue

        for t in tabs.tables:
            rows = rows_from_table_object(t)
            if not rows:
                continue
            signature = (
                len(rows),
                len(rows[0]),
                normalize_row(rows[0]),
            )
            if signature in seen:
                continue
            seen.add(signature)
            results.append(rows)

        if results and not kwargs:
            break

    return results


def table_completeness_score(table, source_bonus=0):
    if not table:
        return 0
    numeric = 0
    non_empty = 0
    single_char = 0
    for row in table["rows"]:
        for cell in row:
            value = clean_cell(cell)
            if not value or value == "-":
                continue
            non_empty += 1
            if len(value) == 1 and value.isalpha():
                single_char += 1
            if re.match(r"^[\d,.\-]+$", value.replace(",", "")):
                numeric += 1
    return (
        non_empty
        + numeric * 2
        + table["col_count"] * 2
        + table["row_count"]
        + source_bonus
        - single_char * 1.5
    )


def group_words_by_y(words, y_tol=3.0):
    rows_by_y = {}
    for w in words:
        x0, y0, x1, y1, text, *_rest = w
        y_key = round((y0 + y1) / 2 / y_tol) * y_tol
        rows_by_y.setdefault(y_key, []).append(w)
    return rows_by_y


def page_has_detected_tables(page):
    try:
        return len(page.find_tables().tables) > 0
    except Exception:
        return False


def parse_smallpdf_month_anchors(page, y_tol=3.0):
    """Extract 60 month column centers from the PARTICULARS header row."""
    words = page.get_text("words")
    if not words:
        return None

    rows_by_y = group_words_by_y(words, y_tol)
    for _y, row_words in sorted(rows_by_y.items()):
        header_words = sorted(row_words, key=lambda w: w[0])
        particulars_idx = None
        for i, w in enumerate(header_words):
            if w[4] == "PARTICULARS":
                particulars_idx = i
                break
        if particulars_idx is None:
            continue

        month_words = [
            w for w in header_words[particulars_idx + 1 :] if w[4].isdigit()
        ]
        if len(month_words) >= 60:
            month_words = month_words[:60]
        elif len(month_words) >= 12:
            pass
        else:
            continue

        month_anchors = [(w[0] + w[2]) / 2 for w in month_words]
        return month_anchors

    return None


def build_smallpdf_col_x(month_anchors, with_section=True):
    """
    SmallPDF layout:
    - Table 1: section (A) + particulars + 60 months = 62 columns
    - Tables 2–6: particulars + 60 months = 61 columns
    """
    if not month_anchors or len(month_anchors) < 12:
        return None
    anchors = month_anchors[:60] if len(month_anchors) >= 60 else month_anchors
    label_x = 45.0
    if with_section:
        return [10.0, label_x] + anchors
    return [label_x] + anchors


def is_section_letter_word(word):
    text = word[4].strip()
    return bool(re.match(r"^[A-Z]$", text)) and word[0] < 55


def page_uses_section_column(page, y_tol=3.0):
    """True when the page uses column A for section labels (revenue / cash-flow sheets)."""
    words = page.get_text("words")
    if not words:
        return False
    has_a = any(is_section_letter_word(w) for w in words)
    has_particulars = any(w[4] == "PARTICULARS" for w in words)
    if not has_a:
        return False
    joined = " ".join(w[4] for w in words).upper()
    if has_particulars:
        return True
    return any(
        marker in joined
        for marker in (
            "REVENUE",
            "CASH FLOW",
            "MARKETING",
            "OVERHEADS",
            "FIXED ASSETS",
            "INDIRECT EXPENSES",
        )
    )


def month_start_col(col_x):
    """First month data column index (0-based)."""
    if not col_x:
        return 2
    return 2 if len(col_x) >= 62 else 1


def label_col_index(col_x):
    """Particulars / row label column index (0-based)."""
    return 1 if col_x and len(col_x) >= 62 else 0


def year_header_columns(col_x):
    """Fixed SmallPDF year header positions for 5-year grids."""
    if col_x and len(col_x) >= 62:
        return [2, 14, 26, 38, 50]
    if col_x and len(col_x) >= 61:
        return [1, 13, 25, 37, 49]
    start = month_start_col(col_x)
    return [start + i * 12 for i in range(5)]


def parse_financial_column_anchors(page, y_tol=3.0):
    """Build 62-column anchors for full 5-year (40+ month) financial tables."""
    month_anchors = parse_smallpdf_month_anchors(page, y_tol)
    if month_anchors and len(month_anchors) >= 40:
        count = min(60, len(month_anchors))
        return build_smallpdf_col_x(
            month_anchors[:count],
            with_section=page_uses_section_column(page, y_tol),
        )
    return None


def resolve_page_col_x(page, global_col_x=None, y_tol=3.0):
    """Per-page column anchors respecting section vs label-only layouts."""
    with_section = page_uses_section_column(page, y_tol)
    anchors = parse_smallpdf_month_anchors(page, y_tol)

    if global_col_x and is_financial_smallpdf_grid(global_col_x):
        if anchors and len(anchors) >= 40:
            count = min(60, len(anchors))
            return build_smallpdf_col_x(anchors[:count], with_section=with_section)
        month_anchors = global_col_x[2:] if len(global_col_x) >= 62 else global_col_x[1:]
        count = min(60, len(month_anchors))
        return build_smallpdf_col_x(month_anchors[:count], with_section=with_section)

    if anchors:
        count = min(60, len(anchors))
        return build_smallpdf_col_x(anchors[:count], with_section=with_section)
    if global_col_x and len(global_col_x) >= 50:
        month_anchors = global_col_x[2:] if len(global_col_x) >= 62 else global_col_x[1:]
        count = min(60, len(month_anchors))
        return build_smallpdf_col_x(month_anchors[:count], with_section=with_section)
    return global_col_x


def get_spreadsheet_col_x(page, y_tol=3.0):
    """Derive fixed column anchors from the PARTICULARS header row."""
    financial = parse_financial_column_anchors(page, y_tol)
    if financial:
        return financial

    words = page.get_text("words")
    if not words:
        return None

    rows_by_y = group_words_by_y(words, y_tol)
    for _y, row_words in sorted(rows_by_y.items()):
        if any(w[4] == "PARTICULARS" for w in row_words):
            return [w[0] for w in sorted(row_words, key=lambda w: w[0])]
    return None


def build_enhanced_col_x(page, y_tol=3.0):
    """Prefer precise 5-year month grid; fall back to generic header anchors."""
    financial = parse_financial_column_anchors(page, y_tol)
    if financial:
        return financial
    return get_spreadsheet_col_x(page, y_tol)


def count_table_cells(table):
    if not table:
        return 0
    return sum(1 for row in table["rows"] for cell in row if clean_cell(cell))


def assign_word_column(x_pos, col_x):
    for index in range(len(col_x) - 1):
        boundary = (col_x[index] + col_x[index + 1]) / 2
        if x_pos < boundary:
            return index
    return len(col_x) - 1


def assign_word_to_column(word, col_x, is_numeric=False):
    """Assign word to column using SmallPDF zones: section | particulars | months."""
    text = word[4]
    month_start = month_start_col(col_x)
    month_cols = col_x[month_start:] if month_start < len(col_x) else col_x
    first_month_left = (month_cols[0] - 15) if month_cols else 130

    if is_numeric_word(text) or text.strip() == "-":
        month_idx = assign_word_column((word[0] + word[2]) / 2, month_cols)
        return month_idx + month_start

    if len(col_x) >= 62 and is_section_letter_word(word):
        return 0

    if word[0] < first_month_left:
        return label_col_index(col_x)

    x_pos = (word[0] + word[2]) / 2
    return assign_word_column(x_pos, col_x)


def is_numeric_word(text):
    stripped = text.replace(",", "").replace("$", "").strip()
    if stripped == "-":
        return False
    return bool(re.match(r"^[\d\-]+$", stripped)) and stripped.isdigit()


def is_data_cell_word(text):
    stripped = text.replace(",", "").replace("$", "").strip()
    return stripped == "-" or (stripped.isdigit() and stripped != "")


def is_year_header_word(text):
    upper = text.upper()
    return "YEAR" in upper and any(
        marker in upper for marker in ("1ST", "2ND", "3RD", "4TH", "5TH")
    )


def row_has_year_headers(row_words):
    joined = " ".join(w[4] for w in row_words).upper()
    if re.search(r"\d+(ST|ND|RD|TH)\s+YEAR", joined):
        return True
    return joined.count("YEAR") >= 3


def format_smallpdf_header_rows(row_words, col_x, target_cols):
    """Convert PARTICULARS header row into SmallPDF-style layout."""
    cells = [""] * target_cols
    section_row = [""] * target_cols
    has_particulars = False
    has_section_a = len(col_x) >= 62
    month_words = []
    label_col = label_col_index(col_x)
    start_col = month_start_col(col_x)

    for w in sorted(row_words, key=lambda w: w[0]):
        text = w[4]
        if text == "PARTICULARS":
            has_particulars = True
            cells[label_col] = "PARTICULARS"
        elif has_particulars and text.isdigit():
            month_words.append(w)
        elif is_section_letter_word(w):
            section_row[0] = w[4].strip()
        elif not has_particulars and text == "REVENUE":
            section_row[label_col] = "REVENUE"

    max_months = max(0, target_cols - start_col)
    for i, w in enumerate(month_words[:max_months]):
        val = w[4].replace(",", "")
        cells[start_col + i] = int(val) if val.isdigit() else val

    if has_particulars:
        rows = [cells]
        if section_row[0] or section_row[label_col]:
            rows.append(section_row)
        return rows
    return None


def format_year_header_row(row_words, col_x, target_cols):
    """Place 1ST YEAR, 2ND YEAR, ... at fixed SmallPDF column positions."""
    if not row_has_year_headers(row_words):
        return None

    cells = [""] * target_cols
    year_cols = year_header_columns(col_x)
    year_labels = ["1ST YEAR", "2ND YEAR", "3RD YEAR", "4TH YEAR", "5TH YEAR"]
    joined = " ".join(w[4] for w in row_words).upper()

    placed = False
    for i, label in enumerate(year_labels):
        marker = label.split()[0]
        if marker in joined and i < len(year_cols) and year_cols[i] < target_cols:
            cells[year_cols[i]] = label
            placed = True

    return [cells] if placed else None


def row_words_to_smallpdf_cells(row_words, col_x, target_cols):
    """Convert one PDF text row into SmallPDF-style 62-column cells."""
    if any(w[4] == "PARTICULARS" for w in row_words):
        header_rows = format_smallpdf_header_rows(row_words, col_x, target_cols)
        if header_rows:
            return header_rows

    sorted_words = sorted(row_words, key=lambda w: w[0])
    if row_has_year_headers(sorted_words):
        year_row = format_year_header_row(row_words, col_x, target_cols)
        if year_row:
            return year_row

    label_words = []
    data_words = []
    for w in sorted_words:
        if is_data_cell_word(w[4]):
            data_words.append(w)
        else:
            label_words.append(w)

    cells = [""] * target_cols
    label_col = label_col_index(col_x)
    month_start = month_start_col(col_x)
    first_month_x = col_x[month_start] if month_start < len(col_x) else 9999

    for w in label_words:
        text = w[4].strip()
        if len(col_x) >= 62 and is_section_letter_word(w):
            cells[0] = w[4].strip()
            break

    label_parts = []
    for w in label_words:
        text = w[4]
        if len(col_x) >= 62 and is_section_letter_word(w) and cells[0] == text.strip():
            continue
        if w[0] < first_month_x - 8:
            label_parts.append(text)
    if label_parts:
        cells[label_col] = clean_cell(" ".join(label_parts))

    if len(data_words) >= 40:
        for idx, w in enumerate(data_words):
            col_idx = month_start + idx
            if col_idx >= target_cols:
                break
            val = w[4].replace(",", "").replace("$", "").strip()
            if val == "-":
                cells[col_idx] = "-"
            elif val.isdigit():
                cells[col_idx] = int(val)
            else:
                cells[col_idx] = val
    else:
        for w in data_words:
            col_idx = assign_word_to_column(w, col_x)
            if col_idx >= target_cols:
                continue
            val = w[4].replace(",", "").replace("$", "").strip()
            if val == "-":
                cells[col_idx] = "-"
            elif val.isdigit():
                cells[col_idx] = int(val)
            else:
                cells[col_idx] = val

    return [cells]


def use_smallpdf_row_layout(col_x):
    """Use label + sequential month layout when grid has at least 12 month columns."""
    return bool(col_x) and len(col_x) >= 14


def is_financial_smallpdf_grid(col_x):
    """True for full 5-year cannabis-style grids (section + particulars + 60 months)."""
    return bool(col_x) and len(col_x) >= 50


def page_financial_col_x(page, y_tol=3.0):
    """Build per-page financial column anchors when the page has a month header row."""
    anchors = parse_smallpdf_month_anchors(page, y_tol)
    if anchors and len(anchors) >= 12:
        return build_smallpdf_col_x(
            anchors[: min(60, len(anchors))],
            with_section=page_uses_section_column(page, y_tol),
        )
    return None


def generic_spreadsheet_words_to_grid(page, col_x, y_tol=3.0):
    """Map words to columns using anchors — for non-financial PDFs."""
    words = page.get_text("words")
    if not words or not col_x:
        return []

    rows_by_y = group_words_by_y(words, y_tol)
    grid = []
    for _y, row_words in sorted(rows_by_y.items()):
        cells = [""] * len(col_x)
        for w in sorted(row_words, key=lambda w: w[0]):
            x_center = (w[0] + w[2]) / 2
            col_idx = assign_word_column(x_center, col_x)
            text = w[4]
            if cells[col_idx]:
                cells[col_idx] = f"{cells[col_idx]} {text}".strip()
            else:
                cells[col_idx] = text
        if any(clean_cell(c) for c in cells):
            grid.append([clean_cell(c) for c in cells])
    return grid


def spreadsheet_words_to_grid(page, col_x, y_tol=2.5):
    """Financial pages use label + sequential months; others use generic word grid."""
    if not use_smallpdf_row_layout(col_x):
        return generic_spreadsheet_words_to_grid(page, col_x, y_tol) if col_x else []

    words = page.get_text("words")
    if not words or not col_x:
        return []

    target_cols = len(col_x)
    rows_by_y = group_words_by_y(words, y_tol)
    grid = []
    for _y, row_words in sorted(rows_by_y.items()):
        for row in row_words_to_smallpdf_cells(row_words, col_x, target_cols):
            if any(c != "" for c in row):
                grid.append(row)
    return grid


def is_repeat_spreadsheet_header(cells):
    text = " ".join(clean_cell(c) for c in cells if clean_cell(c)).upper()
    if not text:
        return True
    if "PARTICULARS" in text:
        return True
    if text.count("YEAR") >= 2:
        return True
    if text in ("CASH FLOW", "REVENUE MODEL & PROJECTIONS"):
        return True
    if "MODEL" in text and "PROJECTIONS" in text:
        return True
    return False


def is_cannabis_financial_document(doc):
    """Detect Thailand cannabis revenue / cash-flow projection PDFs."""
    for page_idx in range(min(doc.page_count, 20)):
        text = doc[page_idx].get_text("text").upper()
        if not text.strip():
            continue
        if "PARTICULARS" in text and any(
            marker in text
            for marker in ("REVENUE", "CASH FLOW", "YEAR", "CANNABIS", "STORE")
        ):
            return True
    return False


def build_synthetic_60_month_anchors(doc):
    """Extrapolate a 60-month grid from the widest month-header row in the document."""
    best_anchors = None
    for page_idx in range(doc.page_count):
        if not doc[page_idx].get_text("text").strip():
            continue
        month_anchors = parse_smallpdf_month_anchors(doc[page_idx])
        if month_anchors and (best_anchors is None or len(month_anchors) > len(best_anchors)):
            best_anchors = month_anchors
    if not best_anchors or len(best_anchors) < 12:
        return None
    if len(best_anchors) >= 60:
        return best_anchors[:60]
    spacings = [best_anchors[i + 1] - best_anchors[i] for i in range(len(best_anchors) - 1)]
    avg_spacing = sum(spacings) / len(spacings)
    anchors = list(best_anchors)
    while len(anchors) < 60:
        anchors.append(anchors[-1] + avg_spacing)
    return anchors[:60]


def first_content_page_index(doc):
    for page_idx in range(doc.page_count):
        if doc[page_idx].get_text("text").strip():
            return page_idx
    return 0


def build_global_spreadsheet_col_x(doc):
    """Use the page with the most month columns (prefer 60, accept 40+)."""
    best_anchors = None
    best_len = 0
    best_page = 0
    for page_idx in range(doc.page_count):
        if not doc[page_idx].get_text("text").strip():
            continue
        month_anchors = parse_smallpdf_month_anchors(doc[page_idx])
        if month_anchors and len(month_anchors) > best_len:
            best_len = len(month_anchors)
            best_anchors = month_anchors
            best_page = page_idx
    if best_anchors and best_len >= 40:
        count = min(60, best_len)
        with_section = page_uses_section_column(doc[best_page])
        return build_smallpdf_col_x(best_anchors[:count], with_section=with_section)
    return None


def resolve_spreadsheet_mode(doc):
    """Use word-grid spreadsheet extraction for wide landscape financial PDFs."""
    global_col_x = build_global_spreadsheet_col_x(doc)
    if global_col_x and is_financial_smallpdf_grid(global_col_x):
        page = doc[first_content_page_index(doc)]
        is_landscape = page.rect.width > page.rect.height
        if is_landscape and len(global_col_x) >= 50:
            return True, global_col_x

        if not any(
            page_has_detected_tables(doc[page_idx])
            for page_idx in range(doc.page_count)
            if doc[page_idx].get_text("text").strip()
        ):
            return True, global_col_x

        merged_table = table_dict(merge_page_find_tables(page))
        spread_table = table_dict(spreadsheet_words_to_grid(page, global_col_x))
        if spread_table and merged_table:
            if spread_table["col_count"] >= merged_table["col_count"] + 3:
                return True, global_col_x
            if count_table_cells(spread_table) >= count_table_cells(merged_table) * 0.98:
                return True, global_col_x

    if is_cannabis_financial_document(doc):
        synthetic = build_synthetic_60_month_anchors(doc)
        if synthetic:
            content_page = doc[first_content_page_index(doc)]
            with_section = page_uses_section_column(content_page)
            forced_col_x = build_smallpdf_col_x(synthetic, with_section=with_section)
            if forced_col_x:
                return True, forced_col_x

    return False, global_col_x


FRAGMENT_LABELS = frozenset({
    "REVENUE", "MODEL &", "PROJECTIONS", "FROM", "STORE", "SALE",
    "DETAILED", "MLY", "SUMMARY", "A REVENUE", "OPERATIONAL", "MANAGER",
    "EXPENSES", "OVERHEADS", "CASH FLOW", "FIXED", "ASSETS",
})


def normalize_financial_cell(value):
    if isinstance(value, int):
        return value
    c = clean_cell(value)
    if not c:
        return ""
    if c == "-":
        return "-"
    stripped = c.replace(",", "").replace("$", "")
    if re.match(r"^[\d\-]+$", stripped) and stripped.isdigit():
        return int(stripped)
    return c


def normalize_financial_rows(rows):
    return [[normalize_financial_cell(c) for c in row] for row in rows]


def count_fragment_label_rows(table):
    """Count rows that look vertically split (word-grid fragmentation)."""
    count = 0
    for row in table["rows"][:30]:
        label = clean_cell(row[1] if len(row) > 1 else row[0]).upper()
        if label in FRAGMENT_LABELS:
            count += 1
        elif len(label) <= 12 and label in ("FROM STORE", "SALE (FLOWERS)", "1ST YEAR 2ND YEAR"):
            count += 1
    return count


def is_fragmented_vs(table_a, table_b):
    """True if table_a is more vertically fragmented than table_b."""
    if not table_a or not table_b:
        return False
    if table_a["row_count"] > table_b["row_count"] * 1.25:
        return True
    return count_fragment_label_rows(table_a) > count_fragment_label_rows(table_b) + 2


def pick_best_table(candidates):
    meaningful = [table for table in candidates if is_meaningful_table(table)]
    if not meaningful:
        return None

    def score(table):
        cells = count_table_cells(table)
        frags = count_fragment_label_rows(table)
        wide_bonus = 0
        if table["col_count"] >= 50:
            wide_bonus += 8000
        elif table["col_count"] >= 40:
            wide_bonus += 3000
        elif table["col_count"] >= 20:
            wide_bonus += 800
        row_penalty = max(0, table["row_count"] - 45) * 8
        avg_row_fill = cells / max(table["row_count"], 1)
        return cells + wide_bonus + avg_row_fill - frags * 250 - row_penalty

    return max(meaningful, key=score)


def should_force_spreadsheet(col_x, page):
    if not col_x or len(col_x) < 20:
        return False
    if page.rect.width > page.rect.height and len(col_x) >= 40:
        return True
    return len(col_x) >= 50


def pad_rows_to_width(rows, target_width):
    """Pad every row to a fixed column width (SmallPDF wide grid)."""
    if not rows or target_width <= 0:
        return rows
    padded = []
    for row in rows:
        cells = list(row) + [""] * max(0, target_width - len(row))
        padded.append(cells[:target_width])
    return padded


def extract_portrait_padded_table(page, global_col_x):
    """Portrait partial pages: keep find_tables row fidelity, pad to global width."""
    merged_rows = merge_page_find_tables(page)
    if not merged_rows:
        return None
    target_width = len(global_col_x)
    rows = normalize_financial_rows(pad_rows_to_width(merged_rows, target_width))
    return table_dict(rows, preserve_wide=True)


def extract_spreadsheet_page_table(page, col_x):
    rows = spreadsheet_words_to_grid(page, col_x)
    rows = normalize_financial_rows(rows)
    return table_dict(rows, preserve_wide=True)


def page_has_full_financial_grid(page, y_tol=3.0):
    anchors = parse_smallpdf_month_anchors(page, y_tol)
    return bool(anchors and len(anchors) >= 24)


DOCUMENT_SECTION_RE = re.compile(r"^(\d+)\.\s")
DOCUMENT_SPLIT_SECTIONS = {3, 6, 8, 10, 12}

NARRATIVE_BULLET_STARTERS = (
    "Consumer pain",
    "Body-related",
    "Founder-side",
    "Brand challenge",
    "Launch structure",
    "Anti-counterfeit",
    "Formula discipline",
    "Sales approach",
    "Contract manufacturing",
    "Support model",
    "Brand model",
    "Operating model",
    "Inventory model",
    "Differentiate on",
    "Keep launch",
    "Use anti-counterfeit",
    "Grow D2C",
    "Primary model",
    "Primary sales",
    "Mass market",
    "Existing market",
    "Current shelf",
    "Recommended price",
    "Simple answer",
    "2ml sample",
)


def append_narrative_part(parts, line):
    """Merge PDF line-wraps; newline only between logical bullet blocks."""
    line = clean_cell(line)
    if not line:
        return
    if not parts:
        parts.append(line)
        return
    prev = parts[-1]
    if prev.rstrip().endswith(".") and any(line.startswith(starter) for starter in NARRATIVE_BULLET_STARTERS):
        parts.append(line)
        return
    parts[-1] = clean_cell(f"{prev} {line}")


def is_document_layout_pdf(doc):
    """Portrait/narrative PDFs with numbered sections (founder decks, summaries)."""
    if is_cannabis_financial_document(doc):
        return False

    sample_text = ""
    table_pages = 0
    numbered_sections = 0

    for page_idx in range(min(doc.page_count, 12)):
        page = doc[page_idx]
        text = page.get_text("text")
        if not text.strip():
            continue
        sample_text += text + "\n"
        numbered_sections += len(DOCUMENT_SECTION_RE.findall(text))
        if page_has_detected_tables(page):
            table_pages += 1

    if numbered_sections >= 3 and "PARTICULARS" not in sample_text.upper():
        return True

    joined = sample_text.upper()
    if (
        numbered_sections >= 2
        and table_pages >= 1
        and "REVENUE MODEL" not in joined
        and "CASH FLOW" not in joined
        and "PARTICULARS" not in joined
    ):
        return True

    return False


def cluster_document_columns(line_words, page_width):
    """Cluster words on one text line into columns using horizontal gaps."""
    if not line_words:
        return []

    sorted_words = sorted(line_words, key=lambda w: w[0])
    gap_threshold = max(28, page_width * 0.055)
    groups = [[sorted_words[0]]]
    last_x1 = sorted_words[0][2]

    for word in sorted_words[1:]:
        if word[0] - last_x1 > gap_threshold:
            groups.append([word])
        else:
            groups[-1].append(word)
        last_x1 = word[2]

    return [
        clean_cell(" ".join(item[4] for item in group))
        for group in groups
        if any(clean_cell(item[4]) for item in group)
    ]


def is_document_label_heading(cols, full_text, x0):
    """Short standalone labels such as 'Formats' or 'Recommended product architecture'."""
    if x0 > 58:
        return False
    if len(full_text) > 80:
        return False
    if DOCUMENT_SECTION_RE.match(full_text):
        return False
    if len(cols) >= 3:
        return False
    words = full_text.split()
    return 1 <= len(words) <= 8


def collect_page_table_blocks(page):
    blocks = []
    try:
        for table_obj in sorted(page.find_tables().tables, key=lambda t: t.bbox[1]):
            rows = [
                [clean_cell(cell, preserve_newlines=True) for cell in row]
                for row in rows_from_table_object(table_obj, preserve_newlines=True)
            ]
            rows = [row for row in rows if any(clean_cell(cell) for cell in row)]
            if rows:
                blocks.append(
                    {
                        "y0": table_obj.bbox[1],
                        "y1": table_obj.bbox[3],
                        "rows": rows,
                    }
                )
    except Exception:
        pass
    return blocks


def line_overlaps_table_block(y, blocks, tol=4.0):
    for block in blocks:
        if block["y0"] - tol <= y <= block["y1"] + tol:
            return True
    return False


def extract_document_page_table(page, y_tol=4.0):
    """Layout-aware page extraction for founder decks / summary documents."""
    words = page.get_text("words")
    if not words:
        return None

    page_width = page.rect.width
    table_blocks = collect_page_table_blocks(page)
    rows_by_y = group_words_by_y(words, y_tol)
    title_region_y = table_blocks[0]["y0"] if table_blocks else 99999

    elements = []
    paragraph_parts = []
    paragraph_y = None

    def flush_paragraph():
        nonlocal paragraph_parts, paragraph_y
        if paragraph_parts:
            merged = clean_cell("\n".join(paragraph_parts), preserve_newlines=True)
            if merged:
                elements.append((paragraph_y, [merged]))
            paragraph_parts = []
            paragraph_y = None

    for block in table_blocks:
        for row_index, row in enumerate(block["rows"]):
            elements.append((block["y0"] + row_index * 0.01, list(row)))

    for y in sorted(rows_by_y.keys()):
        if line_overlaps_table_block(y, table_blocks):
            continue

        line_words = sorted(rows_by_y[y], key=lambda w: w[0])
        cols = cluster_document_columns(line_words, page_width)
        full_text = clean_cell(" ".join(word[4] for word in line_words))
        if not full_text:
            continue

        x0 = line_words[0][0]

        if y < title_region_y - 4:
            flush_paragraph()
            elements.append((y, [full_text]))
            continue

        if DOCUMENT_SECTION_RE.match(full_text):
            flush_paragraph()
            elements.append((y, [full_text]))
            continue

        if is_document_label_heading(cols, full_text, x0):
            flush_paragraph()
            elements.append((y, [full_text]))
            continue

        if (
            len(cols) >= 2
            and all(len(col) <= 30 for col in cols)
            and all(col and col[0].isalpha() for col in cols)
            and x0 < 58
        ):
            flush_paragraph()
            elements.append((y, cols))
            continue

        if x0 >= 62 or (
            paragraph_parts
            and not re.match(r"^[A-Z0-9\"']", full_text)
        ):
            if paragraph_y is None:
                paragraph_y = y
            append_narrative_part(paragraph_parts, full_text)
            continue

        flush_paragraph()
        if len(cols) >= 2:
            elements.append((y, cols))
        else:
            elements.append((y, [full_text]))

    flush_paragraph()

    elements.sort(key=lambda item: item[0])
    output = [row for _, row in elements]
    output = merge_document_title_rows(output)
    return table_dict(output, preserve_newlines=True) if output else None


def merge_document_title_rows(rows):
    """Merge consecutive top-of-page title/navigation lines into one row."""
    if not rows:
        return rows

    merged = []
    title_parts = []
    body_started = False

    for row in rows:
        text = clean_cell(row[0] if row else "")
        is_section = bool(DOCUMENT_SECTION_RE.match(text))
        is_multi_col = len(row) >= 2 and sum(1 for cell in row if clean_cell(cell)) >= 2

        if not body_started and len(row) == 1 and text and not is_section:
            title_parts.append(text)
            continue

        if not body_started and is_multi_col:
            if title_parts:
                merged.append(["\n".join(title_parts)])
                title_parts = []
            merged.append(row)
            body_started = True
            continue

        body_started = True
        if title_parts:
            merged.append(["\n".join(title_parts)])
            title_parts = []
        merged.append(row)

    if title_parts:
        merged.append(["\n".join(title_parts)])

    return merged


def pad_rows_to_max_cols(rows, min_cols=1):
    if not rows:
        return []
    max_cols = max(max(len(row) for row in rows), min_cols)
    padded = []
    for row in rows:
        cells = list(row) + [""] * (max_cols - len(row))
        padded.append(cells[:max_cols])
    return padded


def split_document_export_tables(all_rows):
    """Split a long document into SmallPDF-style export tables at major sections."""
    normalized = pad_rows_to_max_cols(all_rows, min_cols=4)
    if not normalized:
        return []

    tables = []
    current = []

    for row in normalized:
        first_cell = clean_cell(row[0] if row else "")
        section_match = DOCUMENT_SECTION_RE.match(first_cell)
        if section_match and len(current) >= 6:
            section_num = int(section_match.group(1))
            if section_num in DOCUMENT_SPLIT_SECTIONS:
                tables.append(current)
                current = [row]
                continue
        current.append(row)

    if current:
        tables.append(current)

    return tables if tables else [normalized]


def build_document_export_tables(doc):
    """Extract numbered summary / deck PDFs with layout fidelity."""
    page_rows = []

    for page_idx in range(doc.page_count):
        report_progress(page_idx, doc.page_count)
        page = doc[page_idx]
        if not page.get_text("text").strip():
            continue

        table = extract_document_page_table(page)
        if not table:
            table = extract_complete_page_table(page)
        if table and table["rows"]:
            page_rows.append(table["rows"])

    print("PROGRESS pct=100", file=sys.stderr, flush=True)

    if not page_rows:
        return []

    combined = []
    for index, rows in enumerate(page_rows):
        if index > 0 and combined:
            combined.append([""] * max(len(row) for row in combined))
        combined.extend(rows)

    export = []
    for table_idx, rows in enumerate(split_document_export_tables(combined)):
        table = table_dict(rows, preserve_newlines=True)
        if table:
            export.append({**table, "page": table_idx + 1})

    return export


def build_export_tables_from_doc(doc):
    if is_document_layout_pdf(doc):
        return build_document_export_tables(doc), False, None

    spreadsheet_mode, global_col_x = resolve_spreadsheet_mode(doc)
    content_page = doc[first_content_page_index(doc)]
    if global_col_x and should_force_spreadsheet(global_col_x, content_page):
        spreadsheet_mode = True
    return build_export_tables(doc, spreadsheet_mode, global_col_x), spreadsheet_mode, global_col_x


def extract_complete_page_table(page, global_col_x=None):
    """Extract the most complete table content available for one PDF page."""
    financial_col_x = resolve_page_col_x(page, global_col_x)

    merged_rows = merge_page_find_tables(page)
    merged_table = table_dict(normalize_financial_rows(merged_rows)) if merged_rows else None

    spread_table = None
    if financial_col_x:
        spread_table = extract_spreadsheet_page_table(page, financial_col_x)

    # Full 62-column landscape financial PDF — always use word-grid spreadsheet.
    if spread_table and is_financial_smallpdf_grid(financial_col_x):
        if is_meaningful_table(spread_table):
            return spread_table

    candidates = []

    if spread_table and merged_table:
        if is_fragmented_vs(spread_table, merged_table):
            candidates.append(merged_table)
        else:
            candidates.append(spread_table)
            candidates.append(merged_table)
    elif spread_table:
        candidates.append(spread_table)
    elif merged_table:
        candidates.append(merged_table)

    best = pick_best_table(candidates)
    if best:
        return best

    # Borderless tables are often split into one column per word by the
    # positional fallback. PyMuPDF's text strategies retain multi-word cells.
    try:
        text_tables = page.find_tables(
            vertical_strategy="text", horizontal_strategy="text"
        ).tables
        text_candidates = []
        for detected in text_tables:
            rows = [row for row in rows_from_table_object(detected) if any(clean_cell(cell) for cell in row)]
            candidate = table_dict(rows)
            if is_meaningful_table(candidate):
                text_candidates.append(candidate)
        text_best = pick_best_table(text_candidates)
        if text_best:
            return text_best
    except Exception:
        pass

    words_table = table_dict(words_to_grid(page))
    if words_table and is_meaningful_table(words_table):
        return words_table

    text = page.get_text("text")
    if text.strip():
        return table_dict(text_lines_to_grid(text))
    return None


def build_master_table(export_tables, spreadsheet_mode=False):
    """Combine all page tables into one padded sheet for the full document."""
    if not export_tables:
        return None

    if spreadsheet_mode:
        max_cols = max(t["col_count"] for t in export_tables)
        combined = []
        for index, table in enumerate(export_tables):
            for row_idx, row in enumerate(table["rows"]):
                if index > 0 and row_idx < 4 and is_repeat_spreadsheet_header(row):
                    continue
                padded = list(row) + [""] * (max_cols - len(row))
                combined.append(padded[:max_cols])
            if index < len(export_tables) - 1:
                combined.append([""] * max_cols)
        return table_dict(combined)

    max_cols = max(t["col_count"] for t in export_tables)
    combined = []

    for index, table in enumerate(export_tables):
        page_no = table.get("page")
        if page_no:
            combined.append([f"Page {page_no}"] + [""] * (max_cols - 1))

        for row in table["rows"]:
            padded = list(row) + [""] * (max_cols - len(row))
            combined.append(padded[:max_cols])

        if index < len(export_tables) - 1:
            combined.append([""] * max_cols)

    return table_dict(combined)


def build_export_tables(doc, spreadsheet_mode=False, global_col_x=None):
    """One sheet per PDF page that contains tabular content (Table 1, Table 2, ...)."""
    export = []
    col_x = global_col_x or build_global_spreadsheet_col_x(doc)
    force_spreadsheet = spreadsheet_mode and is_financial_smallpdf_grid(col_x)

    for page_idx in range(doc.page_count):
        report_progress(page_idx, doc.page_count)
        page = doc[page_idx]
        if not page.get_text("text").strip():
            continue
        page_col_x = resolve_page_col_x(page, col_x)
        use_spreadsheet = bool(
            force_spreadsheet
            and page_col_x
            and (
                is_financial_smallpdf_grid(page_col_x)
                or is_financial_smallpdf_grid(col_x)
            )
        )
        if use_spreadsheet and col_x and not page_has_full_financial_grid(page):
            table = extract_portrait_padded_table(page, col_x)
        elif use_spreadsheet:
            table = extract_spreadsheet_page_table(page, page_col_x)
        else:
            table = extract_complete_page_table(page, col_x)
        if table:
            export.append({
                **table,
                "page": page_idx + 1,
            })

    print("PROGRESS pct=100", file=sys.stderr, flush=True)
    return export


def merge_page_find_tables(page):
    """Merge every detected table on a page (top-to-bottom) with padded columns."""
    try:
        tabs = page.find_tables().tables
    except Exception:
        return []

    if not tabs:
        return []

    paired = sorted(
        [(t.bbox[1], rows_from_table_object(t)) for t in tabs],
        key=lambda item: item[0],
    )

    max_cols = 0
    for _, rows in paired:
        for row in rows:
            max_cols = max(max_cols, len(row))

    if max_cols == 0:
        return []

    merged = []
    for index, (_, rows) in enumerate(paired):
        for row in rows:
            cleaned = [clean_cell(c) for c in row]
            padded = cleaned + [""] * (max_cols - len(cleaned))
            merged.append(padded[:max_cols])
        if index < len(paired) - 1:
            merged.append([""] * max_cols)

    return merged


def merge_page_tables(all_pages):
    """
    Merge tables across pages by column count (legacy fallback).
    """
    flat_tables = []
    for page_info in all_pages:
        for t in page_info["tables"]:
            if t["row_count"] > 0 and t["col_count"] > 0:
                flat_tables.append(t)

    if not flat_tables:
        return []

    by_col_count = {}
    for t in flat_tables:
        cc = t["col_count"]
        by_col_count.setdefault(cc, []).append(t)

    merged_results = []

    for col_count, tables in by_col_count.items():
        header = None
        header_norm = None
        for t in tables:
            if t["rows"] and is_likely_header(t["rows"][0]):
                header = t["rows"][0]
                header_norm = normalize_row(header)
                break

        combined_rows = []
        if header is not None:
            combined_rows.append(header)

        for t in tables:
            for row in t["rows"]:
                norm = normalize_row(row)
                if header_norm is not None and norm == header_norm:
                    continue
                if all(clean_cell(x) == "" for x in row):
                    continue
                combined_rows.append([clean_cell(c) for c in row])

        trimmed = trim_table_rows(combined_rows)
        if trimmed:
            merged_results.append({
                "rows": trimmed,
                "row_count": len(trimmed),
                "col_count": len(trimmed[0]),
            })

    merged_results.sort(key=lambda t: t["row_count"], reverse=True)
    return merged_results


def extract_tables(pdf_path, output_dir):
    doc = fitz.open(pdf_path)
    page_count = doc.page_count
    include_debug = page_count <= 100
    document_mode = is_document_layout_pdf(doc)
    unsupported_pages = []
    for page_idx in range(page_count):
        page = doc[page_idx]
        if not page.get_text("text").strip() and (page.get_images(full=True) or page.get_drawings()):
            unsupported_pages.append(page_idx + 1)
    if unsupported_pages:
        doc.close()
        pages = ", ".join(str(number) for number in unsupported_pages)
        raise ValueError(
            f"Pages {pages} have no selectable text. Run OCR before converting to Excel."
        )

    export_tables, spreadsheet_mode, global_col_x = build_export_tables_from_doc(doc)

    master_table = build_master_table(export_tables, spreadsheet_mode)

    print(
        json.dumps({
            "mode": (
                "spreadsheet"
                if spreadsheet_mode
                else ("document" if document_mode else "tables")
            ),
            "columns": export_tables[0]["col_count"] if export_tables else (len(global_col_x) if global_col_x else 0),
            "fallback": "uploaded_pdf_only",
        }),
        file=sys.stderr,
    )

    all_page_tables = []
    if include_debug and not export_tables:
        for page_idx in range(page_count):
            page = doc[page_idx]
            page_tables = []

            for rows in extract_find_tables(page):
                table = table_dict(rows)
                if table:
                    page_tables.append(table)

            if not page_tables:
                word_table = table_dict(words_to_grid(page))
                if word_table:
                    page_tables.append(word_table)

            all_page_tables.append({
                "page": page_idx + 1,
                "tables": page_tables,
                "width": page.rect.width,
                "height": page.rect.height,
            })

    if not export_tables:
        export_tables = [
            {**t, "page": None}
            for t in merge_page_tables(all_page_tables)
        ]

    pages_text = []
    if not export_tables and page_count <= 500:
        for page_idx in range(page_count):
            pages_text.append(doc[page_idx].get_text("text"))

    doc.close()

    merged = merge_page_tables(all_page_tables) if include_debug else []

    result = {
        "pageCount": page_count,
        "exportTables": export_tables,
        "unsupportedPages": unsupported_pages,
    }
    if master_table and is_meaningful_table(master_table):
        result["masterTable"] = master_table
    if include_debug:
        result["pages"] = all_page_tables
        result["mergedTables"] = merged
    if pages_text:
        result["pagesText"] = pages_text

    out_path = os.path.join(output_dir, "tables.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    print(json.dumps({
        "success": True,
        "pageCount": page_count,
        "exportTableCount": len(export_tables),
        "mergedTableCount": len(merged),
        "outputPath": out_path,
    }))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: pdf-extract-tables.py <input.pdf> <output_dir>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    try:
        extract_tables(pdf_path, output_dir)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
