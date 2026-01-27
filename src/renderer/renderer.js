const urlInput = document.getElementById('urlInput');
const convertBtn = document.getElementById('convertBtn');
const btnText = convertBtn.querySelector('.btn-text');
const loadingSpinner = convertBtn.querySelector('.loading-spinner');
const statusMessage = document.getElementById('statusMessage');
const statusText = statusMessage.querySelector('.text');
const radioItems = document.querySelectorAll('.radio-item');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeModal = document.querySelector('.close-modal');

let isConverting = false;

// Helpers
function setLoading(loading) {
    isConverting = loading;
    convertBtn.disabled = loading;
    if (loading) {
        btnText.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
        statusMessage.classList.remove('hidden');
    } else {
        btnText.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
    }
}

function updateStatus(message, status = 'info') {
    statusText.textContent = message;
    statusMessage.classList.remove('hidden');
    // You could add different colors based on status (error = red, success = green)
    if (status === 'error') {
        statusText.style.color = '#ff7675';
    } else if (status === 'complete') {
        statusText.style.color = '#55efc4';
    } else {
        statusText.style.color = 'var(--text-muted)';
    }
}

// Event Listeners
radioItems.forEach(item => {
    item.addEventListener('click', () => {
        if (isConverting) return;
        // Remove active class from all
        radioItems.forEach(ri => ri.classList.remove('active'));
        // Add to clicked
        item.classList.add('active');
        item.querySelector('input').checked = true;
    });
});

convertBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
        updateStatus('Please enter a valid URL.', 'error');
        return;
    }

    // specific check for valid URL format could go here
    try {
        new URL(url);
    } catch {
        updateStatus('Invalid URL format. Include http:// or https://', 'error');
        return;
    }

    const type = document.querySelector('input[name="conversionType"]:checked').value;

    setLoading(true);
    updateStatus('Initializing conversion...');

    const result = await window.api.convert({ url, type });
    
    // Result handling is mostly done via onStatusUpdate events, 
    // but the final promise return can also be used if needed.
    // If we rely purely on events, we just listen below.
});

// IPC Listeners
window.api.onStatusUpdate((data) => {
    console.log('Status Update:', data);
    updateStatus(data.message, data.status);
    
    if (data.status === 'complete' || data.status === 'error' || data.status === 'cancelled') {
        setLoading(false);
        // If complete, maybe clear input?
        if (data.status === 'complete') {
            // urlInput.value = ''; 
        }
    }
});

// Modal
helpBtn.addEventListener('click', () => {
    helpModal.classList.remove('hidden');
});

closeModal.addEventListener('click', () => {
    helpModal.classList.add('hidden');
});

window.addEventListener('click', (e) => {
    if (e.target === helpModal) {
        helpModal.classList.add('hidden');
    }
});
