# Python-based yt-dlp sidecar with PO-token provider
# Runs both the PO-token HTTP server and provides a download API endpoint
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies + Node.js (for bgutil PO-token server)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    dos2unix \
    git \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip install --no-cache-dir \
    yt-dlp \
    bgutil-ytdlp-pot-provider \
    flask \
    gunicorn

# Clone and build the bgutil PO-token HTTP server
RUN git clone --single-branch --branch 1.2.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /app/pot-provider \
    && cd /app/pot-provider/server \
    && npm install \
    && npx tsc

# Create directories
RUN mkdir -p /tmp/downloads

# Copy application files
COPY yt-dlp-sidecar/app.py .

# Expose ports
# 4416: PO-token provider
# 5000: Download API
EXPOSE 4416 5000

# Create startup script
COPY yt-dlp-sidecar/start.sh .
RUN dos2unix start.sh && chmod +x start.sh

# Start both services
CMD ["./start.sh"]
