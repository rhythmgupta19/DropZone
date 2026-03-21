# 📦 DropZone — Instant File Sharing Web App

A production-ready file sharing app built with **Python Flask**.
Upload files, get a shareable link, files auto-delete after **7 days**.

**Features:**
- 🔗 Unique shareable links — no account needed
- 🔒 Optional password protection per file
- 📊 Download count tracking + analytics dashboard
- ⏰ Auto-expiry + background cleanup scheduler
- 🧹 Structured JSON logging (rotating file + stdout)
- 🚀 One-click deploy to Render or Railway

---

## 📁 Folder Structure

```
dropzone/
│
├── app.py                  # Application factory (create_app)
├── wsgi.py                 # Gunicorn/production entry point
├── config.py               # All config loaded from .env
├── extensions.py           # Flask extension singletons (db)
├── models.py               # SQLAlchemy FileRecord model
│
├── routes/
│   ├── upload.py           # POST /api/upload
│   ├── download.py         # GET /download/<id>, POST /api/file/<id>/download
│   └── analytics.py        # GET /analytics, GET /api/analytics
│
├── utils/
│   ├── logger.py           # JSON rotating log handler setup
│   └── cleanup.py          # APScheduler background expiry job
│
├── templates/
│   ├── index.html          # Upload page (drag & drop UI)
│   ├── download.html       # Download page (file info + download)
│   └── analytics.html      # Analytics dashboard (Chart.js)
│
├── static/
│   ├── css/style.css       # Global glassmorphism stylesheet
│   └── js/
│       ├── upload.js       # Upload page logic (XHR + progress)
│       ├── download.js     # Download page logic (blob download)
│       └── analytics.js    # Dashboard charts + table
│
├── uploads/                # Uploaded files stored here (gitignored)
├── logs/                   # Rotating JSON log files (gitignored)
│
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── .env                    # Your local config (DO NOT commit)
├── .gitignore
├── Procfile                # For Render / Railway / Heroku
├── render.yaml             # Render Blueprint config
└── railway.toml            # Railway deployment config
```

---

## ⚡ Quick Start — Run Locally

### Step 1 — Prerequisites

Make sure you have **Python 3.10+** installed:

```bash
python3 --version   # Should show 3.10 or higher
```

### Step 2 — Clone / navigate to the project

```bash
cd dropzone
```

### Step 3 — Create a virtual environment

```bash
python3 -m venv venv
```

Activate it:

```bash
# macOS / Linux:
source venv/bin/activate

# Windows (Command Prompt):
venv\Scripts\activate.bat

# Windows (PowerShell):
venv\Scripts\Activate.ps1
```

You'll see `(venv)` in your terminal prompt when it's active.

### Step 4 — Install dependencies

```bash
pip install -r requirements.txt
```

### Step 5 — Set up environment variables

```bash
cp .env.example .env
```

The default `.env` works for local development as-is.
Only change `SECRET_KEY` for anything beyond local testing.

### Step 6 — Run the development server

```bash
python3 wsgi.py
```

Or with Flask's built-in server:

```bash
flask --app app:create_app run --debug
```

### Step 7 — Open the app

```
http://localhost:5000          → Upload page
http://localhost:5000/analytics → Analytics dashboard
http://localhost:5000/download/<id> → Download page
```

---

## 🌐 API Reference

### Upload a File

```
POST /api/upload
Content-Type: multipart/form-data

Fields:
  file      (required) — the binary file
  password  (optional) — plaintext password to protect download
```

**Success response (201):**
```json
{
  "success": true,
  "file_id": "abc123-...",
  "original_filename": "report.pdf",
  "file_size": 204800,
  "expires_at": "2025-01-08T12:00:00Z",
  "is_password_protected": false,
  "share_url": "https://your-app.com/download/abc123-..."
}
```

### Get File Info (no download)

```
GET /api/file/<file_id>/info
```

### Download a File

```
POST /api/file/<file_id>/download
Content-Type: application/json

Body: { "password": "optional-password" }
```

Returns the binary file stream on success.

### Analytics Data

```
GET /api/analytics
```

---

## 🚀 Deploy to Render (Free)

Render gives you free hosting with a PostgreSQL database add-on.

### Step 1 — Push your code to GitHub

```bash
git init
git add .
git commit -m "Initial DropZone commit"
git remote add origin https://github.com/YOUR_USERNAME/dropzone.git
git push -u origin main
```

### Step 2 — Create a Render account

