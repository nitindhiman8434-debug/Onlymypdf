#!/usr/bin/env python3
import re
import zipfile
from pathlib import Path

paths = {
    "OnlyMyPDF": Path(r"c:\Users\NiTiN Dhiman\Downloads\Onlymypdf.docx"),
    "SmallPDF": Path(r"c:\Users\NiTiN Dhiman\Downloads\SmallPdf.docx"),
}


def analyze(label: str, path: Path) -> None:
    print(f"\n=== {label} ===")
    if not path.exists():
        print("MISSING", path)
        return
    print("size_bytes", path.stat().st_size)
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        print("zip_entries", len(names))
        imgs = [n for n in names if n.startswith("word/media/")]
        print("media_count", len(imgs))
        for img in imgs[:8]:
            info = z.getinfo(img)
            print(" ", img, info.file_size)

        doc = z.read("word/document.xml").decode("utf-8", "replace")
        tags = [
            "wp:anchor",
            "wp:inline",
            "w:txbxContent",
            "v:shape",
            "w:drawing",
            "mc:AlternateContent",
            "w:pict",
            "w:br",
        ]
        for tag in tags:
            print(f"{tag}: {doc.count(tag)}")

        m = re.search(r'w:pgSz w:w="(\d+)" w:h="(\d+)"', doc)
        if m:
            w, h = int(m.group(1)), int(m.group(2))
            print(f"pgSz_twips: {w} x {h}  (~{w/20:.1f} x {h/20:.1f} pt)")

        m = re.search(r'<w:pgMar[^>]*/>', doc)
        if m:
            print("pgMar:", m.group(0)[:200])

        # first few text snippets
        texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", doc)
        joined = " ".join(texts[:20])
        print("sample_text:", joined[:240])


if __name__ == "__main__":
    for label, path in paths.items():
        analyze(label, path)
