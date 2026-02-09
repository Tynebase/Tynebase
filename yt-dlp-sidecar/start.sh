#!/bin/bash
# Start bgutil PO-token HTTP server in background (port 4416)
# This generates proof-of-origin tokens so YouTube doesn't block yt-dlp
echo "Starting PO-token provider on port 4416..."
cd /app/pot-provider/server
node build/main.js --port 4416 &
POT_PID=$!
cd /app

# Wait for PO-token server to be ready
for i in $(seq 1 10); do
  if curl -sf http://localhost:4416/ > /dev/null 2>&1; then
    echo "PO-token provider is ready (PID: $POT_PID)"
    break
  fi
  echo "Waiting for PO-token provider... ($i/10)"
  sleep 1
done

# Start Flask API (bind IPv6 for Fly.io .internal access)
exec gunicorn --bind '[::]:5000' --timeout 300 --workers 2 app:app
