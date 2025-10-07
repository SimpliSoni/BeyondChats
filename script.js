// DOM Elements
const fileInput = document.getElementById('fileInput');
const pdfSelect = document.getElementById('pdfSelect');
const generateQuizBtn = document.getElementById('generateQuizBtn');
const newQuizBtn = document.getElementById('newQuizBtn');
const refreshPDFsBtn = document.getElementById('refreshPDFs');
const quizContainer = document.getElementById('quizContainer');
const pdfViewer = document.getElementById('pdfViewer');
const pdfFrame = document.getElementById('pdfFrame');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const toast = document.getElementById('toast');
const themeToggle = document.getElementById('themeToggle');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.querySelector('.progress-fill');

// Navigation
const navBtns = document.querySelectorAll('.nav-btn[data-view]');
const contentViews = document.querySelectorAll('.content-view');

// Modal
const scoreModal = document.getElementById('scoreModal');
const closeModal = document.getElementById('closeModal');
const reviewAnswers = document.getElementById('reviewAnswers');
const tryAgain = document.getElementById('tryAgain');

// State
let currentQuiz = null;
let currentPdfId = null;
let userAnswers = {};

// API Base URL - Update this for production
const API_BASE_URL = window.location.origin;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    loadPDFs();
    setupEventListeners();
    checkTheme();
    updateStats();
}

// Event Listeners
function setupEventListeners() {
    // File upload
    fileInput.addEventListener('change', handleFileUpload);
    
    // PDF selection
    pdfSelect.addEventListener('change', handlePdfSelect);
    
    // Quiz generation
    generateQuizBtn.addEventListener('click', generateQuiz);
    newQuizBtn.addEventListener('click', generateQuiz);
    
    // Refresh PDFs
    refreshPDFsBtn.addEventListener('click', loadPDFs);
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // Navigation
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });
    
    // Modal
    closeModal.addEventListener('click', () => {
        scoreModal.classList.remove('active');
    });
    
    reviewAnswers.addEventListener('click', () => {
        scoreModal.classList.remove('active');
        // Scroll to quiz container
        quizContainer.scrollIntoView({ behavior: 'smooth' });
    });
    
    tryAgain.addEventListener('click', () => {
        scoreModal.classList.remove('active');
        generateQuiz();
    });
    
    // Upload area drag and drop
    const uploadArea = document.querySelector('.upload-area');
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary-color)';
        uploadArea.style.background = 'var(--primary-light)';
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';
        uploadArea.style.background = '';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';
        uploadArea.style.background = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileUpload({ target: fileInput });
        }
    });
}

// Theme Management
function checkTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// View Management
function switchView(viewName) {
    // Update nav buttons
    navBtns.forEach(btn => {
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update content views
    contentViews.forEach(view => {
        if (view.id === `${viewName}View`) {
            view.classList.add('active');
            if (viewName === 'progress') {
                loadProgress();
            }
        } else {
            view.classList.remove('active');
        }
    });
}

// PDF Management
async function loadPDFs() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/pdfs`);
        const data = await response.json();
        
        if (response.ok) {
            updatePdfSelect(data.pdfs);
            showToast('PDFs loaded successfully', 'success');
        } else {
            showToast(data.error || 'Failed to load PDFs', 'error');
        }
    } catch (error) {
        console.error('Error loading PDFs:', error);
        showToast('Failed to load PDFs', 'error');
    }
}

function updatePdfSelect(pdfs) {
    pdfSelect.innerHTML = '<option value="">Choose a PDF...</option>';
    
    pdfs.forEach(pdf => {
        const option = document.createElement('option');
        option.value = pdf._id;
        option.textContent = pdf.filename;
        pdfSelect.appendChild(option);
    });
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Please select a PDF file', 'error');
        return;
    }
    
    if (file.size > 16 * 1024 * 1024) {
        showToast('File size must be less than 16MB', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Show upload progress
    uploadProgress.classList.add('active');
    progressFill.style.width = '0%';
    
    // Simulate progress (since we can't track actual upload progress with fetch)
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 10;
        if (progress <= 90) {
            progressFill.style.width = `${progress}%`;
        }
    }, 100);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('PDF uploaded successfully', 'success');
            await loadPDFs();
            
            // Auto-select the uploaded PDF
            pdfSelect.value = data.pdf_id;
            handlePdfSelect();
            
            // Reset file input
            fileInput.value = '';
        } else {
            showToast(data.error || 'Upload failed', 'error');
        }
    } catch (error) {
        clearInterval(progressInterval);
        console.error('Error uploading file:', error);
        showToast('Upload failed', 'error');
    } finally {
        setTimeout(() => {
            uploadProgress.classList.remove('active');
            progressFill.style.width = '0%';
        }, 1000);
    }
}

function handlePdfSelect() {
    const selectedPdfId = pdfSelect.value;
    
    if (selectedPdfId) {
        currentPdfId = selectedPdfId;
        // Display PDF in viewer
        displayPdf(selectedPdfId);
        generateQuizBtn.disabled = false;
    } else {
        currentPdfId = null;
        hidePdf();
        generateQuizBtn.disabled = true;
    }
}

function displayPdf(pdfId) {
    // For simplicity, we'll display the PDF using an iframe
    // In production, you might want to use a library like PDF.js
    const pdfPath = `/uploads/${pdfId}.pdf`; // Adjust based on your backend
    
    pdfFrame.src = pdfPath;
    pdfFrame.style.display = 'block';
    pdfViewer.querySelector('.pdf-placeholder').style.display = 'none';
}

function hidePdf() {
    pdfFrame.src = '';
    pdfFrame.style.display = 'none';
    pdfViewer.querySelector('.pdf-placeholder').style.display = 'flex';
}

// Quiz Generation
async function generateQuiz() {
    if (!currentPdfId) {
        showToast('Please select a PDF first', 'error');
        return;
    }
    
    showLoading('Generating your quiz...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/generate-quiz`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pdf_id: currentPdfId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentQuiz = data;
            renderQuiz(data);
            generateQuizBtn.style.display = 'none';
            newQuizBtn.style.display = 'block';
            showToast('Quiz generated successfully', 'success');
        } else {
            showTo