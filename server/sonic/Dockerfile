FROM python:3.12-slim

WORKDIR /app

# Install system deps for essentia
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfftw3-dev libsamplerate0-dev libtag1-dev libchromaprint-dev \
    ffmpeg wget && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
