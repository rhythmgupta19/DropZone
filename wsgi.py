"""
wsgi.py — Production entry point for Gunicorn / Render / Railway.

Usage:
    gunicorn wsgi:app --workers 1 --threads 4 --bind 0.0.0.0:$PORT
"""

from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run()
