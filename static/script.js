// DOM Elements
const fileInput = document.getElementById('fileInput');
const pdfSelect = document.getElementById('pdfSelect');
const generateQuizBtn = document.getElementById('generateQuizBtn');
const newQuizBtn = document.getElementById('newQuizBtn');
const refreshPDFsBtn = document.getElementById('refreshPDFs');
const quizContainer = document.getElementById('quizContainer');
const pdfViewer = document.getElementById('pdfViewer');
const pdfCanvas = document.getElementById('pdfCanvas');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const toast = document.getElementById('toast');
const themeToggle = document.getElementById('themeToggle');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.querySelector('.progress-fill');
const navBtns = document.querySelectorAll('.nav-btn[data-view]');
const contentViews = document.querySelectorAll('.content-view');
const scoreModal = document.getElementById('scoreModal');
const closeModal = document.getElementById('closeModal');
const reviewAnswers = document.getElementById('reviewAnswers');
const tryAgain = document.getElementById('tryAgain');
const scoreContent = document.getElementById('scoreContent');
const attemptsList = document.getElementById('attemptsList');
const progressAttempts = document.getElementById('progressAttempts');
const progressAverage = document.getElementById('progressAverage');

// NEW: Video recommendation elements
const getVideoRecsBtn = document.getElementById('getVideoRecsBtn');
const videoModal = document.getElementById('videoModal');
const closeVideoModal = document.getElementById('closeVideoModal');
const closeVideoModalBtn = document.getElementById('closeVideoModalBtn');
const videoContent = document.getElementById('videoContent');

// State
let currentQuiz = null;
let currentPdfFile = null;

// Make currentPdfId globally accessible via window object
window.currentPdfId = null;

// Initialize
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    loadPDFs();
    setupEventListeners();
    checkTheme();
}

// Event Listeners
function setupEventListeners() {
    fileInput.addEventListener('change', handleFileUpload);
    pdfSelect.addEventListener('change', handlePdfSelect);
    generateQuizBtn.addEventListener('click', generateQuiz);
    newQuizBtn.addEventListener('click', generateQuiz);
    refreshPDFsBtn.addEventListener('click', () => {
        showToast('Refreshing PDF list...', 'info');
        loadPDFs();
    });
    themeToggle.addEventListener('click', toggleTheme);
    navBtns.forEach(btn => btn.addEventListener('click', (e) => switchView(e.currentTarget.dataset.view)));
    closeModal.addEventListener('click', () => scoreModal.classList.remove('active'));
    reviewAnswers.addEventListener('click', () => {
        scoreModal.classList.remove('active');
        quizContainer.scrollIntoView({ behavior: 'smooth' });
    });
    tryAgain.addEventListener('click', () => {
        scoreModal.classList.remove('active');
        newQuizBtn.click();
    });

    // NEW: Video recommendations event listeners
    getVideoRecsBtn.addEventListener('click', getYouTubeRecommendations);
    closeVideoModal.addEventListener('click', () => videoModal.classList.remove('active'));
    closeVideoModalBtn.addEventListener('click', () => videoModal.classList.remove('active'));

    const uploadArea = document.querySelector('.upload-area');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => uploadArea.classList.add('hover'));
    });
    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('hover'));
    });
    uploadArea.addEventListener('drop', e => {
      fileInput.files = e.dataTransfer.files;
      handleFileUpload({ target: fileInput });
    });
}

// Theme Management
function checkTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const newTheme = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    themeToggle.querySelector('i').className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// View Management
function switchView(viewName) {
    navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
    contentViews.forEach(view => view.classList.toggle('active', view.id === `${viewName}View`));
    if (viewName === 'progress') loadProgress();
}

