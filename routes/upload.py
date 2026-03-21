"""
routes/upload.py — File upload endpoint.

POST /api/upload
    Form fields:
      - file     : the binary file (multipart/form-data)
      - password : optional plaintext password to protect the download
"""

import os
import uuid
import hashlib
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename

from extensions import db
from models import FileRecord

upload_bp = Blueprint('upload', __name__)


# ── Helpers ────────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    """Return the SHA-256 hex digest of a plaintext password."""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


# ── Routes ─────────────────────────────────────────────────────────────────

@upload_bp.route('/api/upload', methods=['POST'])
def upload_file():
    """
    Accept a multipart file upload.

    Returns 201 JSON on success:
      {
        "success": true,
        "file_id": "...",
        "original_filename": "...",
        "file_size": 12345,
        "expires_at": "2025-01-01T00:00:00Z",
        "is_password_protected": false,
        "share_url": "https://example.com/download/<file_id>"
      }
    """
    # ── Validate presence of file field ───────────────────────────────────
    if 'file' not in request.files:
        return jsonify({'error': 'No file field found in request.'}), 400

    file = request.files['file']
    password = request.form.get('password', '').strip()

    if not file or file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400

    try:
        # ── Generate unique identifiers ───────────────────────────────────
        file_id = str(uuid.uuid4())
        original_filename = file.filename
        safe_name = secure_filename(original_filename)
        _, ext = os.path.splitext(safe_name)
        stored_filename = f"{file_id}{ext}"   # e.g. "abc123.pdf"

        # ── Save to disk ──────────────────────────────────────────────────
        upload_folder = current_app.config['UPLOAD_FOLDER']
        file_path = os.path.join(upload_folder, stored_filename)
        file.save(file_path)

        # ── Gather metadata ───────────────────────────────────────────────
        file_size   = os.path.getsize(file_path)
        mime_type   = file.content_type or 'application/octet-stream'
        expiry_days = current_app.config['FILE_EXPIRY_DAYS']
        expires_at  = datetime.utcnow() + timedelta(days=expiry_days)
        pw_hash     = _hash_password(password) if password else None

        # ── Persist metadata to database ──────────────────────────────────
        record = FileRecord(
            file_id=file_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_size=file_size,
            mime_type=mime_type,
            password_hash=pw_hash,
            expires_at=expires_at,
        )
        db.session.add(record)
        db.session.commit()

        current_app.logger.info(
            f"FILE_UPLOADED file_id={file_id} name={original_filename} "
            f"size={file_size} protected={pw_hash is not None} expires={expires_at.isoformat()}"
        )

        # ── Build response ────────────────────────────────────────────────
        base_url = current_app.config.get('APP_BASE_URL', '').rstrip('/')
        return jsonify({
            'success':              True,
            'file_id':              file_id,
            'original_filename':    original_filename,
            'file_size':            file_size,
            'expires_at':           expires_at.isoformat() + 'Z',
            'is_password_protected': pw_hash is not None,
            'share_url':            f"{base_url}/download/{file_id}",
        }), 201

    except Exception as exc:
        current_app.logger.error(f"UPLOAD_FAILED error={exc}")
        # Remove partially written file if it exists
        try:
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            pass
        return jsonify({'error': 'Upload failed. Please try again.'}), 500
