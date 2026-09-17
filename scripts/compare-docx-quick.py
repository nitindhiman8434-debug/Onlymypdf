#!/usr/bin/env python3
import re
import sys
import zipfile
from pathlib import Path


def analyze(label: str, path: Path) -> None:
    print(f"\n=== {label} ===")
    if not path.exists():
        print("MISSING", path)
        return
    print("size_bytes", path.stat().st_size)
    with zipfile.ZipFile(path) as z:
        imgs = [n for n in z.namelist() if n.startswith("word/media/")]
        print("media_count", len(imgs))
        doc = z.read("word/document.xml").decode("utf-8", "replace")
        for tag in ["wp:anchor", "wp:inline", "w:drawing", "w:txbxContent"]:
            print(f"{tag}: {doc.count(tag)}")
        m = re.search(r'w:pgSz w:w="(\d+)" w:h="(\d+)"', doc)
        if m:
            w, h = int(m.group(1)), int(m.group(2))
            print(f"pgSz: {w / 20:.1f} x {h / 20:.1f} pt")
        texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", doc)
        print("char_count", sum(len(t) for t in texts))
        print("sample_text:", " ".join(texts[:8])[:200])


if __name__ == "__main__":
    paths = sys.argv[1:]
    if not paths:
        paths = [
            r"C:\Users\NiTiN Dhiman\AppData\Local\Temp\test-word-com.docx",
            r"c:\Users\NiTiN Dhiman\Downloads\SmallPdf.docx",
            r"c:\Users\NiTiN Dhiman\Downloads\Onlymypdf.docx",
        ]
    for p in paths:
        analyze(Path(p).name, Path(p))
