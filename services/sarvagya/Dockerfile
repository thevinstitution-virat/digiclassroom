# ============================================================================
# DigiClassroom Pro — Sarvagya (SurfSense) Microservice Dockerfile
# Based on the upstream surfsense_backend Dockerfile with:
#   - SERVICE_ROLE=api  (Celery disabled — BullMQ replaces it)
#   - DB_SCHEMA=sarvagya  (C1 fix: tables live in "sarvagya" schema)
# ============================================================================

FROM python:3.12-slim

WORKDIR /app

# System dependencies (SSL, CUDA, Tesseract OCR, Docling prereqs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    ca-certificates \
    curl \
    wget \
    unzip \
    gnupg2 \
    espeak-ng \
    libsndfile1 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    dos2unix \
    git \
    && rm -rf /var/lib/apt/lists/*

# SSL certs
RUN update-ca-certificates
RUN pip install --upgrade certifi pip-system-certs

# Copy dependency manifests first for layer caching
COPY pyproject.toml .
COPY uv.lock .

# PyTorch — CPU build. This container has NO GPU passthrough (no deploy.resources
# GPU reservation in docker-compose.yml), so the cu121 build ran CPU-only anyway
# while wasting ~780MB — and its download from the PyTorch R2 mirror kept failing
# the wheel hash check mid-transfer. CPU wheels (~190MB) are smaller, download
# reliably, and behave identically here.
RUN pip install --no-cache-dir --timeout 180 --retries 10 torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Python deps via uv
RUN pip install --no-cache-dir uv && \
    uv pip install --system --no-cache-dir -e .

# SSL env
ENV SSL_CERT_FILE=/usr/local/lib/python3.12/site-packages/certifi/cacert.pem
ENV REQUESTS_CA_BUNDLE=/usr/local/lib/python3.12/site-packages/certifi/cacert.pem

# Pre-download EasyOCR models
RUN mkdir -p /root/.EasyOCR/model && \
    wget --no-check-certificate https://github.com/JaidedAI/EasyOCR/releases/download/v1.3/english_g2.zip -O /root/.EasyOCR/model/english_g2.zip || true && \
    wget --no-check-certificate https://github.com/JaidedAI/EasyOCR/releases/download/pre-v1.1.6/craft_mlt_25k.zip -O /root/.EasyOCR/model/craft_mlt_25k.zip || true && \
    cd /root/.EasyOCR/model && (unzip -o english_g2.zip || true) && (unzip -o craft_mlt_25k.zip || true)

# Pre-download Docling models
RUN python -c "try:\n    from docling.document_converter import DocumentConverter\n    conv = DocumentConverter()\nexcept:\n    pass" || true

# Playwright for web scraping
RUN pip install playwright && \
    playwright install chromium --with-deps

# Copy source
COPY . .

# Entrypoint
COPY scripts/docker/entrypoint.sh /app/scripts/docker/entrypoint.sh
RUN dos2unix /app/scripts/docker/entrypoint.sh && chmod +x /app/scripts/docker/entrypoint.sh

# Shared temp
RUN mkdir -p /shared_tmp
ENV TMPDIR=/shared_tmp

# Python path
ENV PYTHONPATH=/app
ENV UVICORN_LOOP=asyncio

# ---------- Sarvagya-specific overrides ----------
# API-only mode: no Celery workers or beat scheduler
ENV SERVICE_ROLE=api

# Schema namespace isolation (C1 fix)
# The entrypoint / SQLAlchemy connect_args will read this
ENV DB_SCHEMA=sarvagya

# Disable Celery entirely
ENV CELERY_BROKER_URL=""
ENV CELERY_RESULT_BACKEND=""

EXPOSE 8000
CMD ["/app/scripts/docker/entrypoint.sh"]