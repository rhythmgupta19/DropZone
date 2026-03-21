"""
models.py — SQLAlchemy ORM models for DropZone.
"""

from datetime import datetime
from extensions import db


class FileRecord(db.Model):
    """
    Stores metadata for every uploaded file.
    The actual file bytes live on disk in UPLOAD_FOLDER.
    """
    __tablename__ = 'file_records'

    # ── Primary key ────────────────────────────────────────────────────────
    id = db.Column(db.Integer, primary_key=True)

    # ── File identity ──────────────────────────────────────────────────────
    file_id          = db.Column(db.String(36),  unique=True, nullable=False, index=True)
    original_filename = db.Column(db.String(255), nullable=False)   # user-facing name
    stored_filename   = db.Column(db.String(255), nullable=False)   # uuid-based name on disk

    # ── File attributes ────────────────────────────────────────────────────
    file_size  = db.Column(db.BigInteger, nullable=False)             # bytes
    mime_type  = db.Column(db.String(100), default='application/octet-stream')

    # ── Security ───────────────────────────────────────────────────────────
    # SHA-256 hex digest of password (64 chars); NULL means no password
    password_hash = db.Column(db.String(64), nullable=True)

    # ── Analytics ──────────────────────────────────────────────────────────
    download_count = db.Column(db.Integer, default=0, nullable=False)

    # ── Timestamps ─────────────────────────────────────────────────────────
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)

    # ── Soft-delete flag ───────────────────────────────────────────────────
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    # ──────────────────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        """Serialize to a safe public dictionary (password hash excluded)."""
        return {
            'file_id':              self.file_id,
            'original_filename':    self.original_filename,
            'file_size':            self.file_size,
            'mime_type':            self.mime_type,
            'download_count':       self.download_count,
            'created_at':           self.created_at.isoformat() + 'Z',
            'expires_at':           self.expires_at.isoformat() + 'Z',
            'is_password_protected': self.password_hash is not None,
            'is_deleted':           self.is_deleted,
        }

    def __repr__(self) -> str:
        return f'<FileRecord {self.file_id} | {self.original_filename}>'
