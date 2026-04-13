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
# Residential proxy URLs (comma-separated, e.g. http://user:pass@host:port,http://user:pass@host:port)
PROXY_URLS = os.getenv('PROXY_URLS', '').split(',') if os.getenv('PROXY_URLS') else []
# Single proxy URL for backward compatibility
PROXY_URL = os.getenv('PROXY_URL', '')
# YouTube cookies file path (for bypassing bot detection)
COOKIES_FILE = os.getenv('COOKIES_FILE', '')

# Combine PROXY_URL (if set) with PROXY_URLS for rotation
if PROXY_URL and PROXY_URL not in PROXY_URLS:
    PROXY_URLS.insert(0, PROXY_URL)

# Track current proxy index for rotation
current_proxy_index = 0

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'yt-dlp-sidecar'}), 200

@app.route('/download', methods=['POST'])
def download_youtube():
    """
    Download YouTube video/audio with proxy rotation
    
    Request body:
    {
        "url": "https://www.youtube.com/watch?v=...",
        "format": "bestaudio",  // optional
        "extract_audio": true    // optional
    }
    
    Returns: Audio file as binary stream
    """
    global current_proxy_index
    
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'Missing url parameter'}), 400
        
        video_url = data['url']
        format_spec = data.get('format', 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio')
        extract_audio = data.get('extract_audio', True)
        
        logger.info(f"Downloading: {video_url}")
        
        # If no proxies configured, try without proxy
        if not PROXY_URLS:
            logger.warning('No proxy URLs configured - attempting download without proxy')
            return download_with_proxy(video_url, format_spec, extract_audio, None)
        
        # Try each proxy in rotation until one succeeds
        last_error = None
        for attempt in range(len(PROXY_URLS)):
            proxy = PROXY_URLS[current_proxy_index]
            logger.info(f"Attempt {attempt + 1}/{len(PROXY_URLS)}: Using proxy {proxy.split('@')[-1] if '@' in proxy else proxy}")
            
            try:
                result = download_with_proxy(video_url, format_spec, extract_audio, proxy)
                # Success - keep this proxy as current for next request
                return result
            except Exception as e:
                last_error = e
                logger.warning(f"Proxy {proxy.split('@')[-1] if '@' in proxy else proxy} failed: {str(e)}")
                # Rotate to next proxy
                current_proxy_index = (current_proxy_index + 1) % len(PROXY_URLS)
        
        # All proxies failed
        error_msg = f"All {len(PROXY_URLS)} proxies failed. Last error: {str(last_error)}"
        logger.error(error_msg)
        return jsonify({'error': error_msg}), 500
            
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        return jsonify({'error': str(e)}), 500


def download_with_proxy(video_url: str, format_spec: str, extract_audio: bool, proxy_url: str):
    """Download video using specific proxy"""
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
    
    if proxy_url:
        ydl_opts['proxy'] = proxy_url
        logger.info(f"Using proxy: {proxy_url.split('@')[-1] if '@' in proxy_url else 'configured'}")
    else:
        logger.warning('No proxy configured - YouTube may block datacenter IPs')
    
    if COOKIES_FILE:
        ydl_opts['cookiefile'] = COOKIES_FILE
        logger.info(f"Using cookies file: {COOKIES_FILE}")
    else:
        logger.warning('No COOKIES_FILE configured - YouTube may require authentication')
    
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
                    import shutil
                    shutil.rmtree(temp_dir)
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
        
        return response

@app.route('/download-generic', methods=['POST'])
def download_generic():
    """
    Download video/audio from any yt-dlp supported site (Vimeo, Dailymotion, Twitter, TikTok, etc.)
    Skips YouTube-specific PO-token configuration.
    
    Request body:
    {
        "url": "https://vimeo.com/...",
        "format": "bestaudio",  // optional
        "extract_audio": true    // optional
    }
    
    Returns: Audio/video file as binary stream
    """
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'Missing url parameter'}), 400
        
        video_url = data['url']
        format_spec = data.get('format', 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio')
        extract_audio = data.get('extract_audio', True)
        
        logger.info(f"Generic download: {video_url}")
        
        # Create temp directory for download
        temp_dir = tempfile.mkdtemp()
        output_template = os.path.join(temp_dir, '%(title)s.%(ext)s')
        
        # yt-dlp options WITHOUT YouTube-specific PO-token config
        ydl_opts = {
            'format': format_spec,
            'outtmpl': output_template,
            'quiet': False,
            'no_warnings': False,
            'extract_flat': False,
            'noplaylist': True,
        }
        
        if PROXY_URL:
            ydl_opts['proxy'] = PROXY_URL
            logger.info(f"Using proxy: {PROXY_URL.split('@')[-1] if '@' in PROXY_URL else 'configured'}")
        
        if extract_audio:
            ydl_opts.update({
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
        
        # Download with yt-dlp (supports 1000+ sites)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            
            # Find the downloaded file
            if extract_audio:
                filename = ydl.prepare_filename(info).rsplit('.', 1)[0] + '.mp3'
            else:
                filename = ydl.prepare_filename(info)
            
            if not os.path.exists(filename):
                files = list(Path(temp_dir).glob('*'))
                if files:
                    filename = str(files[0])
                else:
                    raise FileNotFoundError(f"Downloaded file not found: {filename}")
            
            logger.info(f"Generic download complete: {filename}")
            
            response = send_file(
                filename,
                as_attachment=True,
                download_name=os.path.basename(filename),
                mimetype='audio/mpeg' if extract_audio else 'video/mp4'
            )
            
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
        logger.error(f"Generic download error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/supported', methods=['POST'])
def check_supported():
    """
    Check if a URL is supported by yt-dlp (without downloading).
    
    Request body:
    {
        "url": "https://vimeo.com/..."
    }
    
    Returns: { "supported": true/false, "extractor": "Vimeo", "title": "..." }
    """
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'Missing url parameter'}), 400
        
        video_url = data['url']
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'skip_download': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            return jsonify({
                'supported': True,
                'extractor': info.get('extractor', 'unknown'),
                'title': info.get('title', ''),
            }), 200
            
    except Exception as e:
        return jsonify({
            'supported': False,
            'error': str(e),
        }), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
