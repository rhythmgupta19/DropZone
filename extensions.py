"""
extensions.py — Flask extension singletons.

Instantiated here and initialized in create_app() to avoid circular imports.
"""

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
