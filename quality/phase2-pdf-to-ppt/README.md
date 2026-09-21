# Phase 2.3D PDF-to-PowerPoint semantic gate

Run `npm run phase2.3d:ppt-corpus` from the repository root. The runner creates seven synthetic, source-visible PDF cases under `tmp/pdfs/phase2.3d`, converts each through the actual `pdfToPpt` service, reopens the PPTX with python-pptx, renders it with LibreOffice Impress and checks slide count, editable on-slide text, retained source tokens, image aspect ratio, and visual mean absolute difference. The latest machine-readable result is `latest-corpus-report.json`.

Dependencies: Python 3.12 with PyMuPDF, python-pptx and Pillow; Node project dependencies; LibreOffice Impress. The Ubuntu workflow installs these. On Windows the runner uses `C:\Program Files\LibreOffice\program\soffice.exe` unless `LIBREOFFICE_PATH` is set.

The gate covers selectable horizontal text on ordinary PDF pages. It intentionally expects no editable text for an image-only page or an invisible OCR layer over a full-page image. It does not assert universal font, chart, scan, or file-size accuracy.
