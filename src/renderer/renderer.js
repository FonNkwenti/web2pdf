// =========================================
// PDF Engine - Renderer Logic
// =========================================

// DOM Elements
const urlInput = document.getElementById('urlInput');
const convertBtn = document.getElementById('convertBtn');
const previewBtn = document.getElementById('previewBtn');
const fabBtn = document.getElementById('fabBtn');
const modeButtons = document.querySelectorAll('.mode-btn');
const sortSelect = document.getElementById('sortSelect');
const filterInput = document.getElementById('filterInput');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const logTableBody = document.getElementById('logTableBody');
const emptyState = document.getElementById('emptyState');
const previewModal = document.getElementById('previewModal');
const pdfPreviewFrame = document.getElementById('pdfPreviewFrame');
const closePreview = document.getElementById('closePreview');
const statusToast = document.getElementById('statusToast');
const statusText = document.getElementById('statusText');

// Checkbox elements
const jsRuntimeCheck = document.getElementById('jsRuntime');
const loadAssetsCheck = document.getElementById('loadAssets');
const cookiesCheck = document.getElementById('cookies');
const noCacheCheck = document.getElementById('noCache');

// Status bar elements
const ramUsage = document.getElementById('ramUsage');
const pingValue = document.getElementById('pingValue');

// State
let isConverting = false;
let currentMode = 'full';
let history = [];
let nextId = 1;

// =========================================
// Initialization
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    renderHistory();
    updateStatusBar();
    setInterval(updateStatusBar, 5000);
});

// =========================================
// Event Listeners
// =========================================

// Mode Toggle
modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (isConverting) return;
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
    });
});

// Convert Button
convertBtn.addEventListener('click', () => handleConversion(false));
previewBtn.addEventListener('click', () => handleConversion(true));

// FAB - Focus URL input
fabBtn.addEventListener('click', () => {
    urlInput.focus();
    urlInput.scrollIntoView({ behavior: 'smooth' });
});

// Filter input
filterInput.addEventListener('input', () => {
    renderHistory();
});

// Sort select
sortSelect.addEventListener('change', () => {
    renderHistory();
});

// Clear logs
clearLogsBtn.addEventListener('click', () => {
    if (history.length === 0) return;
    if (confirm('Clear all conversion history?')) {
        history = [];
        nextId = 1;
        saveHistory();
        renderHistory();
    }
});

// Preview modal
closePreview.addEventListener('click', () => {
    previewModal.classList.add('hidden');
    pdfPreviewFrame.src = 'about:blank';
});

previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
        previewModal.classList.add('hidden');
        pdfPreviewFrame.src = 'about:blank';
    }
});

// =========================================
// Conversion Logic
// =========================================

async function handleConversion(isPreview = false) {
    const url = urlInput.value.trim();
    
    if (!url) {
        showStatus('Please enter a valid URL.', 'error');
        urlInput.focus();
        return;
    }
    
    try {
        new URL(url);
    } catch {
        showStatus('Invalid URL format. Include https://', 'error');
        return;
    }

    const settings = {
        pageSize: 'A4',
        landscape: false,
        marginsType: 'default'
    };

    setLoading(true, isPreview);
    showStatus(isPreview ? 'Generating preview...' : 'Loading page...');

    const startTime = Date.now();

    try {
        const result = await window.api.convert({
            url,
            type: currentMode,
            preview: isPreview,
            settings
        });

        if (isPreview && result?.success && result.filePath) {
            const fileUrl = new URL(`file://${result.filePath}`).href;
            pdfPreviewFrame.src = `${fileUrl}#toolbar=0&view=FitH`;
            previewModal.classList.remove('hidden');
            showStatus('Preview ready', 'success');
        } else if (result?.success && !isPreview) {
            // Add to history on successful conversion
            const elapsed = Date.now() - startTime;
            addHistoryEntry({
                url,
                mode: currentMode,
                status: 'success',
                filePath: result.filePath,
                timestamp: new Date().toISOString(),
                size: result.fileSize || null
            });
        }
    } catch (err) {
        console.error('Conversion error:', err);
        if (!isPreview) {
            addHistoryEntry({
                url,
                mode: currentMode,
                status: 'failed',
                timestamp: new Date().toISOString()
            });
        }
    } finally {
        setLoading(false);
    }
}

// =========================================
// History Management
// =========================================

function loadHistory() {
    try {
        const saved = localStorage.getItem('pdfEngineHistory');
        if (saved) {
            const data = JSON.parse(saved);
            history = data.history || [];
            nextId = data.nextId || 1;
        }
    } catch (e) {
        console.error('Failed to load history:', e);
        history = [];
        nextId = 1;
    }
}

function saveHistory() {
    try {
        localStorage.setItem('pdfEngineHistory', JSON.stringify({
            history,
            nextId
        }));
    } catch (e) {
        console.error('Failed to save history:', e);
    }
}

function addHistoryEntry(entry) {
    const id = nextId++;
    history.unshift({
        id: String(id).padStart(3, '0'),
        ...entry
    });
    
    // Keep only last 100 entries
    if (history.length > 100) {
        history = history.slice(0, 100);
    }
    
    saveHistory();
    renderHistory();
}

