"""
routes/download.py — File info and download endpoints.

GET  /download/<file_id>             — serve the download HTML page
GET  /api/file/<file_id>/info        — return file metadata (no download)
POST /api/file/<file_id>/download    — verify password + stream file
"""

import os
import hashlib
from datetime import datetime

from flask import (
    Blueprint, request, jsonify,
    send_from_directory, render_template, current_app
)

from extensions import db
from models import FileRecord

download_bp = Blueprint('download', __name__)


# ── Helpers ────────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def _get_active_record(file_id: str):
    """
    Return the FileRecord if it exists and is not soft-deleted.
    Returns (record, error_response_tuple) — one of them will be None.
    """
    record = FileRecord.query.filter_by(file_id=file_id, is_deleted=False).first()
    if not record:
        return None, (jsonify({'error': 'File not found or has been deleted.'}), 404)
    return record, None


# ── Routes ─────────────────────────────────────────────────────────────────

@download_bp.route('/download/<file_id>')
def download_page(file_id: str):
    """Serve the download HTML page (JavaScript fetches info separately)."""
    return render_template('download.html', file_id=file_id)


@download_bp.route('/api/file/<file_id>/info', methods=['GET'])
def file_info(file_id: str):
    """
    Return public metadata for a file.
    Does NOT trigger a download or require a password.

    Returns 200 with file dict, or 404/410 on error.
    """
    record, err = _get_active_record(file_id)
    if err:
        return err

    if datetime.utcnow() > record.expires_at:
        return jsonify({'error': 'This file has expired and is no longer available.'}), 410

    return jsonify(record.to_dict()), 200


@download_bp.route('/api/file/<file_id>/download', methods=['POST'])
def download_file(file_id: str):
    """
    Verify the password (if set) and stream the file to the client.

    Request body (JSON):
      { "password": "optional-plaintext-password" }

    On success: streams the binary file with Content-Disposition: attachment.
    On failure: returns JSON error.
    """
    record, err = _get_active_record(file_id)
    if err:
        return err

    # ── Check expiry ──────────────────────────────────────────────────────
    if datetime.utcnow() > record.expires_at:
        return jsonify({'error': 'This file has expired and is no longer available.'}), 410

    # ── Password verification ──────────────────────────────────────────────
    if record.password_hash:
        body = request.get_json(silent=True) or {}
        provided = body.get('password', '').strip()

        if not provided:
            return jsonify({
                'error': 'This file is password protected. Please provide the password.'
            }), 403

        if _hash_password(provided) != record.password_hash:
            current_app.logger.warning(f"WRONG_PASSWORD file_id={file_id}")
            return jsonify({'error': 'Incorrect password. Please try again.'}), 403

    # ── Verify file exists on disk ─────────────────────────────────────────
    upload_folder = current_app.config['UPLOAD_FOLDER']
    file_path = os.path.join(upload_folder, record.stored_filename)

    if not os.path.exists(file_path):
        current_app.logger.error(f"FILE_MISSING file_id={file_id} path={file_path}")
        return jsonify({'error': 'File data not found on server. It may have been cleaned up.'}), 500

    # ── Increment download counter ─────────────────────────────────────────
    record.download_count += 1
    db.session.commit()

    current_app.logger.info(
        f"FILE_DOWNLOADED file_id={file_id} name={record.original_filename} "
        f"total_downloads={record.download_count}"
    )

    # ── Stream file ────────────────────────────────────────────────────────
    return send_from_directory(
        os.path.abspath(upload_folder),
        record.stored_filename,
        as_attachment=True,
        download_name=record.original_filename,   # restores original name for user
        mimetype=record.mime_type,
    )
