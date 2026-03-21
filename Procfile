# Procfile — used by Render, Railway, and Heroku
# Defines the command used to start the web server process.
web: gunicorn wsgi:app --workers 1 --threads 4 --timeout 120 --bind 0.0.0.0:$PORT --access-logfile - --error-logfile -
