"""
DropZone — Instant File Sharing Web App
Main application factory (app.py)
"""

import os
from flask import Flask, render_template
from config import Config
from extensions import db
from utils.logger import setup_logger
from utils.cleanup import start_cleanup_scheduler


def create_app(config_class=Config):
    """
    Application factory pattern.
    Creates and configures the Flask app instance.
    """
    app = Flask(__name__)
    app.config.from_object(config_class)

    # ── Ensure required directories exist ──────────────────────────────────
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['LOG_FOLDER'], exist_ok=True)

    # ── Setup structured JSON logging first ────────────────────────────────
    setup_logger(app)

    # ── Initialize SQLAlchemy ──────────────────────────────────────────────
    db.init_app(app)

    # ── Register blueprints (route modules) ───────────────────────────────
    from routes.upload import upload_bp
    from routes.download import download_bp
    from routes.analytics import analytics_bp

    app.register_blueprint(upload_bp)
    app.register_blueprint(download_bp)
    app.register_blueprint(analytics_bp)

    # ── Create all database tables ─────────────────────────────────────────
    with app.app_context():
        db.create_all()
        app.logger.info("DATABASE_INIT tables=ready")

    # ── Start background cleanup scheduler ─────────────────────────────────
    start_cleanup_scheduler(app)

    # ── Root route ─────────────────────────────────────────────────────────
    @app.route('/')
    def index():
        return render_template('index.html')

    # ── Global error handlers ──────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return {'error': 'Resource not found'}, 404

    @app.errorhandler(413)
    def file_too_large(e):
        max_mb = app.config['MAX_CONTENT_LENGTH'] // (1024 * 1024)
        return {'error': f'File too large. Maximum allowed size is {max_mb}MB.'}, 413

    @app.errorhandler(500)
    def internal_error(e):
        app.logger.error(f"INTERNAL_ERROR error={e}")
        return {'error': 'Internal server error. Please try again.'}, 500

    return app
