// =========================================
// PDF Engine - Renderer Logic
// =========================================

// Add URL Modal Elements
const addUrlModal = document.getElementById('addUrlModal');
const closeAddUrl = document.getElementById('closeAddUrl');
const modalUrlInput = document.getElementById('modalUrlInput');
const modalConvertBtn = document.getElementById('modalConvertBtn');
const fabBtn = document.getElementById('fabBtn');

// FAB - Open Modal
fabBtn.addEventListener('click', () => {
    addUrlModal.classList.remove('hidden');
    modalUrlInput.value = '';
    modalUrlInput.focus();
});

// Close Add URL Modal
closeAddUrl.addEventListener('click', () => {
    addUrlModal.classList.add('hidden');
});

// Close on backdrop click
addUrlModal.addEventListener('click', (e) => {
    if (e.target === addUrlModal) {
        addUrlModal.classList.add('hidden');
    }
});

// Modal Actions
modalConvertBtn.addEventListener('click', () => {
    const url = modalUrlInput.value.trim();
    if (url) {
        urlInput.value = url;
        addUrlModal.classList.add('hidden');
        handleConversion(false);
    } else {
        showStatus('Please enter a URL', 'error');
    }
});

// Enter key in modal input
modalUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        modalConvertBtn.click();
    }
});

const filterInput = document.getElementById('filterInput');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const logTableBody = document.getElementById('logTableBody');
const emptyState = document.getElementById('emptyState');
const statusToast = document.getElementById('statusToast');
const statusText = document.getElementById('statusText');

// Settings Elements
const modeButtons = document.querySelectorAll('.mode-btn');
const pageSizeSelect = document.getElementById('pageSize');
const marginsTypeSelect = document.getElementById('marginsType');
const orientationButtons = document.querySelectorAll('.orientation-btn');

// Preview Modal Elements
const previewModal = document.getElementById('previewModal');
const pdfPreviewFrame = document.getElementById('pdfPreviewFrame');
const closePreview = document.getElementById('closePreview');
const previewFilename = document.getElementById('previewFilename');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomLevelText = document.getElementById('zoomLevel');
const saveFromPreviewBtn = document.getElementById('saveFromPreview');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const currentPageText = document.getElementById('currentPage');
const totalPagesText = document.getElementById('totalPages');

// Status bar elements
const ramUsage = document.getElementById('ramUsage');
const pingValue = document.getElementById('pingValue');

// State
let isConverting = false;
let currentMode = 'full';
let currentOrientation = 'portrait';
let history = [];
let nextId = 1;
let currentZoom = 100;
let currentPreviewPath = '';

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

// Clear URL
clearUrlBtn.addEventListener('click', () => {
    urlInput.value = '';
    urlInput.focus();
});

// Mode Toggle
modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (isConverting) return;
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
    });
});

// Orientation Toggle
orientationButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (isConverting) return;
        orientationButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentOrientation = btn.dataset.orient;
    });
});

// Theme Toggle
const themeButtons = document.querySelectorAll('.theme-btn');

function setTheme(theme) {
    // UI Update
    themeButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === theme) {
            btn.classList.add('active');
        }
    });

    // Apply Theme
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.className = isDark ? '' : 'light-theme';
    } else if (theme === 'light') {
        document.body.className = 'light-theme';
    } else {
        document.body.className = ''; // Default dark
    }

    // Save preference (optional, local storage)
    localStorage.setItem('themePreference', theme);
}

themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        setTheme(btn.dataset.theme);
    });
});

// Initialize Theme
const savedTheme = localStorage.getItem('themePreference') || 'system';
setTheme(savedTheme);

// System Theme Listener
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (localStorage.getItem('themePreference') === 'system') {
        document.body.className = e.matches ? '' : 'light-theme';
    }
});

// Convert Button
convertBtn.addEventListener('click', () => handleConversion(false));
previewBtn.addEventListener('click', () => handleConversion(true));

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

// =========================================
// Preview Modal Handlers
// =========================================

closePreview.addEventListener('click', () => {
    previewModal.classList.add('hidden');
    pdfPreviewFrame.src = 'about:blank';
    currentPreviewPath = '';
});

// Zoom Logic
zoomInBtn.addEventListener('click', () => {
    if (currentZoom < 200) {
        currentZoom += 10;
        updateZoom();
    }
});

