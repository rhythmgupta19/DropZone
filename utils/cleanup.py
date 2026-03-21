"""
utils/cleanup.py — Background scheduler that deletes expired files.

Runs every CLEANUP_INTERVAL_HOURS (default: 1 hour).
For each expired record it:
  1. Removes the file from disk
  2. Sets is_deleted = True in the database
"""

import os
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger


def _run_cleanup(app) -> None:
    """Core cleanup logic — runs inside the app context."""
    with app.app_context():
        from extensions import db
        from models import FileRecord

        now = datetime.utcnow()

        # Fetch all expired, non-deleted records
        expired_records = FileRecord.query.filter(
            FileRecord.expires_at <= now,
            FileRecord.is_deleted == False,   # noqa: E712
        ).all()

        if not expired_records:
            app.logger.info("CLEANUP_RUN status=nothing_to_delete")
            return

        upload_folder = app.config['UPLOAD_FOLDER']
        deleted_count = 0
        error_count   = 0

        for record in expired_records:
            file_path = os.path.join(upload_folder, record.stored_filename)
            try:
                # Remove physical file (ignore if already missing)
                if os.path.exists(file_path):
                    os.remove(file_path)
                record.is_deleted = True
                deleted_count += 1
            except OSError as exc:
                error_count += 1
                app.logger.error(
                    f"CLEANUP_ERROR file_id={record.file_id} error={exc}"
                )

        db.session.commit()
        app.logger.info(
            f"CLEANUP_RUN deleted={deleted_count} errors={error_count} "
            f"timestamp={now.isoformat()}"
        )


def start_cleanup_scheduler(app) -> None:
    """
    Start the APScheduler background job.

    Uses a daemon=True scheduler so it doesn't prevent app shutdown.
    max_instances=1 prevents overlapping runs.
    """
    interval_hours = app.config.get('CLEANUP_INTERVAL_HOURS', 1)

    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(
        func=_run_cleanup,
        args=[app],
        trigger=IntervalTrigger(hours=interval_hours),
        id='dropzone_cleanup',
        name='Delete expired files',
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    app.logger.info(f"SCHEDULER_STARTED interval_hours={interval_hours}")
