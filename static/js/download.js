/**
 * download.js — DropZone download page logic.
 *
 * Responsibilities:
 *  - Fetch file metadata on page load
 *  - Show correct UI state (loading / file found / expired / not found)
 *  - Handle password-protected files
 *  - POST to download endpoint and trigger browser download via Blob URL
 */

'use strict';

// FILE_ID is injected by the Flask template:  <script>const FILE_ID = "{{ file_id }}";</script>

// ── DOM references ───────────────────────────────────────────────────────────
const loadingState   = document.getElementById('loading-state');
const fileState      = document.getElementById('file-state');
const expiredState   = document.getElementById('expired-state');
const notFoundState  = document.getElementById('notfound-state');

const fileIcon       = document.getElementById('file-icon');
const fileName       = document.getElementById('file-name');
const fileSubinfo    = document.getElementById('file-subinfo');
const infoSize       = document.getElementById('info-size');
const infoDownloads  = document.getElementById('info-downloads');
const infoCreated    = document.getElementById('info-created');
const infoExpires    = document.getElementById('info-expires');
const expiryRemaining= document.getElementById('expiry-remaining');
const expiryBar      = document.getElementById('expiry-bar');

const pwGroup        = document.getElementById('pw-group');
const passwordInput  = document.getElementById('password');
const pwError        = document.getElementById('pw-error');

const downloadBtn    = document.getElementById('download-btn');
const downloadIcon   = document.getElementById('download-icon');
const downloadText   = document.getElementById('download-text');

// ── Utility helpers ──────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatRelativeTime(isoStr) {
  const ms   = new Date(isoStr) - Date.now();
  if (ms <= 0) return 'Expired';
  const days  = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

function mimeToIcon(mime, name = '') {
  if (!mime) mime = '';
  if (mime.startsWith('image/'))         return '🖼️';
  if (mime.startsWith('video/'))         return '🎬';
  if (mime.startsWith('audio/'))         return '🎵';
  if (mime === 'application/pdf')        return '📕';
  if (mime.includes('zip') || mime.includes('compressed') || /\.(zip|rar|7z|tar|gz)$/i.test(name)) return '🗜️';
  if (mime.includes('word')  || /\.(doc|docx)$/i.test(name))  return '📝';
  if (mime.includes('sheet') || /\.(xls|xlsx)$/i.test(name))  return '📊';
  if (mime.includes('presentation') || /\.(ppt|pptx)$/i.test(name)) return '📑';
  if (mime.startsWith('text/') || /\.txt$/i.test(name))       return '📄';
  return '📦';
}

// ── Show / hide states ───────────────────────────────────────────────────────

function showState(state) {
  loadingState.classList.add('hidden');
  fileState.classList.add('hidden');
  expiredState.classList.add('hidden');
  notFoundState.classList.add('hidden');
  state.classList.remove('hidden');
}

// ── Load file info ───────────────────────────────────────────────────────────

async function loadFileInfo() {
  try {
    const res = await fetch(`/api/file/${FILE_ID}/info`);

    if (res.status === 404) { showState(notFoundState); return; }
    if (res.status === 410) { showState(expiredState);  return; }

    if (!res.ok) { showState(notFoundState); return; }

    const data = await res.json();
    renderFileInfo(data);
    showState(fileState);

  } catch (err) {
    console.error('Failed to load file info:', err);
    showState(notFoundState);
  }
}

function renderFileInfo(data) {
  // Icon & title
  fileIcon.textContent   = mimeToIcon(data.mime_type, data.original_filename);
  fileName.textContent   = data.original_filename;
  fileSubinfo.textContent = `${data.mime_type || 'Unknown type'}`;

  // Info grid
  infoSize.textContent      = formatBytes(data.file_size);
  infoDownloads.textContent = data.download_count.toLocaleString();
  infoCreated.textContent   = formatDate(data.created_at);
  infoExpires.textContent   = formatDate(data.expires_at);

  // Expiry progress bar (percentage of 7-day lifetime remaining)
  const created   = new Date(data.created_at).getTime();
  const expires   = new Date(data.expires_at).getTime();
  const now       = Date.now();
  const lifetime  = expires - created;
  const remaining = Math.max(0, expires - now);
  const pct       = lifetime > 0 ? Math.round((remaining / lifetime) * 100) : 0;

  expiryBar.style.width       = `${pct}%`;
  expiryRemaining.textContent = formatRelativeTime(data.expires_at);

  // Adjust expiry bar colour when nearly expired
  if (pct < 20) {
    expiryBar.style.background = 'linear-gradient(90deg,#ff5252,#ffd600)';
  } else if (pct < 50) {
    expiryBar.style.background = 'linear-gradient(90deg,#ffd600,#00d4ff)';
  }

  // Password field
  if (data.is_password_protected) {
    pwGroup.classList.remove('hidden');
  }

  // Store filename for download trigger
  downloadBtn.dataset.filename = data.original_filename;
}

// ── Download logic ───────────────────────────────────────────────────────────

function setDownloading(isDownloading) {
  downloadBtn.disabled = isDownloading;
  if (isDownloading) {
    downloadIcon.textContent = '';
    downloadText.textContent = 'Downloading…';
    // Inline spinner via CSS class reuse
    downloadIcon.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';
  } else {
    downloadIcon.textContent = '⬇️';
    downloadText.textContent = 'Download File';
  }
}

function showPwError(msg) {
  pwError.textContent = msg;
  pwError.classList.remove('hidden');
  passwordInput.classList.add('pw-error-shake');
  setTimeout(() => passwordInput.classList.remove('pw-error-shake'), 400);
}

function clearPwError() {
  pwError.classList.add('hidden');
  pwError.textContent = '';
}

downloadBtn.addEventListener('click', async () => {
  clearPwError();
  const password = passwordInput.value.trim();

  // If password field is visible and empty, prompt user
  if (!pwGroup.classList.contains('hidden') && !password) {
    showPwError('Please enter the password to download this file.');
    passwordInput.focus();
    return;
  }

  setDownloading(true);

  try {
    const res = await fetch(`/api/file/${FILE_ID}/download`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    });

    if (res.status === 403) {
      const err = await res.json();
      showPwError(err.error || 'Incorrect password.');
      setDownloading(false);
      return;
    }

    if (res.status === 410) {
      showState(expiredState);
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showPwError(err.error || 'Download failed. Please try again.');
      setDownloading(false);
      return;
    }

    // ── Trigger browser download via Blob URL ────────────────────────────
    const blob     = await res.blob();
    const url      = URL.createObjectURL(blob);
    const anchor   = document.createElement('a');
    anchor.href    = url;
    anchor.download = downloadBtn.dataset.filename || 'download';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    // Update download count display (+1)
    const current = parseInt(infoDownloads.textContent.replace(/,/g, ''), 10) || 0;
    infoDownloads.textContent = (current + 1).toLocaleString();

  } catch (err) {
    console.error('Download error:', err);
    showPwError('Network error. Please check your connection.');
  } finally {
    setDownloading(false);
  }
});

// Allow pressing Enter in password field to trigger download
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') downloadBtn.click();
});

// ── Init ─────────────────────────────────────────────────────────────────────
loadFileInfo();
