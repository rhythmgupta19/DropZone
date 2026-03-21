"""
config.py — All configuration loaded from environment variables via .env
"""

import os
from dotenv import load_dotenv

# Load .env file into environment (no-op if already set by platform)
load_dotenv()


class Config:
    # ── Security ───────────────────────────────────────────────────────────
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-CHANGE-IN-PRODUCTION')

    # ── Database ───────────────────────────────────────────────────────────
    # SQLite by default; swap for PostgreSQL on production:
    # DATABASE_URL=postgresql://user:pass@host:5432/dropzone
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///dropzone.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ── File Storage ───────────────────────────────────────────────────────
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_FILE_SIZE_MB', 50)) * 1024 * 1024  # bytes

    # ── File Expiry ────────────────────────────────────────────────────────
    FILE_EXPIRY_DAYS = int(os.getenv('FILE_EXPIRY_DAYS', 7))

    # ── Logging ────────────────────────────────────────────────────────────
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FOLDER = os.getenv('LOG_FOLDER', 'logs')

    # ── Background Scheduler ───────────────────────────────────────────────
    CLEANUP_INTERVAL_HOURS = int(os.getenv('CLEANUP_INTERVAL_HOURS', 1))

    # ── Public-facing base URL (used to build share links) ─────────────────
    APP_BASE_URL = os.getenv('APP_BASE_URL', 'http://localhost:5000')
