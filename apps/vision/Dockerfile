# Vision service for the deploy server: ffmpeg + the API, captions through the
# AI Gateway (VISION_CAPTIONER=gemini-*). No torch: the local VLM captioners
# need a GPU and aren't installed here. Build from apps/vision:
#
#   docker build -t healthyscroll-vision .

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY vision ./vision

RUN useradd -r -u 10001 app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"
CMD ["uvicorn", "vision.main:app", "--host", "0.0.0.0", "--port", "8000"]