function renderHistory() {
    let items = [...history];
    
    // Filter
    const filterText = filterInput.value.toLowerCase().trim();
    if (filterText) {
        items = items.filter(item => 
            item.url.toLowerCase().includes(filterText) ||
            item.status.toLowerCase().includes(filterText)
        );
    }
    
    // Sort
    const sortValue = sortSelect.value;
    items.sort((a, b) => {
        switch (sortValue) {
            case 'timestamp-asc':
                return new Date(a.timestamp) - new Date(b.timestamp);
            case 'size':
                return (parseSize(b.size) || 0) - (parseSize(a.size) || 0);
            case 'status':
                return a.status.localeCompare(b.status);
            default: // timestamp-desc
                return new Date(b.timestamp) - new Date(a.timestamp);
        }
    });
    
    // Update empty state
    if (items.length === 0) {
        emptyState.classList.remove('hidden');
        logTableBody.innerHTML = '';
        return;
    }
    
    emptyState.classList.add('hidden');
    
    // Render table rows
    logTableBody.innerHTML = items.map(item => {
        const date = new Date(item.timestamp);
        const dateStr = formatDate(date);
        const timeStr = formatTime(date);
        const isFailed = item.status === 'failed';
        const favicon = getFaviconUrl(item.url);
        
        return `
            <tr>
                <td class="cell-id">#${item.id}</td>
                <td class="cell-timestamp">${dateStr} ${timeStr}</td>
                <td>
                    <div class="cell-url">
                        ${isFailed 
                            ? '<span class="material-symbols-outlined" style="font-size:14px;color:#52525b;">public_off</span>'
                            : `<img src="${favicon}" alt="" onerror="this.style.display='none'">`
                        }
                        <span class="url-text ${isFailed ? 'failed' : ''}" title="${item.url}">${truncateUrl(item.url)}</span>
                    </div>
                </td>
                <td class="cell-mode">
                    <span class="mode-badge">${item.mode === 'full' ? 'FULL' : 'TEXT'}</span>
                </td>
                <td class="cell-size">${item.size || '--'}</td>
                <td class="cell-res">${item.status === 'success' ? '1080p' : '--'}</td>
                <td>
                    <span class="status-badge ${item.status}">
                        <span class="dot"></span>
                        ${item.status.toUpperCase()}
                    </span>
                </td>
                <td class="cell-actions">
                    ${isFailed 
                        ? `<button class="action-btn retry" onclick="retryConversion('${escapeHtml(item.url)}')" title="Retry">
                               <span class="material-symbols-outlined">refresh</span>
                           </button>`
                        : `<button class="action-btn" onclick="openFile('${escapeHtml(item.filePath || '')}')" title="Open">
                               <span class="material-symbols-outlined">open_in_new</span>
                           </button>`
                    }
                </td>
            </tr>
        `;
    }).join('');
}

// =========================================
// UI Helpers
// =========================================

function setLoading(loading, isPreview = false) {
    isConverting = loading;
    convertBtn.disabled = loading;
    previewBtn.disabled = loading;
    
    const btn = isPreview ? previewBtn : convertBtn;
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.loading-spinner');
    
    if (loading) {
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
    } else {
        // Reset both buttons
        [convertBtn, previewBtn].forEach(b => {
            b.querySelector('.btn-text').classList.remove('hidden');
            b.querySelector('.loading-spinner').classList.add('hidden');
        });
    }
}

function showStatus(message, type = 'info') {
    statusText.textContent = message;
    statusToast.className = 'status-toast ' + type;
    
    // Auto-hide after delay
    clearTimeout(window.statusTimeout);
    window.statusTimeout = setTimeout(() => {
        statusToast.classList.add('hidden');
    }, type === 'error' ? 5000 : 3000);
}

function updateStatusBar() {
    // Simulated values - in a real app these would come from the main process
    const ram = Math.floor(Math.random() * 200 + 300);
    const ping = Math.floor(Math.random() * 30 + 20);
    
    ramUsage.textContent = `${ram}MB`;
    pingValue.textContent = `${ping}ms`;
}

// =========================================
// Utility Functions
// =========================================

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function truncateUrl(url) {
    try {
        const parsed = new URL(url);
        const path = parsed.pathname + parsed.search;
        const maxLen = 50;
        if (path.length > maxLen) {
            return parsed.host + path.substring(0, maxLen) + '...';
        }
        return parsed.host + path;
    } catch {
        return url.length > 60 ? url.substring(0, 60) + '...' : url;
    }
}

function getFaviconUrl(url) {
    try {
        const parsed = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${parsed.host}&sz=32`;
    } catch {
        return '';
    }
}

function parseSize(sizeStr) {
    if (!sizeStr || sizeStr === '--') return 0;
    const match = sizeStr.match(/^([\d.]+)\s*(KB|MB|GB)?$/i);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();
    const multipliers = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    return num * (multipliers[unit] || 1);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

// Global functions for onclick handlers
window.retryConversion = function(url) {
    urlInput.value = url;
    handleConversion(false);
};

window.openFile = function(filePath) {
    if (filePath && window.api?.openPath) {
        window.api.openPath(filePath);
    }
};

// =========================================
// IPC Listeners
// =========================================

if (window.api?.onStatusUpdate) {
    window.api.onStatusUpdate((data) => {
        console.log('Status Update:', data);
        showStatus(data.message, data.status);
        
        if (['complete', 'error', 'cancelled'].includes(data.status)) {
            setLoading(false);
        }
    });
}
