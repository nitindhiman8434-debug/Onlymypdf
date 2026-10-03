#!/usr/bin/env python3
"""Confirm unreadable scans cannot return a successful partial Word artifact."""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import fitz
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("english_word_corpus", ROOT / "scripts/phase3-english-word-corpus.py")
assert spec and spec.loader
corpus = importlib.util.module_from_spec(spec)
spec.loader.exec_module(corpus)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:3001")
    args = parser.parse_args()
    transport = corpus.transport_module.LocalTransport(args.base_url, 180)
    directory = ROOT / "tmp/pdfs/phase3.2d-english-word"
    readable = directory / "english-memo-scan.pdf"
    if not readable.is_file():
        parser.error("Run phase3.2d:english-word first to create the English memo scan.")

    # Deliberately contains shapes only: no hidden text or expected words.
    image = Image.new("RGB", (1275, 1650), "white")
    draw = ImageDraw.Draw(image)
    draw.ellipse((120, 190, 1110, 1180), fill="#d8dce1")
    draw.rectangle((250, 1280, 1020, 1330), fill="#b9c1ca")
    png = directory / "unreadable-source.png"
    image.save(png)
    unreadable = directory / "unreadable-raster.pdf"
    with fitz.open() as output:
        page = output.new_page(width=612, height=792)
        page.insert_image(page.rect, filename=str(png))
        output.save(unreadable, deflate=True)
    mixed = directory / "english-readable-plus-unreadable.pdf"
    with fitz.open() as output:
        for path in (readable, unreadable):
            with fitz.open(path) as source:
                output.insert_pdf(source)
        output.save(mixed, deflate=True)

    results = []
    for name, path in (("unreadable-raster", unreadable), ("english-readable-plus-unreadable", mixed)):
        with fitz.open(path) as source:
            assert all(not page.get_text().strip() for page in source), "Inputs must be image-only"
        data, mime = corpus.multipart(path)
        status, body, headers = transport.request("/api/tools/pdf-to-word", data, mime)
        content_type = headers.get("content-type", "").split(";", 1)[0]
        error = json.loads(body) if content_type == "application/json" else {}
        expected = "PDF OCR could not extract enough readable text. Try a clearer scan or supported OCR language."
        artifact = body.startswith((b"PK", b"%PDF-"))
        passed = status == 422 and error.get("error") == expected and not artifact
        results.append({"case": name, "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                        "httpStatus": status, "contentType": content_type, "error": error.get("error"),
                        "passed": passed, "artifactReturned": artifact})
    report = {"scope": "local English Word OCR rejection", "results": results,
              "passed": sum(row["passed"] for row in results), "allPassed": all(row["passed"] for row in results)}
    report_path = ROOT / "quality/phase3-english-word/rejection-report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["allPassed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
