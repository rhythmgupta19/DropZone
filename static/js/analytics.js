/**
 * analytics.js — DropZone analytics dashboard logic.
 *
 * Responsibilities:
 *  - Fetch /api/analytics
 *  - Populate summary stat cards
 *  - Render Chart.js bar chart (top files by downloads)
 *  - Render Chart.js doughnut (file status breakdown)
 *  - Render recent uploads table
 */

'use strict';

// ── Utility helpers ──────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function isExpired(isoStr) {
  return new Date(isoStr) < new Date();
}

function truncate(str, maxLen = 28) {
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ── Chart.js global defaults (dark theme) ────────────────────────────────────

Chart.defaults.color          = 'rgba(255,255,255,0.55)';
Chart.defaults.borderColor    = 'rgba(255,255,255,0.08)';
Chart.defaults.font.family    = "'Inter', sans-serif";
Chart.defaults.font.size      = 12;

// ── Render functions ─────────────────────────────────────────────────────────

function renderStats(summary) {
  document.getElementById('stat-total').textContent     = summary.total_files.toLocaleString();
  document.getElementById('stat-active').textContent    = summary.active_files.toLocaleString();
  document.getElementById('stat-downloads').textContent = summary.total_downloads.toLocaleString();
  document.getElementById('stat-storage').textContent   = summary.total_size_mb.toLocaleString();
}

function renderBarChart(topFiles) {
  const chartWrap  = document.getElementById('chart-wrap');
  const chartEmpty = document.getElementById('chart-empty');

  if (!topFiles || topFiles.length === 0) {
    chartWrap.classList.add('hidden');
    chartEmpty.classList.remove('hidden');
    return;
  }

  const labels = topFiles.map(f => truncate(f.original_filename));
  const values = topFiles.map(f => f.download_count);

  new Chart(document.getElementById('downloadsChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Downloads',
        data: values,
        backgroundColor: 'rgba(108, 99, 255, 0.55)',
        borderColor:     'rgba(108, 99, 255, 0.9)',
        borderWidth:     1,
        borderRadius:    6,
        borderSkipped:   false,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const f = topFiles[items[0].dataIndex];
              return f.original_filename;
            },
            label: (item) => ` ${item.raw} download${item.raw !== 1 ? 's' : ''}`,
          },
        },
      },
      scales: {
        x: {
          grid:  { display: false },
          ticks: { maxRotation: 30, minRotation: 0 },
        },
        y: {
          beginAtZero: true,
          ticks:       { stepSize: 1, precision: 0 },
          grid:        { color: 'rgba(255,255,255,0.06)' },
        },
      },
    },
  });
}

function renderStatusChart(summary) {
  const { active_files, expired_files, deleted_files } = summary;

  new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: {
      labels: ['Active', 'Expired', 'Deleted'],
      datasets: [{
        data: [active_files, expired_files, deleted_files],
        backgroundColor: [
          'rgba(0, 230, 118, 0.65)',
          'rgba(255, 214, 0, 0.65)',
          'rgba(255, 82, 82, 0.65)',
        ],
        borderColor: [
          'rgba(0, 230, 118, 0.9)',
          'rgba(255, 214, 0, 0.9)',
          'rgba(255, 82, 82, 0.9)',
        ],
        borderWidth: 1,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      cutout:              '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding:    16,
            boxWidth:   12,
            boxHeight:  12,
            borderRadius: 4,
          },
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.label}: ${item.raw} file${item.raw !== 1 ? 's' : ''}`,
          },
        },
      },
    },
  });
}

function renderRecentTable(recentUploads) {
  const tbody      = document.getElementById('recent-tbody');
  const tableEmpty = document.getElementById('table-empty');
  const table      = document.getElementById('recent-table');

  if (!recentUploads || recentUploads.length === 0) {
    table.classList.add('hidden');
    tableEmpty.classList.remove('hidden');
    return;
  }

  tbody.innerHTML = recentUploads.map(f => {
    const expired    = isExpired(f.expires_at);
    const statusBadge = expired
      ? '<span class="badge badge-warning">Expired</span>'
      : '<span class="badge badge-success">Active</span>';

    const pwBadge = f.is_password_protected
      ? ' <span class="badge badge-info" title="Password protected">🔒</span>'
      : '';

    return `
      <tr>
        <td>
          <a href="/download/${f.file_id}"
             style="color:var(--text-primary);text-decoration:none;font-weight:500;"
             title="${f.original_filename}">
            ${truncate(f.original_filename, 32)}
          </a>${pwBadge}
        </td>
        <td>${formatBytes(f.file_size)}</td>
        <td>${f.download_count.toLocaleString()}</td>
        <td>${formatDate(f.created_at)}</td>
        <td>${formatDate(f.expires_at)}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

// ── Main init ────────────────────────────────────────────────────────────────

async function initDashboard() {
  try {
    const res = await fetch('/api/analytics');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    renderStats(data.summary);
    renderBarChart(data.top_files);
    renderStatusChart(data.summary);
    renderRecentTable(data.recent_uploads);

  } catch (err) {
    console.error('Analytics load error:', err);
    document.getElementById('loading-overlay').innerHTML = `
      <p style="color:var(--danger);">⚠️ Failed to load analytics. <a href="/analytics" style="color:var(--primary);">Refresh</a></p>
    `;
  }
}

initDashboard();
