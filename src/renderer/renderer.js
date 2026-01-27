const urlInput = document.getElementById('urlInput');
const convertBtn = document.getElementById('convertBtn');
const previewBtn = document.getElementById('previewBtn');
const btnText = convertBtn.querySelector('.btn-text');
const previewBtnText = previewBtn.querySelector('.btn-text');
const loadingSpinner = convertBtn.querySelector('.loading-spinner');
const previewSpinner = previewBtn.querySelector('.loading-spinner');
const statusMessage = document.getElementById('statusMessage');
const statusText = statusMessage.querySelector('.text');
const radioItems = document.querySelectorAll('.radio-item');

// Settings Elements
const toggleSettings = document.getElementById('toggleSettings');
const settingsPanel = document.getElementById('settingsPanel');
const pageSizeInput = document.getElementById('pageSize');
const orientationInput = document.getElementById('orientation');
const marginsInput = document.getElementById('margins');

// Preview Elements
const previewContainer = document.getElementById('previewContainer');
const pdfPreviewFrame = document.getElementById('pdfPreviewFrame');
const closePreview = document.getElementById('closePreview');

// Recent URLs
const recentList = document.getElementById('recentList');

// State
let isConverting = false;

// Initialize
loadRecent();

// Helpers
function setLoading(loading, isPreview = false) {
    isConverting = loading;
    convertBtn.disabled = loading;
    previewBtn.disabled = loading;
    
    if (loading) {
        statusMessage.classList.remove('hidden');
        if (isPreview) {
            previewBtnText.classList.add('hidden');
            previewSpinner.classList.remove('hidden');
        } else {
            btnText.classList.add('hidden');
            loadingSpinner.classList.remove('hidden');
        }
    } else {
        btnText.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        previewBtnText.classList.remove('hidden');
        previewSpinner.classList.add('hidden');
    }
}

function updateStatus(message, status = 'info') {
    statusText.textContent = message;
    statusMessage.classList.remove('hidden');
    if (status === 'error') {
        statusText.style.color = '#ff7675';
    } else if (status === 'complete') {
        statusText.style.color = '#55efc4';
    } else {
        statusText.style.color = 'var(--text-muted)';
    }
}

function getSettings() {
    return {
        pageSize: pageSizeInput.value,
        landscape: orientationInput.value === 'landscape',
        marginsType: marginsInput.value // 'default', 'none', 'minimum'
    };
}

// Recent URLs Logic
function loadRecent() {
    const recent = JSON.parse(localStorage.getItem('recentUrls') || '[]');
    recentList.innerHTML = '';
    
    if (recent.length === 0) {
        recentList.innerHTML = '<li class="recent-item" style="justify-content:center; color: var(--text-muted);">No recent history</li>';
        return;
    }

    recent.forEach(item => {
        const li = document.createElement('li');
        li.className = 'recent-item';
        li.innerHTML = `
            <span class="recent-url" title="${item.url}">${item.url}</span>
            <span class="recent-date">${new Date(item.date).toLocaleDateString()}</span>
        `;
        li.addEventListener('click', () => {
            urlInput.value = item.url;
        });
        recentList.appendChild(li);
    });
}

function saveRecent(url) {
    let recent = JSON.parse(localStorage.getItem('recentUrls') || '[]');
    // Remove if exists (to move to top)
    recent = recent.filter(r => r.url !== url);
    // Add to top
    recent.unshift({ url, date: new Date().toISOString() });
    // Limit to 10
    if (recent.length > 10) recent.pop();
    
    localStorage.setItem('recentUrls', JSON.stringify(recent));
    loadRecent();
}

const clearUrlBtn = document.getElementById('clearUrlBtn');

// ... existing code ...

// Clear Button Logic
function updateClearBtn() {
    if (urlInput.value.length > 0) {
        clearUrlBtn.classList.remove('hidden');
    } else {
        clearUrlBtn.classList.add('hidden');
    }
}

urlInput.addEventListener('input', updateClearBtn);

clearUrlBtn.addEventListener('click', () => {
    urlInput.value = '';
    urlInput.focus();
    updateClearBtn();
});

// Event Listeners
toggleSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
    toggleSettings.classList.toggle('open');
});

radioItems.forEach(item => {
    item.addEventListener('click', () => {
        if (isConverting) return;
        radioItems.forEach(ri => ri.classList.remove('active'));
        item.classList.add('active');
        item.querySelector('input').checked = true;
    });
});

async function handleConversion(isPreview = false) {
    const url = urlInput.value.trim();
    if (!url) {
        updateStatus('Please enter a valid URL.', 'error');
        return;
    }
    try {
        new URL(url);
    } catch {
        updateStatus('Invalid URL format.', 'error');
        return;
    }

    const type = document.querySelector('input[name="conversionType"]:checked').value;
    const settings = getSettings();

    setLoading(true, isPreview);
    updateStatus(isPreview ? 'Generating preview...' : 'Initializing download...');
    
    // Save to history
    saveRecent(url);

    try {
        const result = await window.api.convert({ 
            url, 
            type, 
            preview: isPreview,
            settings 
        });

        if (isPreview && result && result.success && result.filePath) {
            // Show preview
            // Use 'file:' protocol properly handles spaces/characters
            const fileUrl = new URL(`file://${result.filePath}`).href;
            pdfPreviewFrame.src = `${fileUrl}#toolbar=0&view=FitH`;
            previewContainer.classList.remove('hidden');
            updateStatus('Preview generated.', 'complete');
        } 
    } catch (err) {
        console.error(err);
    }
}

convertBtn.addEventListener('click', () => handleConversion(false));
previewBtn.addEventListener('click', () => handleConversion(true));

// Preview Modal
closePreview.addEventListener('click', () => {
    previewContainer.classList.add('hidden');
    pdfPreviewFrame.src = 'about:blank'; // Clear memory
});

// Help Modal (Existing code)
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeModal = document.querySelector('.close-modal');

helpBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
closeModal.addEventListener('click', () => helpModal.classList.add('hidden'));
window.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.add('hidden');
    if (e.target === previewContainer) previewContainer.classList.add('hidden');
});

// IPC Listeners
window.api.onStatusUpdate((data) => {
    console.log('Status Update:', data);
    updateStatus(data.message, data.status);
    
    if (data.status === 'complete' || data.status === 'error' || data.status === 'cancelled') {
        const isPreview = statusText.textContent.includes('Preview'); // Hacky but works for now to turn off correct spinner
        // Actually simplest is to turn off both
        setLoading(false, true); 
        setLoading(false, false);
    }
});
