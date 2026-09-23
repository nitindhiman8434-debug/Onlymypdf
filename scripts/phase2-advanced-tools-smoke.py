"""Verify the six advanced PDF operations inside the production Linux image."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "scripts" / "pdf-advanced-tools.py"


def run(operation: str, source: Path, output: Path, options: dict | None = None, second: Path | None = None) -> dict:
    command = [sys.executable, str(TOOL), operation, str(source), str(output), json.dumps(options or {})]
    if second:
        command.extend(["--second", str(second)])
    result = subprocess.run(command, capture_output=True, text=True, timeout=180, check=False)
    if result.returncode:
        raise AssertionError(f"{operation} failed: {(result.stderr or result.stdout)[-1200:]}")
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    payload = json.loads(lines[-1])
    assert output.read_bytes().startswith(b"%PDF-"), operation
    assert output.stat().st_size > 100, operation
    return payload


def make_text_pdf(path: Path, changed: bool = False) -> None:
    document = fitz.open()
    for index in range(2):
        page = document.new_page()
        page.insert_text((72, 90), f"ONLYMYPDF ADVANCED TOOL PAGE {index + 1}", fontsize=16)
        page.insert_text((72, 130), "SECRET-2026 must be removed", fontsize=12)
        if changed and index == 1:
            page.insert_text((72, 180), "VISIBLE COMPARISON CHANGE", fontsize=14)
    document.save(path)
    document.close()


def make_scan_pdf(path: Path) -> None:
    image = Image.new("RGB", (1400, 500), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 54)
    draw.text((70, 180), "ONLYMYPDF OCR VERIFIED 2026", fill="black", font=font)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as file:
        image.save(file.name)
        image_path = Path(file.name)
    try:
        document = fitz.open()
        page = document.new_page(width=700, height=250)
        page.insert_image(page.rect, filename=str(image_path))
        document.save(path)
        document.close()
    finally:
        image_path.unlink(missing_ok=True)


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="phase2-advanced-tools-") as temp:
        folder = Path(temp)
        source = folder / "source.pdf"
        changed = folder / "changed.pdf"
        scan = folder / "scan.pdf"
        make_text_pdf(source)
        make_text_pdf(changed, changed=True)
        make_scan_pdf(scan)

        repaired = folder / "repaired.pdf"
        repair_meta = run("repair", source, repaired)
        assert fitz.open(repaired).page_count == 2

        cropped = folder / "cropped.pdf"
        run("crop", source, cropped, {"top": 5, "right": 5, "bottom": 5, "left": 5})
        with fitz.open(cropped) as document:
            assert document[0].cropbox.width < document[0].mediabox.width

        redacted = folder / "redacted.pdf"
        redact_meta = run("redact", source, redacted, {"terms": ["SECRET-2026"]})
        with fitz.open(redacted) as document:
            assert "SECRET-2026" not in " ".join(page.get_text() for page in document)
        assert redact_meta["matchesRemoved"] == 2

        ocr = folder / "ocr.pdf"
        run("ocr", scan, ocr, {"languages": "eng"})
        with fitz.open(ocr) as document:
            assert "ONLYMYPDF" in " ".join(page.get_text() for page in document).upper()

        compared = folder / "comparison.pdf"
        compare_meta = run("compare", source, compared, second=changed)
        assert compare_meta["changedPages"] >= 1

        pdfa = folder / "archive.pdf"
        pdfa_meta = run("pdfa", source, pdfa, {"level": "2b"})
        pdfa_bytes = pdfa.read_bytes()
        assert b"/OutputIntent" in pdfa_bytes or b"/OutputIntents" in pdfa_bytes
        assert pdfa_meta["level"] == "2B"

        print(json.dumps({
            "status": "passed",
            "repair": repair_meta,
            "redact": redact_meta,
            "compare": compare_meta,
            "pdfa": pdfa_meta,
        }, sort_keys=True))


if __name__ == "__main__":
    main()
