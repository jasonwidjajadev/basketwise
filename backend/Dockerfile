# Read-only API image. No build tooling, no scraper, no data baked in --
# basketwise.db is bind-mounted read-only at runtime so a rebuild is a file swap.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    BASKETWISE_DB=/data/basketwise.db \
    BASKETWISE_WARM=/data/warm

WORKDIR /app

# Pinned so a rebuild can't silently pull a new major.
RUN pip install --no-cache-dir "fastapi==0.141.1" "uvicorn[standard]==0.38.0" \
 && useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin api

COPY --chown=root:root main.py db.py models.py shapes.py ./
COPY --chown=root:root routes/ ./routes/

USER 10001
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=2).status==200 else 1)"

# One worker: the workload is a handful of indexed SQLite reads, so a second
# process would double RSS to buy nothing. Scale by adding replicas if ever needed.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
