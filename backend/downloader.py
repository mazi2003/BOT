import os
import re
import subprocess
import tempfile
from typing import Optional, Dict, Tuple
import yt_dlp
import logging

logger = logging.getLogger(__name__)

class Downloader:
    def __init__(self):
        self.cookies_file = os.getenv('COOKIES_FILE', 'cookies.txt')
        self.max_size_mb = 50  # Telegram limit
        self.ydl_opts = {
            'format': 'bestaudio/best',
            'extractaudio': True,
            'audioformat': 'mp3',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '128',
            }],
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        
        # Add cookies if available
        if os.path.exists(self.cookies_file):
            self.ydl_opts['cookiefile'] = self.cookies_file
            logger.info("✅ Using cookies file for YouTube")
    
    def extract_video_id(self, url: str) -> str:
        """Extract YouTube video ID from URL"""
        patterns = [
            r'(?:youtube\.com\/watch\?v=)([\w-]{11})',
            r'(?:youtu\.be\/)([\w-]{11})',
            r'(?:youtube\.com\/embed\/)([\w-]{11})',
            r'(?:youtube\.com\/v\/)([\w-]{11})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    def sanitize_title(self, title: str) -> str:
        """Clean up audio title from video metadata"""
        # Remove common suffixes
        patterns = [
            r'\s*\(?Official\s+(?:Music\s+)?Video\)?',
            r'\s*\(?Official\s+Audio\)?',
            r'\s*\(?Audio\)?',
            r'\s*\(?HD\)?',
            r'\s*\(?4K\)?',
            r'\s*\(?Lyrics?\)?',
            r'\s*\(?VEVO\)?',
            r'\s*-\s*Topic$',
            r'\s*\|.*$',
        ]
        
        cleaned = title
        for pattern in patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
        
        # Remove duplicate artist names (e.g., "Artist - Artist - Title")
        cleaned = re.sub(r'^([^-]+)\s*-\s*\1\s*-', r'\1 -', cleaned)
        
        # Clean extra spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        return cleaned
    
    def get_track_info(self, url: str) -> list:
        """Fetch track information without downloading. Returns a list of tracks."""
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
            }
            
            if os.path.exists(self.cookies_file):
                ydl_opts['cookiefile'] = self.cookies_file
            
            # Use search if it's not a URL
            search_query = url
            is_search = not (url.startswith('http://') or url.startswith('https://'))
            if is_search:
                search_query = f"ytsearch10:{url}"
                
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(search_query, download=False)
                
                entries = []
                if 'entries' in info:
                    entries = info['entries']
                else:
                    entries = [info]
                    
                if not entries:
                    return []
                    
                results = []
                for entry in entries:
                    if not entry:
                        continue
                    title = entry.get('title', 'أغنية بدون عنوان')
                    artist = entry.get('uploader', 'فنان غير معروف')
                    
                    title = self.sanitize_title(title)
                    
                    if ' - ' in title and 'Topic' in artist:
                        parts = title.split(' - ', 1)
                        artist = parts[0]
                        title = parts[1]
                        
                    results.append({
                        'id': entry.get('id'),
                        'title': title,
                        'artist': artist,
                        'duration': entry.get('duration', 0),
                        'thumbnail': entry.get('thumbnail'),
                        'url': f"https://www.youtube.com/watch?v={entry.get('id')}"
                    })
                
                return results
                
        except Exception as e:
            logger.error(f"Error fetching track info: {e}")
            return []
    
    async def download_audio(self, url: str) -> Tuple[Optional[str], Dict]:
        """Download audio from YouTube and convert to MP3"""
        temp_dir = tempfile.mkdtemp()
        output_template = os.path.join(temp_dir, '%(title)s.%(ext)s')
        
        # First, try remote service (tier 1)
        # audio_url = await self._try_remote_service(url)
        # if audio_url:
        #     return await self._download_from_url(audio_url)
        
        # Fallback to local yt-dlp (tier 2)
        try:
            opts = self.ydl_opts.copy()
            opts['outtmpl'] = output_template
            
            search_query = url
            if not (url.startswith('http://') or url.startswith('https://')):
                search_query = f"ytsearch1:{url}"
                
            with yt_dlp.YoutubeDL(opts) as ydl:
                # Extract info first
                info = ydl.extract_info(search_query, download=False)
                
                # If it's a search result, it returns a playlist with entries
                if 'entries' in info:
                    if not info['entries']:
                        return None, {}
                    info = info['entries'][0]
                    # Get the actual video URL to download
                    search_query = info.get('webpage_url', search_query)
                
                # Check file size
                filesize = info.get('filesize_approx', 0)
                if filesize > self.max_size_mb * 1024 * 1024:
                    logger.warning(f"File too large: {filesize} bytes")
                    return None, {}
                
                # Download audio
                ydl.download([search_query])
                
                # Find downloaded file
                downloaded_files = [f for f in os.listdir(temp_dir) if f.endswith('.mp3')]
                
                if not downloaded_files:
                    return None, {}
                
                audio_path = os.path.join(temp_dir, downloaded_files[0])
                
                # Extract metadata
                title = self.sanitize_title(info.get('title', 'أغنية بدون عنوان'))
                artist = info.get('uploader', 'فنان غير معروف')
                
                # Parse artist from title if needed
                if ' - ' in title:
                    parts = title.split(' - ', 1)
                    artist = parts[0]
                    title = parts[1]
                
                metadata = {
                    'title': title,
                    'artist': artist,
                    'duration': info.get('duration', 0),
                }
                
                return audio_path, metadata
                
        except Exception as e:
            logger.error(f"Download error: {e}")
            return None, {}
    
    async def _try_remote_service(self, url: str) -> Optional[str]:
        """Try to get audio URL from remote service (tier 1)"""
        # Placeholder for remote service integration
        # e.g., Cobalt.tools API
        return None
    
    async def _download_from_url(self, audio_url: str) -> Tuple[Optional[str], Dict]:
        """Download audio from a direct URL"""
        # Implementation for downloading from remote service URL
        pass
