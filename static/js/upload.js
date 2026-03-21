/**
 * upload.js — DropZone upload page logic.
 *
 * Responsibilities:
 *  - Drag & drop + click-to-browse
 *  - Client-side file size validation
 *  - XHR upload with live progress bar
 *  - Password protection toggle
 *  - Display result card with shareable link
 *  - Copy-to-clipboard with feedback
 */

'use strict';

// ── Constants ───────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// ── DOM references ──────────────────────────────────────────────────────────
const dropZone        = document.getElementById('drop-zone');
const fileInput       = document.getElementById('file-input');
const filePreview     = document.getElementById('file-preview');
const previewIcon     = document.getElementById('preview-icon');
const previewName     = document.getElementById('preview-name');
const previewSize     = document.getElementById('preview-size');
const removeFileBtn   = document.getElementById('remove-file');
const pwToggle        = document.getElementById('pw-toggle');
const pwToggleIcon    = document.getElementById('pw-toggle-icon');
const pwToggleText    = document.getElementById('pw-toggle-text');
const pwGroup         = document.getElementById('pw-group');
const passwordInput   = document.getElementById('password');
const uploadBtn       = document.getElementById('upload-btn');
const uploadBtnText   = document.getElementById('upload-btn-text');
const uploadBtnIcon   = document.getElementById('upload-btn-icon');
const progressSection = document.getElementById('progress-section');
const progressBar     = document.getElementById('progress-bar');
const progressPct     = document.getElementById('progress-pct');
const uploadError     = document.getElementById('upload-error');
const uploadSection   = document.getElementById('upload-section');
const resultSection   = document.getElementById('result-section');
const resultSubtitle  = document.getElementById('result-subtitle');
const metaName        = document.getElementById('meta-name');
const metaSize        = document.getElementById('meta-size');
const metaExpires     = document.getElementById('meta-expires');
const metaProtected   = document.getElementById('meta-protected');
const shareLink       = document.getElementById('share-link');
const copyBtn         = document.getElementById('copy-btn');
const uploadAnotherBtn= document.getElementById('upload-another-btn');

// ── State ───────────────────────────────────────────────────────────────────
let selectedFile = null;
let pwVisible    = false;

// ── Utility helpers ─────────────────────────────────────────────────────────

/** Format bytes into a human-readable string (KB / MB). */
function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Return an emoji icon based on file MIME type or extension. */
function fileIcon(file) {
  const { type, name } = file;
  if (type.startsWith('image/'))       return '🖼️';
  if (type.startsWith('video/'))       return '🎬';
  if (type.startsWith('audio/'))       return '🎵';
  if (type === 'application/pdf')      return '📕';
  if (type.includes('zip') || type.includes('compressed') || name.endsWith('.zip') || name.endsWith('.rar')) return '🗜️';
  if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return '📝';
  if (type.includes('sheet') || name.endsWith('.xls') || name.endsWith('.xlsx')) return '📊';
  if (type.includes('presentation') || name.endsWith('.ppt') || name.endsWith('.pptx')) return '📑';
  if (type.startsWith('text/') || name.endsWith('.txt')) return '📄';
  return '📦';
}

/** Format an ISO date string into a friendly "Jan 8, 2025" string. */
function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ── File selection ──────────────────────────────────────────────────────────

function showError(msg) {
  uploadError.textContent = msg;
  uploadError.classList.remove('hidden');
}

function clearError() {
  uploadError.classList.add('hidden');
  uploadError.textContent = '';
}

function setSelectedFile(file) {
  if (!file) return;

  // Client-side size validation
  if (file.size > MAX_FILE_SIZE_BYTES) {
    showError(`File is too large (${formatBytes(file.size)}). Maximum allowed size is 50 MB.`);
    return;
  }

  clearError();
  selectedFile = file;

  // Show preview
  previewIcon.textContent = fileIcon(file);
  previewName.textContent = file.name;
  previewSize.textContent = formatBytes(file.size);
  filePreview.classList.remove('hidden');

  // Enable upload button
  uploadBtn.disabled = false;
}

function clearSelectedFile() {
  selectedFile = null;
  fileInput.value = '';
  filePreview.classList.add('hidden');
  uploadBtn.disabled = true;
  clearError();
}

// File input change
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setSelectedFile(fileInput.files[0]);
});