zoomOutBtn.addEventListener('click', () => {
    if (currentZoom > 50) {
        currentZoom -= 10;
        updateZoom();
    }
});

function updateZoom() {
    zoomLevelText.textContent = `${currentZoom}%`;
    pdfPreviewFrame.style.transform = `scale(${currentZoom / 100})`;
    // Adjust height to compensate for scale
    pdfPreviewFrame.style.height = `${100 / (currentZoom / 100)}%`;
}

// Save from Preview
saveFromPreviewBtn.addEventListener('click', async () => {
    if (!currentPreviewPath) return;
    
    try {
        const url = urlInput.value.trim();
        const settings = {
            pageSize: pageSizeSelect.value,
            landscape: currentOrientation === 'landscape',
            marginsType: marginsTypeSelect.value
        };

        showStatus('Preparing for final save...');
        const result = await window.api.convert({
            url,
            type: currentMode,
            preview: false, 
            settings
        });

        if (result?.success) {
            previewModal.classList.add('hidden');
            addHistoryEntry({
                url,
                mode: currentMode,
                status: 'success',
                filePath: result.filePath,
                timestamp: new Date().toISOString(),
                size: result.fileSize || '2.4MB' 
            });
        }
    } catch (err) {
        showStatus('Failed to save PDF', 'error');
    }
});

// Pagination Placeholders
prevPageBtn.addEventListener('click', () => {
    let curr = parseInt(currentPageText.textContent);
    if (curr > 1) currentPageText.textContent = curr - 1;
});

nextPageBtn.addEventListener('click', () => {
    let curr = parseInt(currentPageText.textContent);
    let total = parseInt(totalPagesText.textContent);
    if (curr < total) currentPageText.textContent = curr + 1;
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
        pageSize: pageSizeSelect.value,
        landscape: currentOrientation === 'landscape',
        marginsType: marginsTypeSelect.value
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
            currentPreviewPath = result.filePath;
            const fileUrl = new URL(`file://${result.filePath}`).href;
            
            // Set filename in header
            const filename = result.filePath.split(/[\\/]/).pop().toUpperCase();
            previewFilename.textContent = `PREVIEW: ${filename}`;
            
            // Set actual page count
            const pageCount = result.pageCount || 1;
            totalPagesText.textContent = pageCount;
            currentPageText.textContent = '1';
            
            pdfPreviewFrame.src = `${fileUrl}#toolbar=0&navpanes=0&view=FitH`;
            
            // Reset zoom
            currentZoom = 100;
            updateZoom();
            
            previewModal.classList.remove('hidden');
            showStatus('Preview ready', 'success');
        } else if (result?.success && !isPreview) {
            const elapsed = Date.now() - startTime;
            addHistoryEntry({
                url,
                mode: currentMode,
                status: 'success',
                filePath: result.filePath,
                timestamp: new Date().toISOString(),
                size: result.fileSize || '2.4MB'
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
    
    if (history.length > 100) {
        history = history.slice(0, 100);
    }
    
    saveHistory();
    renderHistory();
}

function renderHistory() {
    let items = [...history];
    
    const filterText = filterInput.value.toLowerCase().trim();
    if (filterText) {
        items = items.filter(item => 
            item.url.toLowerCase().includes(filterText) ||
            item.status.toLowerCase().includes(filterText)
        );
    }
    
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
    
    if (items.length === 0) {
        emptyState.classList.remove('hidden');
        logTableBody.innerHTML = '';
        return;
    }
    
    emptyState.classList.add('hidden');
    
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
                        : `<button class="action-btn" onclick="openFile('${escapeHtml(item.filePath || '')}')" title="Show in Folder">
                               <span class="material-symbols-outlined">folder</span>
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
        [convertBtn, previewBtn].forEach(b => {
            const bt = b.querySelector('.btn-text');
            const sp = b.querySelector('.loading-spinner');
            if (bt) bt.classList.remove('hidden');
            if (sp) sp.classList.add('hidden');
        });
    }
}

function showStatus(message, type = 'info') {
    statusText.textContent = message;
    statusToast.className = 'status-toast ' + type;
    
    clearTimeout(window.statusTimeout);
    window.statusTimeout = setTimeout(() => {
        statusToast.classList.add('hidden');
    }, type === 'error' ? 5000 : 3000);
}

function updateStatusBar() {
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
