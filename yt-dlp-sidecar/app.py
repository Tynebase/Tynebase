"""
YouTube Download Sidecar API
Provides an HTTP endpoint for downloading YouTube videos using yt-dlp with PO-token support
"""
from flask import Flask, request, jsonify, send_file
import yt_dlp
import os
import tempfile
import logging
from pathlib import Path

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# PO-token provider URL (running on same container)
POT_PROVIDER_URL = os.getenv('POT_PROVIDER_URL', 'http://localhost:4416')
# Residential proxy URL (e.g. socks5://user:pass@host:port or http://user:pass@host:port)
PROXY_URL = os.getenv('PROXY_URL', '')

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'yt-dlp-sidecar'}), 200

@app.route('/download', methods=['POST'])
def download_youtube():
    """
    Download YouTube video/audio
    
    Request body:
    {
        "url": "https://www.youtube.com/watch?v=...",
        "format": "bestaudio",  // optional
        "extract_audio": true    // optional
    }
    
    Returns: Audio file as binary stream
    """
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'Missing url parameter'}), 400
        
        video_url = data['url']
        format_spec = data.get('format', 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio')
        extract_audio = data.get('extract_audio', True)
        
        logger.info(f"Downloading: {video_url}")
        
        # Create temp directory for download
        temp_dir = tempfile.mkdtemp()
        output_template = os.path.join(temp_dir, '%(title)s.%(ext)s')
        
        # yt-dlp options with PO-token provider
        ydl_opts = {
            'format': format_spec,
            'outtmpl': output_template,
            'quiet': False,
            'no_warnings': False,
            'extract_flat': False,
            'noplaylist': True,
            'extractor_args': {
                'youtubepot-bgutilhttp': {
                    'base_url': [POT_PROVIDER_URL]
                }
            },
            'js_runtimes': {'node': {}},
        }
        
        if PROXY_URL:
            ydl_opts['proxy'] = PROXY_URL
            logger.info(f"Using proxy: {PROXY_URL.split('@')[-1] if '@' in PROXY_URL else 'configured'}")
        else:
            logger.warning('No PROXY_URL configured - YouTube may block datacenter IPs')
        
        if extract_audio:
            ydl_opts.update({
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
        
        # Download with yt-dlp
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            
            # Find the downloaded file
            if extract_audio:
                # Audio file will have .mp3 extension after post-processing
                filename = ydl.prepare_filename(info).rsplit('.', 1)[0] + '.mp3'
            else:
                filename = ydl.prepare_filename(info)
            
            if not os.path.exists(filename):
                # Try to find any file in temp dir
                files = list(Path(temp_dir).glob('*'))
                if files:
                    filename = str(files[0])
                else:
                    raise FileNotFoundError(f"Downloaded file not found: {filename}")
            
            logger.info(f"Download complete: {filename}")
            
            # Send file and cleanup
            response = send_file(
                filename,
                as_attachment=True,
                download_name=os.path.basename(filename),
                mimetype='audio/mpeg' if extract_audio else 'video/mp4'
            )
            
            # Cleanup temp files after sending
            @response.call_on_close
            def cleanup():
                try:
                    if os.path.exists(filename):
                        os.remove(filename)
                    if os.path.exists(temp_dir):
                        os.rmdir(temp_dir)
                except Exception as e:
                    logger.error(f"Cleanup error: {e}")
            
            return response
            
    except Exception as e:
        logger.error(f"Download error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