// Remove file button
removeFileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearSelectedFile();
});

// ── Drag & drop ─────────────────────────────────────────────────────────────

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setSelectedFile(file);
});

// ── Password toggle ─────────────────────────────────────────────────────────

pwToggle.addEventListener('click', () => {
  pwVisible = !pwVisible;
  pwGroup.classList.toggle('hidden', !pwVisible);
  pwToggleIcon.textContent = pwVisible ? '🔒' : '🔓';
  pwToggleText.textContent = pwVisible ? 'Remove password protection' : 'Add password protection';
  if (!pwVisible) passwordInput.value = '';
});

// ── Upload ──────────────────────────────────────────────────────────────────

uploadBtn.addEventListener('click', () => {
  if (!selectedFile) return;
  doUpload();
});

function setUploading(uploading) {
  uploadBtn.disabled = uploading;
  if (uploading) {
    uploadBtnIcon.textContent = '';
    uploadBtnText.textContent = 'Uploading…';
    progressSection.classList.remove('hidden');
  } else {
    uploadBtnIcon.textContent = '⬆️';
    uploadBtnText.textContent = 'Upload File';
    progressSection.classList.add('hidden');
  }
}

function updateProgress(pct) {
  progressBar.style.width = `${pct}%`;
  progressPct.textContent = `${pct}%`;
}

function doUpload() {
  clearError();
  setUploading(true);
  updateProgress(0);

  const formData = new FormData();
  formData.append('file', selectedFile);

  const password = passwordInput.value.trim();
  if (password) formData.append('password', password);

  const xhr = new XMLHttpRequest();

  // Progress event
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      updateProgress(Math.round((e.loaded / e.total) * 100));
    }
  });

  xhr.addEventListener('load', () => {
    setUploading(false);

    if (xhr.status === 201) {
      let data;
      try { data = JSON.parse(xhr.responseText); } catch {
        showError('Unexpected response from server.');
        return;
      }
      showResult(data);
    } else {
      let errMsg = 'Upload failed. Please try again.';
      try {
        const err = JSON.parse(xhr.responseText);
        if (err.error) errMsg = err.error;
      } catch { /* ignore */ }
      showError(errMsg);
    }
  });

  xhr.addEventListener('error', () => {
    setUploading(false);
    showError('Network error. Please check your connection and try again.');
  });

  xhr.addEventListener('timeout', () => {
    setUploading(false);
    showError('Upload timed out. Please try again.');
  });

  xhr.timeout = 300_000; // 5 minutes
  xhr.open('POST', '/api/upload');
  xhr.send(formData);
}

// ── Result display ──────────────────────────────────────────────────────────

function showResult(data) {
  // Populate metadata pills
  metaName.textContent     = data.original_filename;
  metaName.title           = data.original_filename;
  metaSize.textContent     = formatBytes(data.file_size);
  metaExpires.textContent  = formatDate(data.expires_at);
  metaProtected.textContent = data.is_password_protected ? '🔒 Password set' : '🔓 None';

  // Subtitle
  resultSubtitle.textContent = data.is_password_protected
    ? 'Share the link below — recipients will need the password.'
    : 'Share the link below with anyone.';

  // Full share URL (use current origin for accuracy)
  const shareUrl = `${window.location.origin}/download/${data.file_id}`;
  shareLink.value = shareUrl;

  // Switch view
  uploadSection.classList.add('hidden');
  resultSection.classList.remove('hidden');
}

// ── Copy to clipboard ───────────────────────────────────────────────────────

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    copyBtn.textContent = '✅ Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy';
      copyBtn.classList.remove('copied');
    }, 2500);
  } catch {
    // Fallback for older browsers
    shareLink.select();
    document.execCommand('copy');
  }
});

// Select all on click
shareLink.addEventListener('click', () => shareLink.select());

// ── Upload another ───────────────────────────────────────────────────────────

uploadAnotherBtn.addEventListener('click', () => {
  resultSection.classList.add('hidden');
  uploadSection.classList.remove('hidden');
  clearSelectedFile();
  passwordInput.value = '';
  pwVisible = false;
  pwGroup.classList.add('hidden');
  pwToggleIcon.textContent = '🔓';
  pwToggleText.textContent = 'Add password protection';
  updateProgress(0);
});
