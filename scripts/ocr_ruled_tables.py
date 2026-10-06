"""Conservative geometry for one fully ruled table from an existing OCR pass.

This module never recognizes or corrects text. A successful result only moves
the same TSV words into cells whose complete borders exist in the source image.
Unsupported or ambiguous layouts return None so the caller can keep raw text.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import math
import re


_MAX_COLUMNS = 8
_MAX_ROWS = 40
_MAX_PIXELS = 30_000_000
_MAX_WORDS = 10_000
_TSV_FIELDS = (
    "level", "page_num", "block_num", "par_num", "line_num", "word_num",
    "left", "top", "width", "height", "conf", "text",
)


@dataclass(frozen=True)
class _Word:
    text: str
    left: int
    top: int
    right: int
    bottom: int
    line: tuple[int, int, int, int]
    order: int


def _parse_words(tsv_text: str, transcript: str, width: int, height: int) -> list[_Word] | None:
    if not isinstance(tsv_text, str) or not isinstance(transcript, str):
        return None
    if not tsv_text or len(tsv_text) > 4_000_000 or len(transcript) > 1_000_000:
        return None
    records = tsv_text.splitlines()
    if not records or tuple(records[0].lstrip("\ufeff").split("\t")) != _TSV_FIELDS:
        return None
    words = []
    try:
        for record in records[1:]:
            if not record:
                continue
            fields = record.split("\t", 11)
            if len(fields) != 12:
                return None
            level = int(fields[0])
            if level not in range(1, 6):
                return None
            if level != 5:
                continue
            text = fields[11]
            # Tesseract can report the rules themselves as whitespace words.
            if not text.strip():
                continue
            if text != text.strip() or len(text.split()) != 1:
                return None
            page, block, paragraph, line, word = map(int, fields[1:6])
            left, top, word_width, word_height = map(int, fields[6:10])
            confidence = float(fields[10])
            if (not math.isfinite(confidence) or confidence < 60 or confidence > 100
                    or min(page, block, paragraph, line, word) < 1
                    or min(left, top) < 0 or min(word_width, word_height) <= 0
                    or left + word_width > width or top + word_height > height):
                return None
            words.append(_Word(text, left, top, left + word_width, top + word_height,
                               (page, block, paragraph, line), len(words)))
            if len(words) > _MAX_WORDS:
                return None
    except (ValueError, OverflowError):
        return None
    if not words or len({word.line[0] for word in words}) != 1:
        return None
    if Counter(transcript.split()) != Counter(word.text for word in words):
        return None
    return words


def _bands(mask, axis: int, np) -> list[tuple[int, int]]:
    """Cluster thick/antialiased rules into one band, allowing a two-pixel gap."""
    positions = np.flatnonzero(np.any(mask != 0, axis=axis)).tolist()
    bands: list[tuple[int, int]] = []
    for position in positions:
        if bands and position <= bands[-1][1] + 3:
            bands[-1] = (bands[-1][0], position)
        else:
            bands.append((position, position))
    return bands


def _continuous(coverage, np) -> bool:
    """Permit scan noise, but never a cell-sized missing border segment."""
    if coverage.size == 0 or float(np.mean(coverage)) < 0.985:
        return False
    missing = np.flatnonzero(~coverage).tolist()
    run = 0
    previous = -2
    for position in missing:
        run = run + 1 if position == previous + 1 else 1
        if run > 2:
            return False
        previous = position
    return True


def _grid(component, cv2, np) -> tuple[list[float], list[float]] | None:
    height, width = component.shape
    # Kernels scale to this connected candidate, not to the page's height.
    horizontal = cv2.morphologyEx(component, cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (max(9, width // (2 * _MAX_COLUMNS)) | 1, 1)),
        borderType=cv2.BORDER_CONSTANT, borderValue=0)
    vertical = cv2.morphologyEx(component, cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(9, height // (2 * _MAX_ROWS)) | 1)),
        borderType=cv2.BORDER_CONSTANT, borderValue=0)
    ys, xs = _bands(horizontal, 1, np), _bands(vertical, 0, np)
    if not (3 <= len(xs) <= _MAX_COLUMNS + 1 and 3 <= len(ys) <= _MAX_ROWS + 1):
        return None
    xcenters = [(start + end) / 2 for start, end in xs]
    ycenters = [(start + end) / 2 for start, end in ys]
    for bands, centers in ((xs, xcenters), (ys, ycenters)):
        smallest_gap = min(second - first for first, second in zip(centers, centers[1:]))
        if smallest_gap < 14 or any(end - start + 1 > smallest_gap / 4 for start, end in bands):
            return None
    xstart, xend = round(xcenters[0]), round(xcenters[-1])
    ystart, yend = round(ycenters[0]), round(ycenters[-1])
    if (xs[0][0] > 2 or ys[0][0] > 2
            or width - 1 - xs[-1][1] > 2 or height - 1 - ys[-1][1] > 2):
        return None
    for start, end in ys:
        coverage = np.any(horizontal[start:end + 1, xstart:xend + 1] != 0, axis=0)
        if not _continuous(coverage, np):
            return None
    for start, end in xs:
        coverage = np.any(vertical[ystart:yend + 1, start:end + 1] != 0, axis=1)
        if not _continuous(coverage, np):
            return None
    for yfirst, ylast in ys:
        for xfirst, xlast in xs:
            if not np.any(cv2.bitwise_and(
                    horizontal[yfirst:ylast + 1, xfirst:xlast + 1],
                    vertical[yfirst:ylast + 1, xfirst:xlast + 1])):
                return None
    # A short partial border in a narrow cell can disappear during opening.
    # It must not silently turn a merged layout into a coarser complete grid.
    explained = np.zeros(component.shape, dtype=bool)
    for first, last in ys:
        explained[max(0, first - 2):min(height, last + 3), :] = True
    for first, last in xs:
        explained[:, max(0, first - 2):min(width, last + 3)] = True
    if np.any((component != 0) & ~explained):
        return None
    return xcenters, ycenters


def _cell_text(words: list[_Word]) -> str | None:
    """Use baseline geometry for wrapped text even when TSV blocks are reordered."""
    lines: list[list[_Word]] = []
    for word in sorted(words, key=lambda item: (item.top, item.left, item.order)):
        matching = []
        for line in lines:
            # Common vertical overlap, rather than a coincidentally close top.
            top = max(item.top for item in line)
            bottom = min(item.bottom for item in line)
            overlap = min(bottom, word.bottom) - max(top, word.top)
            if overlap >= min(bottom - top, word.bottom - word.top) / 2:
                matching.append(line)
        if len(matching) > 1:
            return None
        if matching:
            matching[0].append(word)
        else:
            lines.append([word])
    ordered = []
    for line in lines:
        line.sort(key=lambda item: (item.left, item.order))
        if any(first.right > second.left + 2 for first, second in zip(line, line[1:])):
            return None
        ordered.extend(word.text for word in line)
    return " ".join(ordered)


def _outside_transcript_lines(transcript: str, before: list[_Word], after: list[_Word]) -> tuple[list[str], list[str]] | None:
    """Retain raw spacing/blank lines only when geometry agrees with TXT order."""
    transcript = transcript.replace("\r\n", "\n").replace("\r", "\n")
    tokens = list(re.finditer(r"\S+", transcript))
    if len(before) + len(after) >= len(tokens):
        return None
    if [token.group() for token in tokens[:len(before)]] != [word.text for word in before]:
        return None
    if after and [token.group() for token in tokens[-len(after):]] != [word.text for word in after]:
        return None
    first_table_token = tokens[len(before)]
    last_table_token = tokens[len(tokens) - len(after) - 1]
    first_line_start = transcript.rfind("\n", 0, first_table_token.start()) + 1
    last_line_end = transcript.find("\n", last_table_token.end())
    if last_line_end == -1:
        last_line_end = len(transcript)
    # Outside prose and table text sharing one TXT line is an uncertain split.
    if (transcript[first_line_start:first_table_token.start()].strip()
            or transcript[last_table_token.end():last_line_end].strip()):
        return None
    prefix = transcript[:first_line_start]
    suffix = transcript[last_line_end + 1:]
    if prefix.split() != [word.text for word in before] or suffix.split() != [word.text for word in after]:
        return None
    return prefix.splitlines(), suffix.splitlines()


def _pixmap_pixels(pixmap, np):
    try:
        width, height, channels = pixmap.width, pixmap.height, pixmap.n
        if (not isinstance(width, int) or not isinstance(height, int)
                or min(width, height) < 32 or width * height > _MAX_PIXELS
                or channels not in (1, 3, 4)):
            return None
        pixels = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(height, width, channels)
    except (AttributeError, TypeError, ValueError, BufferError):
        return None
    return pixels


def _detect_grid(pixels, cv2, np):
    gray = pixels[:, :, 0] if pixels.shape[2] == 1 else cv2.cvtColor(pixels[:, :, :3], cv2.COLOR_RGB2GRAY)
    binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    # Short seed rules locate connected candidates. Full-grid validation below
    # uses candidate-relative kernels and catches partial/merged inner borders.
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (13, 1)))
    vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, 13)))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(cv2.bitwise_or(horizontal, vertical), 8)
    candidates = []
    for label in range(1, count):
        left, top, candidate_width, candidate_height, area = map(int, stats[label])
        if candidate_width < 40 or candidate_height < 30 or area < 2 * (candidate_width + candidate_height):
            continue
        component = np.where(labels[top:top + candidate_height, left:left + candidate_width] == label,
                             255, 0).astype(np.uint8)
        # Any substantial connected rule structure is ambiguous until validated.
        # Two grids, or a grid plus a second partial grid, must not become one.
        local_horizontal = horizontal[top:top + candidate_height, left:left + candidate_width] & component
        local_vertical = vertical[top:top + candidate_height, left:left + candidate_width] & component
        if len(_bands(local_horizontal, 1, np)) < 2 or len(_bands(local_vertical, 0, np)) < 2:
            continue
        candidates.append((left, top, component, label))
        if len(candidates) > 1:
            return None
    if len(candidates) != 1:
        return None
    left, top, component, label = candidates[0]
    grid = _grid(component, cv2, np)
    if grid is None:
        return None
    xs = [left + position for position in grid[0]]
    ys = [top + position for position in grid[1]]
    rule_mask = labels == label
    return xs, ys, rule_mask, rule_mask & (vertical != 0), rule_mask & (horizontal != 0), binary


def prepare_ruled_table_ocr_image(pixmap) -> bytes | None:
    """Remove isolated vertical rules of one verified grid before the OCR pass.

    Horizontal rules remain to help the recognizer retain row reading order.
    Only the confirmed vertical-rule mask and a one-pixel antialias fringe are
    whitened. Adjacent non-rule ink rejects preparation; the source is unchanged.
    The caller must keep the original pixmap for later cell reconstruction.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        return None
    pixels = _pixmap_pixels(pixmap, np)
    if pixels is None:
        return None
    detected = _detect_grid(pixels, cv2, np)
    if detected is None:
        return None
    _, _, rule_mask, vertical_mask, horizontal_mask, binary = detected
    fringe = np.ones((3, 3), dtype=np.uint8)
    erase = cv2.dilate(vertical_mask.astype(np.uint8), fringe) != 0
    all_rules_with_fringe = cv2.dilate(rule_mask.astype(np.uint8), fringe) != 0
    nearby = cv2.dilate(erase.astype(np.uint8), np.ones((7, 7), dtype=np.uint8)) != 0
    # Inspect even faint source ink; thresholded detection can omit punctuation
    # or a gray glyph that is still inside the one-pixel removal fringe.
    ink = np.any(pixels[:, :, :min(3, pixels.shape[2])] < 255, axis=2)
    if np.any(nearby & (binary != 0) & ~all_rules_with_fringe):
        return None
    ink_mask = ink.astype(np.uint8)
    vertical_ink = cv2.morphologyEx(ink_mask, cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, 13))) != 0
    horizontal_ink = cv2.morphologyEx(ink_mask, cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (13, 1))) != 0
    horizontal_fringe = cv2.dilate(horizontal_mask.astype(np.uint8), fringe) != 0
    # Short marks disappear during morphology. They are not rule pixels merely
    # because they happen to lie inside the expanded rule mask.
    explained_ink = vertical_ink | (horizontal_ink & horizontal_fringe)
    if np.any(erase & ink & ~explained_ink):
        return None
    # A touching glyph can join the rule component before morphological opening.
    # Reject local widening instead of treating such text as part of the rule.
    for x in detected[0]:
        first, last = max(0, round(x) - 6), min(pixels.shape[1], round(x) + 7)
        widths = np.count_nonzero(vertical_ink[:, first:last], axis=1)
        on_rule = np.any(vertical_mask[:, first:last], axis=1)
        at_horizontal_rule = np.any(horizontal_fringe[:, first:last], axis=1)
        occupied = widths[on_rule & ~at_horizontal_rule]
        if occupied.size == 0 or int(occupied.max()) > int(np.median(occupied)):
            return None
    cleaned = pixels.copy()
    cleaned[erase, :min(3, pixels.shape[2])] = 255
    if pixels.shape[2] == 3:
        cleaned = cv2.cvtColor(cleaned, cv2.COLOR_RGB2BGR)
    elif pixels.shape[2] == 4:
        cleaned = cv2.cvtColor(cleaned, cv2.COLOR_RGBA2BGRA)
    encoded, png = cv2.imencode(".png", cleaned)
    if not encoded:
        raise RuntimeError("Could not encode prepared table OCR image")
    return png.tobytes()


