"""Generated geometry tests: no source document or OCR executable required."""

from __future__ import annotations

import builtins
from collections import Counter
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import cv2
import numpy as np

from ocr_ruled_tables import build_ruled_table_layout, prepare_ruled_table_ocr_image


HEADER = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext"


class RuledTableLayoutTests(unittest.TestCase):
    def setUp(self) -> None:
        self.image = np.full((900, 720, 3), 255, dtype=np.uint8)
        self.xs = [80, 240, 560]
        self.ys = [200, 270, 340, 430]
        self.draw_grid(self.xs, self.ys)
        # Column-major OCR order deliberately differs from the resulting table.
        self.words = [
            self.word("Statement", 80, 60, 95, line=1),
            self.word("Label", 92, 216, 55, line=2),
            self.word("Support", 92, 282, 70, line=3),
            self.word("plan", 92, 305, 42, line=4),
            self.word("0007", 92, 355, 48, line=5),
            self.word("Amount", 258, 216, 68, line=6),
            self.word("99.90", 258, 282, 54, line=7),
            self.word("99.90", 258, 355, 54, line=8),
            self.word("Due", 80, 480, 30, line=9),
            self.word("2026-11-02", 125, 480, 110, line=9, number=2),
        ]

    @staticmethod
    def word(text: str, x: int, y: int, width: int, *, height: int = 16,
             line: int = 1, number: int = 1, confidence: float = 96) -> list:
        return [5, 1, 1, 1, line, number, x, y, width, height, confidence, text]

    def draw_grid(self, xs: list[int], ys: list[int], thickness: int = 2) -> None:
        for x in xs:
            cv2.line(self.image, (x, ys[0]), (x, ys[-1]), (0, 0, 0), thickness)
        for y in ys:
            cv2.line(self.image, (xs[0], y), (xs[-1], y), (0, 0, 0), thickness)

    def recognize(self, *, words: list | None = None, transcript: str | None = None,
                  tsv: str | None = None, image=None):
        records = self.words if words is None else words
        pixels = self.image if image is None else image
        if tsv is None:
            tsv = HEADER + "\n" + "\n".join("\t".join(map(str, row)) for row in records)
        if transcript is None:
            lines = {}
            for row in records:
                lines.setdefault(tuple(row[1:5]), []).append(row[-1])
            transcript = "\n".join(" ".join(line) for line in lines.values())
        pixmap = SimpleNamespace(width=pixels.shape[1], height=pixels.shape[0],
                                 n=pixels.shape[2], samples=pixels.tobytes())
        return build_ruled_table_layout(pixmap, tsv, transcript)

    def test_reorders_real_words_into_cells_without_losing_repeats_or_wrapping(self) -> None:
        layout = self.recognize()
        self.assertIsNotNone(layout)
        self.assertEqual(layout["before"], ["Statement"])
        self.assertEqual(layout["rows"], [["Label", "Amount"], ["Support plan", "99.90"], ["0007", "99.90"]])
        self.assertEqual(layout["after"], ["Due 2026-11-02"])
        self.assertAlmostEqual(layout["columnWidths"][0], 1 / 3, places=3)
        self.assertAlmostEqual(layout["columnWidths"][1], 2 / 3, places=3)
        emitted = layout["before"] + [cell for row in layout["rows"] for cell in row] + layout["after"]
        self.assertEqual(Counter(" ".join(emitted).split()), Counter(row[-1] for row in self.words))

    def test_thick_rules_and_a_short_table_on_a_tall_page_are_supported(self) -> None:
        for thickness in (1, 3, 5):
            with self.subTest(thickness=thickness):
                self.image = np.full((2400, 720, 3), 255, dtype=np.uint8)
                self.draw_grid(self.xs, self.ys, thickness)
                self.assertIsNotNone(self.recognize())

    def test_whitespace_only_rule_components_are_ignored(self) -> None:
        records = self.words + [self.word(" ", 80, 200, 480, height=2, confidence=0)]
        layout = self.recognize(words=records)
        self.assertIsNotNone(layout)
        self.assertEqual(layout["rows"][1], ["Support plan", "99.90"])

    def test_empty_cells_are_kept_without_placeholder_words(self) -> None:
        layout = self.recognize(words=[row for row in self.words if row[-1] != "0007"])
        self.assertIsNotNone(layout)
        self.assertEqual(layout["rows"][2], ["", "99.90"])

    def test_raw_outside_spacing_blank_lines_and_line_endings_are_preserved(self) -> None:
        middle = "\n".join(row[-1] for row in self.words[1:8])
        transcript = "  Statement   \r\n\r\n" + middle.replace("\n", "\r\n") + "\r\n\r\nDue   2026-11-02  \r\n\r\n"
        layout = self.recognize(transcript=transcript)
        self.assertIsNotNone(layout)
        self.assertEqual(layout["before"], ["  Statement   ", ""])
        self.assertEqual(layout["after"], ["", "Due   2026-11-02  ", ""])

    def test_outside_tokens_in_a_different_transcript_position_fall_back(self) -> None:
        transcript = "\n".join(row[-1] for row in self.words[1:] + self.words[:1])
        self.assertIsNone(self.recognize(transcript=transcript))

    def test_outside_text_sharing_a_transcript_line_with_table_text_falls_back(self) -> None:
        middle = "\n".join(row[-1] for row in self.words[1:8])
        for transcript in ("Statement " + middle + "\nDue 2026-11-02",
                           "Statement\n" + middle + " Due 2026-11-02"):
            with self.subTest(transcript=transcript):
                self.assertIsNone(self.recognize(transcript=transcript))

    def test_missing_vertical_segment_is_a_merged_cell_and_falls_back(self) -> None:
        self.image[274:337, 238:243] = 255
        self.assertIsNone(self.recognize())

    def test_missing_horizontal_segment_is_a_merged_cell_and_falls_back(self) -> None:
        self.image[338:343, 244:557] = 255
        self.assertIsNone(self.recognize())

    def test_an_internal_rule_present_in_only_one_row_is_not_silently_ignored(self) -> None:
        self.image[274:428, 238:243] = 255
        self.assertIsNone(self.recognize())

    def test_short_partial_border_in_a_narrow_column_is_not_ignored(self) -> None:
        self.image[:] = 255
        self.draw_grid([80, 100, 560], [200, 270, 340, 430])
        # Only the narrow first cell has a separator at this additional row.
        cv2.line(self.image, (80, 380), (100, 380), (0, 0, 0), 2)
        records = [self.word("Value", 130, 215, 50)]
        self.assertIsNone(self.recognize(words=records))

    def test_open_outer_borders_fall_back(self) -> None:
        for side in ("left", "top", "bottom"):
            with self.subTest(side=side):
                image = self.image.copy()
                if side == "left":
                    image[204:427, 78:83] = 255
                elif side == "top":
                    image[198:203, 84:557] = 255
                else:
                    image[428:433, 84:557] = 255
                self.assertIsNone(self.recognize(image=image))

    def test_two_closed_grids_are_not_combined_or_partially_emitted(self) -> None:
        self.draw_grid([80, 240, 560], [600, 665, 730])
        self.assertIsNone(self.recognize())

    def test_unruled_text_is_not_made_into_a_table(self) -> None:
        self.image[:] = 255
        cv2.putText(self.image, "Statement paragraph", (80, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 1)
        self.assertIsNone(self.recognize())

    def test_word_crossing_either_cell_border_falls_back(self) -> None:
        for x, y, width, height in ((220, 216, 55, 16), (92, 259, 55, 25)):
            with self.subTest(box=(x, y, width, height)):
                records = [*self.words]
                records[1] = self.word("Label", x, y, width, height=height, line=2)
                self.assertIsNone(self.recognize(words=records))

    def test_text_beside_table_falls_back(self) -> None:
        records = self.words + [self.word("Side", 605, 280, 44, line=10)]
        self.assertIsNone(self.recognize(words=records))

    def test_low_confidence_or_invalid_confidence_falls_back(self) -> None:
        for confidence in (59.9, -1, float("nan"), float("inf"), 101):
            with self.subTest(confidence=confidence):
                records = [row.copy() for row in self.words]
                records[6][10] = confidence
                self.assertIsNone(self.recognize(words=records))

    def test_token_multiset_mismatch_including_a_missing_repeat_falls_back(self) -> None:
        transcript = " ".join(row[-1] for row in self.words)
        for changed in (transcript.replace("99.90", "99.9", 1),
                        transcript.replace("99.90", "", 1), transcript + " invented"):
            with self.subTest(transcript=changed):
                self.assertIsNone(self.recognize(transcript=changed))

    def test_malformed_tsv_does_not_damage_the_text_fallback(self) -> None:
        for tsv in ("", "wrong\theader", HEADER + "\n5\t1\tbad",
                    HEADER + "\n" + "\t".join(map(str, self.words[0])).replace("\t80\t", "\tbad\t", 1)):
            with self.subTest(tsv=tsv):
                self.assertIsNone(self.recognize(tsv=tsv))

    def test_overlapping_word_boxes_are_ambiguous(self) -> None:
        records = self.words + [self.word("duplicate", 100, 216, 80, line=2, number=2)]
        self.assertIsNone(self.recognize(words=records))

    def test_grid_column_and_row_limits_are_enforced(self) -> None:
        for columns, rows in ((9, 3), (2, 41)):
            with self.subTest(columns=columns, rows=rows):
                self.image = np.full((1800, 900, 3), 255, dtype=np.uint8)
                xs = [50 + column * 70 for column in range(columns + 1)]
                ys = [100 + row * 35 for row in range(rows + 1)]
                self.draw_grid(xs, ys)
                records = [self.word("Cell", 60, 110, 40)]
                self.assertIsNone(self.recognize(words=records))

    def test_missing_optional_dependency_returns_none(self) -> None:
        real_import = builtins.__import__

        def missing_cv2(name, *args, **kwargs):
            if name == "cv2":
                raise ImportError("cv2 unavailable")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=missing_cv2):
            self.assertIsNone(self.recognize())

    def test_unexpected_cv_runtime_errors_are_not_hidden_as_layout_fallback(self) -> None:
        with patch("cv2.threshold", side_effect=RuntimeError("unexpected failure")):
            with self.assertRaisesRegex(RuntimeError, "unexpected failure"):
                self.recognize()

    def prepare(self):
        pixmap = SimpleNamespace(width=self.image.shape[1], height=self.image.shape[0],
                                 n=self.image.shape[2], samples=self.image.tobytes())
        return prepare_ruled_table_ocr_image(pixmap)

    def test_preparation_erases_only_vertical_rules_and_preserves_text_pixels(self) -> None:
        cv2.putText(self.image, "AB12", (95, 243), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
        original = self.image.copy()
        prepared = self.prepare()
        self.assertIsNotNone(prepared)
        self.assertTrue(prepared.startswith(b"\x89PNG\r\n\x1a\n"))
        cleaned = cv2.imdecode(np.frombuffer(prepared, dtype=np.uint8), cv2.IMREAD_COLOR)
        self.assertEqual(cleaned.shape, self.image.shape)
        np.testing.assert_array_equal(self.image, original)
        np.testing.assert_array_equal(cleaned[215:251, 90:190], original[215:251, 90:190])
        np.testing.assert_array_equal(cleaned[270, 100:220], original[270, 100:220])
        self.assertTrue(np.all(cleaned[210:260, 238:243] == 255))
        changed = np.any(cleaned != original, axis=2)
        permitted = np.zeros(changed.shape, dtype=bool)
        for x in self.xs:
            permitted[198:433, x - 2:x + 3] = True
        self.assertFalse(np.any(changed & ~permitted))

    def test_preparation_rejects_text_touching_or_immediately_beside_rules(self) -> None:
        for x in (240, 244):
            with self.subTest(x=x):
                self.setUp()
                cv2.putText(self.image, "text", (x, 243), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
                self.assertIsNone(self.prepare())

    def test_preparation_never_erases_a_thin_black_or_gray_stroke_in_the_fringe(self) -> None:
        for length in (1, 2, 5, 10, 12, 13, 20):
            for shade in (0, 80, 160, 220, 254):
                with self.subTest(length=length, shade=shade):
                    self.setUp()
                    self.image[295:295 + length, 242] = shade
                    original = self.image.copy()
                    self.assertIsNone(self.prepare())
                    np.testing.assert_array_equal(self.image, original)

    def test_preparation_accepts_a_continuous_gray_antialias_fringe(self) -> None:
        for x in self.xs:
            edge = self.image[200:431, x + 2]
            edge[np.all(edge == 255, axis=1)] = 220
        prepared = self.prepare()
        self.assertIsNotNone(prepared)
        cleaned = cv2.imdecode(np.frombuffer(prepared, dtype=np.uint8), cv2.IMREAD_COLOR)
        self.assertTrue(np.all(cleaned[295:315, 242] == 255))

    def test_preparation_rejects_a_short_mark_on_a_grayscale_pixmap(self) -> None:
        self.image[295:300, 242] = 220
        gray = self.image[:, :, :1].copy()
        pixmap = SimpleNamespace(width=gray.shape[1], height=gray.shape[0],
                                 n=1, samples=gray.tobytes())
        self.assertIsNone(prepare_ruled_table_ocr_image(pixmap))

    def test_preparation_rejects_merged_multiple_and_unruled_layouts(self) -> None:
        self.image[274:337, 238:243] = 255
        self.assertIsNone(self.prepare())
        self.setUp()
        self.draw_grid([80, 240, 560], [600, 665, 730])
        self.assertIsNone(self.prepare())
        self.image[:] = 255
        cv2.putText(self.image, "Plain paragraph", (80, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 1)
        self.assertIsNone(self.prepare())


if __name__ == "__main__":
    unittest.main()