Go to [https://render.com](https://render.com) and sign up (free).

### Step 3 — Create a new Web Service

1. Dashboard → **New** → **Web Service**
2. Connect your GitHub account and select your `dropzone` repo
3. Render auto-detects Python. Configure:
   - **Name:** `dropzone`
   - **Region:** Oregon (or closest to you)
   - **Branch:** `main`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn wsgi:app --workers 1 --threads 4 --timeout 120 --bind 0.0.0.0:$PORT`
   - **Plan:** Free

### Step 4 — Add a PostgreSQL database (recommended)

1. Dashboard → **New** → **PostgreSQL**
2. Name it `dropzone-db`, choose Free plan
3. After creation, copy the **Internal Database URL**
4. Go back to your Web Service → **Environment** → add:
   - `DATABASE_URL` = paste the Internal Database URL

### Step 5 — Set required environment variables

In your Web Service → **Environment**, add:

| Key | Value |
|-----|-------|
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `APP_BASE_URL` | `https://YOUR-APP-NAME.onrender.com` |
| `FILE_EXPIRY_DAYS` | `7` |
| `MAX_FILE_SIZE_MB` | `50` |
| `LOG_LEVEL` | `INFO` |

### Step 6 — Deploy

Click **Create Web Service**. Render builds and deploys automatically.
Every `git push` to `main` triggers a new deploy.

> ⚠️ **Free tier note:** Render free web services spin down after 15 minutes of inactivity.
> The first request after sleep takes ~30 seconds to wake up.
> Upgrade to the Starter plan ($7/mo) for always-on.

---

## 🚂 Deploy to Railway (Alternative)

Railway has a more generous free tier and no spin-down.

### Step 1 — Install Railway CLI

```bash
npm install -g @railway/cli
```

### Step 2 — Login and initialise

```bash
railway login
cd dropzone
railway init          # Creates a new Railway project
```

### Step 3 — Add a database

```bash
railway add --plugin postgresql
```

Railway automatically injects `DATABASE_URL` into your environment.

### Step 4 — Set environment variables

```bash
railway variables set SECRET_KEY="$(python3 -c "import secrets; print(secrets.token_hex(32))")"
railway variables set APP_BASE_URL="https://YOUR-APP.up.railway.app"
railway variables set FILE_EXPIRY_DAYS=7
railway variables set MAX_FILE_SIZE_MB=50
railway variables set LOG_LEVEL=INFO
```

### Step 5 — Deploy

```bash
railway up
```

Railway reads `railway.toml` and `Procfile` automatically.
Get your public URL:

```bash
railway domain
```

---

## ⚠️ Important: File Persistence on Free Hosting

> Both Render and Railway **free tiers use ephemeral disk storage**.
> Files uploaded to the `uploads/` folder will be **wiped on every redeploy**.
>
> **For production use**, migrate to PostgreSQL for the database (both platforms support it free) and use one of these for file storage:
> - **Cloudflare R2** — free up to 10 GB, S3-compatible
> - **Backblaze B2** — free up to 10 GB
> - **AWS S3** — pay-as-you-go, very cheap for small volumes
>
> This upgrade only requires changing the `upload.py` and `download.py` routes — the rest of the app stays identical.

---

## 🐛 Common Errors & Fixes

### `ModuleNotFoundError: No module named 'flask'`

Your virtual environment is not activated.

```bash
source venv/bin/activate     # macOS/Linux
venv\Scripts\activate.bat    # Windows
```

Then re-run `pip install -r requirements.txt`.

---

### `Address already in use` on port 5000

Something else is using port 5000. Run on a different port:

```bash
flask --app app:create_app run --port 5001
```

On macOS, AirPlay Receiver uses port 5000. Disable it in:
**System Preferences → Sharing → AirPlay Receiver → Off**.

---

### `413 Request Entity Too Large`

The uploaded file exceeds 50 MB. Either:
- Change `MAX_FILE_SIZE_MB=100` in `.env` and restart
- Or reject oversized files before uploading (client-side validation is already in `upload.js`)

---

### Files aren't being deleted after expiry

The cleanup scheduler runs **every 1 hour**. To test it immediately:

```python
# In a Python shell (with venv active):
from app import create_app
from utils.cleanup import _run_cleanup
app = create_app()
_run_cleanup(app)
```

---

### `sqlite3.OperationalError: unable to open database file`

The `instance/` folder doesn't exist. Flask creates it automatically, but if
you see this error, create it manually:

```bash
mkdir instance
```

---

### Render deploy fails — `ModuleNotFoundError`

Make sure `requirements.txt` is committed to git and all packages are listed.
Check by looking at the Render build log.

---

### `APP_BASE_URL` links point to localhost

Update `APP_BASE_URL` in the Render/Railway environment variables to your actual
public domain (e.g., `https://dropzone-abc123.onrender.com`) and redeploy.

---

## 📋 Development Tips

**Reset the database (local):**
```bash
rm instance/dropzone.db
python3 wsgi.py    # re-creates tables automatically on startup
```

**Watch the structured logs:**
```bash
tail -f logs/dropzone.log | python3 -m json.tool
```

**Test the upload API with curl:**
```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@/path/to/yourfile.pdf" \
  -F "password=secret123"
```

**Test password-protected download:**
```bash
curl -X POST http://localhost:5000/api/file/<FILE_ID>/download \
  -H "Content-Type: application/json" \
  -d '{"password":"secret123"}' \
  --output downloaded.pdf
```
