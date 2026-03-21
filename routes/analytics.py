"""
routes/analytics.py — Analytics dashboard page + API.

GET /analytics          — serve the analytics HTML dashboard
GET /api/analytics      — return aggregated platform statistics (JSON)
"""

from datetime import datetime

from flask import Blueprint, jsonify, render_template
from sqlalchemy import func

from extensions import db
from models import FileRecord

analytics_bp = Blueprint('analytics', __name__)


@analytics_bp.route('/analytics')
def analytics_page():
    """Serve the analytics HTML dashboard page."""
    return render_template('analytics.html')


@analytics_bp.route('/api/analytics', methods=['GET'])
def get_analytics():
    """
    Return aggregated platform-wide analytics.

    Response shape:
    {
      "summary": {
        "total_files": 42,
        "active_files": 30,
        "expired_files": 10,
        "deleted_files": 2,
        "total_downloads": 158,
        "total_size_bytes": 1048576,
        "total_size_mb": 1.0
      },
      "top_files":      [ <FileRecord.to_dict()>, ... ],  // top 10 by downloads
      "recent_uploads": [ <FileRecord.to_dict()>, ... ]   // latest 10
    }
    """
    now = datetime.utcnow()

    # ── Counts ────────────────────────────────────────────────────────────
    total_files = FileRecord.query.count()

    active_files = FileRecord.query.filter(
        FileRecord.is_deleted == False,       # noqa: E712
        FileRecord.expires_at > now
    ).count()

    expired_files = FileRecord.query.filter(
        FileRecord.is_deleted == False,       # noqa: E712
        FileRecord.expires_at <= now
    ).count()

    deleted_files = FileRecord.query.filter_by(is_deleted=True).count()

    # ── Aggregate totals ──────────────────────────────────────────────────
    total_downloads = (
        db.session.query(func.sum(FileRecord.download_count)).scalar() or 0
    )
    total_size_bytes = (
        db.session.query(func.sum(FileRecord.file_size))
        .filter(FileRecord.is_deleted == False)       # noqa: E712
        .scalar() or 0
    )

    # ── Top 10 most-downloaded active files ───────────────────────────────
    top_files = (
        FileRecord.query
        .filter(
            FileRecord.is_deleted == False,           # noqa: E712
            FileRecord.expires_at > now
        )
        .order_by(FileRecord.download_count.desc())
        .limit(10)
        .all()
    )

    # ── 10 most recent uploads (including expired, excluding deleted) ─────
    recent_uploads = (
        FileRecord.query
        .filter_by(is_deleted=False)
        .order_by(FileRecord.created_at.desc())
        .limit(10)
        .all()
    )

    return jsonify({
        'summary': {
            'total_files':       total_files,
            'active_files':      active_files,
            'expired_files':     expired_files,
            'deleted_files':     deleted_files,
            'total_downloads':   int(total_downloads),
            'total_size_bytes':  int(total_size_bytes),
            'total_size_mb':     round(int(total_size_bytes) / (1024 * 1024), 2),
        },
        'top_files':      [f.to_dict() for f in top_files],
        'recent_uploads': [f.to_dict() for f in recent_uploads],
    }), 200
