# OnlyMyPDF Python worker — heavy PDF/OCR/conversion processing.
FROM python:3.12-slim

# System tooling used by the providers (Phase 4/5).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice poppler-utils ghostscript qpdf tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "worker.py"]
