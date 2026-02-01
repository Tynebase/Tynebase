#!/bin/bash
# Start PO-token provider in background
# Note: bgutil-ytdlp-pot-provider doesn't have a server module, it's a yt-dlp plugin
# The plugin will be automatically loaded by yt-dlp when it runs

# Start Flask API
exec gunicorn --bind 0.0.0.0:5000 --timeout 300 --workers 2 app:app
