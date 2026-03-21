"""
utils/logger.py — Structured JSON logging for DropZone.

Every log line is a single JSON object so it can be parsed by log
aggregation tools (Datadog, Render log streams, etc.).

Example output:
  {"timestamp":"2025-01-01T12:00:00.000Z","level":"INFO","message":"FILE_UPLOADED ..."}
"""

import os
import json
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler


class _JSONFormatter(logging.Formatter):
    """Formats every log record as a compact single-line JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level':     record.levelname,
            'message':   record.getMessage(),
            'logger':    record.name,
            'module':    record.module,
            'function':  record.funcName,
            'line':      record.lineno,
        }
        if record.exc_info:
            entry['exception'] = self.formatException(record.exc_info)
        return json.dumps(entry)


def setup_logger(app) -> None:
    """
    Attach structured JSON handlers to the Flask app logger.

    Handlers:
      1. RotatingFileHandler — logs/dropzone.log (10 MB, 5 backups)
      2. StreamHandler       — stdout/stderr for Render log tail
    """
    log_level_name = app.config.get('LOG_LEVEL', 'INFO').upper()
    log_level      = getattr(logging, log_level_name, logging.INFO)
    log_folder     = app.config.get('LOG_FOLDER', 'logs')

    os.makedirs(log_folder, exist_ok=True)

    # Remove any default Flask handlers
    app.logger.handlers.clear()
    app.logger.setLevel(log_level)
    app.logger.propagate = False   # don't bubble up to root logger

    formatter = _JSONFormatter()

    # ── Rotating file handler ─────────────────────────────────────────────
    log_path     = os.path.join(log_folder, 'dropzone.log')
    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(log_level)

    # ── Console (stdout) handler ───────────────────────────────────────────
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)

    app.logger.addHandler(file_handler)
    app.logger.addHandler(console_handler)
