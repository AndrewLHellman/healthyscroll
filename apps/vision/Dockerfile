# Vision service for the deploy server: CPU only, SigLIP 2 scorer, captions via
# the AI Gateway (VISION_CAPTIONER=gemini-*). Local VLM captioners need a GPU
# and aren't installed here. Build from apps/vision:
#
#   docker build -t healthyscroll-vision .
#
# The SigLIP weights are baked into the image so a restart never waits on the
# Hugging Face Hub.

FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/models HF_HUB_DISABLE_TELEMETRY=1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# CPU torch wheels (a fraction of the CUDA ones), then the API deps + transformers.
COPY requirements.txt ./
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install -r requirements.txt "transformers>=4.57"

# Download the scorer once, at build time, into HF_HOME (~1.5 GB: 375M params
# in fp32). Read-only at runtime, hence offline mode below; no chown, which
# would duplicate the layer.
RUN python -c "from transformers import AutoModel, AutoProcessor; \
    AutoProcessor.from_pretrained('google/siglip2-base-patch16-224'); \
    AutoModel.from_pretrained('google/siglip2-base-patch16-224')"

COPY vision ./vision

RUN useradd -r -u 10001 app
USER app
ENV HF_HUB_OFFLINE=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"
CMD ["uvicorn", "vision.main:app", "--host", "0.0.0.0", "--port", "8000"]
