# Python-based yt-dlp sidecar with PO-token provider
# Runs both the PO-token HTTP server and provides a download API endpoint
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip install --no-cache-dir \
    yt-dlp \
    bgutil-ytdlp-pot-provider \
    flask \
    gunicorn

# Create directories
RUN mkdir -p /tmp/downloads

# Copy application files
COPY app.py .

# Expose ports
# 4416: PO-token provider
# 5000: Download API
EXPOSE 4416 5000

# Create startup script
COPY start.sh .
RUN chmod +x start.sh

# Start both services
CMD ["./start.sh"]