// PDF Management
async function loadPDFs() {
    try {
        const response = await fetch('/api/pdfs');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch');

        pdfSelect.innerHTML = '<option value="">Choose a PDF...</option>';
        data.pdfs.forEach(pdf => {
            const option = document.createElement('option');
            option.value = pdf._id;
            option.textContent = pdf.filename;
            pdfSelect.appendChild(option);
        });
        document.getElementById('totalQuizzes').textContent = data.pdfs.length;
    } catch (error) {
        showToast(`Error loading PDFs: ${error.message}`, 'error');
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    currentPdfFile = file;
    const formData = new FormData();
    formData.append('file', file);

    uploadProgress.classList.add('active');
    try {
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Upload failed');

        showToast('PDF uploaded successfully!', 'success');
        await loadPDFs();
        pdfSelect.value = data.pdf_id;
        
        // Render the PDF immediately since we still have it in memory
        renderPdf(file);
        
        // Update state
        window.currentPdfId = data.pdf_id;
        const chatPdfContext = document.getElementById('chatPdfContext');
        if (chatPdfContext) {
            chatPdfContext.textContent = `Discussing: ${file.name}`;
        }
        generateQuizBtn.disabled = false;
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        uploadProgress.classList.remove('active');
        fileInput.value = '';
    }
}

async function handlePdfSelect() {
    const selectedOption = pdfSelect.options[pdfSelect.selectedIndex];
    window.currentPdfId = selectedOption.value;

    if (window.currentPdfId) {
        // Update chat context indicator
        const chatPdfContext = document.getElementById('chatPdfContext');
        if (chatPdfContext) {
            chatPdfContext.textContent = `Discussing: ${selectedOption.textContent}`;
        }
        
        // Check if we have the file in memory
        if (currentPdfFile && pdfSelect.options[pdfSelect.selectedIndex].textContent === currentPdfFile.name) {
            renderPdf(currentPdfFile);
        } else {
            // Can't re-render PDFs in serverless environment
            currentPdfFile = null;
            pdfCanvas.style.display = 'none';
            const placeholder = pdfViewer.querySelector('.pdf-placeholder');
            placeholder.style.display = 'flex';
            placeholder.querySelector('h3').textContent = "PDF Preview Not Available";
            placeholder.querySelector('p').textContent = "The PDF was processed successfully, but preview is only available for newly uploaded files in this deployment.";
        }
        
        generateQuizBtn.disabled = false;
    } else {
        currentPdfFile = null;
        window.currentPdfId = null;
        pdfCanvas.style.display = 'none';
        const placeholder = pdfViewer.querySelector('.pdf-placeholder');
        placeholder.style.display = 'flex';
        placeholder.querySelector('h3').textContent = "No PDF Selected";
        placeholder.querySelector('p').textContent = "Upload or select a PDF to view it here";
        generateQuizBtn.disabled = true;
        
        // Clear chat context
        const chatPdfContext = document.getElementById('chatPdfContext');
        if (chatPdfContext) {
            chatPdfContext.textContent = "No PDF Selected";
        }
    }
}

async function renderPdf(file) {
    const fileReader = new FileReader();
    fileReader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = pdfCanvas;
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        page.render({ canvasContext: context, viewport: viewport });
        
        canvas.style.display = 'block';
        pdfViewer.querySelector('.pdf-placeholder').style.display = 'none';
    };
    fileReader.readAsArrayBuffer(file);
}

