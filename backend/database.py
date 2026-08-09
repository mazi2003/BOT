import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class Database:
    def __init__(self, db_path: str = "cache.db"):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize database with required tables"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS audio_cache (
                        video_id TEXT PRIMARY KEY,
                        file_id TEXT NOT NULL,
                        title TEXT,
                        artist TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_video_id 
                    ON audio_cache(video_id)
                """)
                logger.info("✅ Database initialized successfully")
        except Exception as e:
            logger.error(f"Database initialization error: {e}")
    
    def get_file_id(self, video_id: str) -> str:
        """Get cached file_id for a video"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "SELECT file_id FROM audio_cache WHERE video_id = ?",
                    (video_id,)
                )
                result = cursor.fetchone()
                return result[0] if result else None
        except Exception as e:
            logger.error(f"Error getting file_id: {e}")
            return None
    
    def save_file_id(self, video_id: str, file_id: str, title: str = "", artist: str = ""):
        """Save file_id to cache"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """INSERT OR REPLACE INTO audio_cache 
                       (video_id, file_id, title, artist) 
                       VALUES (?, ?, ?, ?)""",
                    (video_id, file_id, title, artist)
                )
                conn.commit()
                logger.info(f"✅ Cached video: {video_id}")
        except Exception as e:
            logger.error(f"Error saving file_id: {e}")
    
    def get_stats(self) -> dict:
        """Get cache statistics"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "SELECT COUNT(*), MAX(created_at) FROM audio_cache"
                )
                count, latest = cursor.fetchone()
                return {
                    'total_cached': count or 0,
                    'latest': latest
                }
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {'total_cached': 0, 'latest': None}