def build_ruled_table_layout(pixmap, tsv_text: str, transcript: str) -> dict | None:
    """Return one closed 2..8-column, 2..40-row grid, or preserve-text fallback.

    The pixmap and both OCR outputs must describe the same source page at the
    same resolution. Column widths are positive fractions summing to one.
    Dependency absence and malformed inputs are expected fallbacks; programming
    errors and unexpected OpenCV failures are deliberately not swallowed.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        return None
    pixels = _pixmap_pixels(pixmap, np)
    if pixels is None:
        return None
    words = _parse_words(tsv_text, transcript, pixels.shape[1], pixels.shape[0])
    if words is None:
        return None
    detected = _detect_grid(pixels, cv2, np)
    if detected is None:
        return None
    xs, ys = detected[:2]
    cells: list[list[list[_Word]]] = [[[] for _ in range(len(xs) - 1)] for _ in range(len(ys) - 1)]
    before, after = [], []
    for word in words:
        if word.bottom <= ys[0] - 2:
            before.append(word)
            continue
        if word.top >= ys[-1] + 2:
            after.append(word)
            continue
        # Words beside the table, on borders, or straddling cells are ambiguous.
        columns = [index for index in range(len(xs) - 1)
                   if word.left >= xs[index] - 2 and word.right <= xs[index + 1] + 2]
        rows = [index for index in range(len(ys) - 1)
                if word.top >= ys[index] - 2 and word.bottom <= ys[index + 1] + 2]
        if len(columns) != 1 or len(rows) != 1:
            return None
        cells[rows[0]][columns[0]].append(word)
    if not any(cell for row in cells for cell in row):
        return None
    rows = [[_cell_text(cell) for cell in row] for row in cells]
    outside = _outside_transcript_lines(transcript, before, after)
    if outside is None or any(cell is None for row in rows for cell in row):
        return None
    before_lines, after_lines = outside
    result = {
        "before": before_lines,
        "rows": rows,
        "after": after_lines,
        "columnWidths": [(second - first) / (xs[-1] - xs[0]) for first, second in zip(xs, xs[1:])],
    }
    # Defensive final conservation check covers every output slot and repeat.
    emitted = before_lines + [cell for row in rows for cell in row] + after_lines
    if Counter(" ".join(emitted).split()) != Counter(transcript.split()):
        return None
    return result