// Quiz Lifecycle
async function generateQuiz() {
    if (!window.currentPdfId) { // Use window.currentPdfId
        showToast('Please select a PDF first.', 'warning');
        return;
    }
    showLoading('Crafting your custom quiz...');
    try {
        const response = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfId: window.currentPdfId }), // Use window.currentPdfId
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Quiz generation failed');

        currentQuiz = data;
        renderQuiz(data);
        showToast('Your quiz is ready!', 'success');
        generateQuizBtn.style.display = 'none';
        newQuizBtn.style.display = 'flex';
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderQuiz(quizData) {
    let questionCounter = 0;
    const renderQuestion = (type, question, options = []) => {
        questionCounter++;
        let optionsHtml = '';
        if (type === 'mcq') {
            optionsHtml = options.map((opt, i) => `
                <div class="option-item">
                    <input type="radio" id="q${questionCounter}_opt${i}" name="q${questionCounter}" value="${opt}">
                    <label for="q${questionCounter}_opt${i}">${opt}</label>
                </div>
            `).join('');
        } else {
            optionsHtml = `<textarea class="answer-input" name="q${questionCounter}" placeholder="Your answer here..."></textarea>`;
        }
        return `
            <div class="question-card" data-question-type="${type}">
                <div class="question-number">${questionCounter}</div>
                <p class="question-text">${question}</p>
                <div class="options-list">${optionsHtml}</div>
                <div class="feedback-card" style="display: none;"></div>
            </div>`;
    };

    const sections = [
        { title: 'Multiple Choice', type: 'mcq', questions: quizData.mcqs || [] },
        { title: 'Short Answer', type: 'saq', questions: quizData.saqs || [] },
        { title: 'Long Answer', type: 'laq', questions: quizData.laqs || [] },
    ];

    quizContainer.innerHTML = `
        <form id="quizForm" class="quiz-content">
            ${sections.map(section => section.questions.length ? `
                <div class="question-section">
                    <h3 class="section-title"><i class="fas fa-list-ul"></i>${section.title}</h3>
                    ${section.questions.map(q => renderQuestion(section.type, q.question, q.options)).join('')}
                </div>
            ` : '').join('')}
            <div class="quiz-actions">
                <button type="submit" class="btn btn-primary submit-quiz-btn">Submit Answers</button>
            </div>
        </form>`;
    document.getElementById('quizForm').addEventListener('submit', handleQuizSubmit);
}

async function handleQuizSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('.submit-quiz-btn');
    submitButton.disabled = true;
    
    const formData = new FormData(event.target);
    const userAnswers = {};
    formData.forEach((value, key) => {
        userAnswers[key] = value;
    });

    showLoading('Evaluating your answers...');
    try {
        const response = await fetch('/api/score-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pdfId: window.currentPdfId,
                quizQuestions: currentQuiz,
                userAnswers: userAnswers
            }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Scoring failed');

        displayScore(result);
        displayFeedback(result.questionFeedback);
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        submitButton.disabled = false;
    } finally {
        hideLoading();
    }
}

// Video Recommendations
async function getYouTubeRecommendations() {
    if (!window.currentPdfId) {
        showToast('Please select a PDF first.', 'warning');
        return;
    }

    showLoading('Finding relevant video recommendations...');
    try {
        const response = await fetch('/api/recommend-videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfId: window.currentPdfId }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get recommendations');

        displayVideoRecommendations(data.recommendations);
        videoModal.classList.add('active');
        showToast('Video recommendations loaded!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function displayVideoRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) {
        videoContent.innerHTML = `
            <div class="video-empty-state">
                <i class="fab fa-youtube"></i>
                <p>No recommendations available at this time.</p>
            </div>`;
        return;
    }

    const videoList = recommendations.map((video, index) => {
        let url = video.url;
        
        // SECURITY FIX: Validate YouTube URL
        if (!url || !url.startsWith("https://www.youtube.com/")) {
            console.warn("Invalid YouTube URL blocked:", url);
            url = "#";
        }
        
        return `
            <li class="video-item">
                <div class="video-number">${index + 1}</div>
                <div class="video-info">
                    <h4 class="video-title">${escapeHtml(video.title)}</h4>
                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="video-link">
                        <i class="fab fa-youtube"></i>
                        Watch on YouTube
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                </div>
            </li>
        `;
    }).join('');

    videoContent.innerHTML = `
        <div class="video-recommendations-intro">
            <p>Here are some relevant YouTube videos to help you learn more about the topics in your PDF:</p>
        </div>
        <ul class="video-list">${videoList}</ul>
        <div class="video-recommendations-footer">
            <div class="video-hint">
                <i class="fas fa-info-circle"></i>
                <span>These recommendations are generated based on the content of your selected PDF. Click any link to search YouTube for relevant educational videos.</span>
            </div>
        </div>
    `;
}

// Utility Functions
function showLoading(message) {
    loadingText.textContent = message || 'Loading...';
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.opacity = 1;
    }, 10);
    setTimeout(() => {
        toast.style.opacity = 0;
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 3000);
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}