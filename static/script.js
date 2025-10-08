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

// State
let currentQuiz = null;
let currentPdfFile = null;

// MODIFIED: 'currentPdfId' is now global to be accessible by chat-script.js
let currentPdfId = null;

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
        handlePdfSelect();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        uploadProgress.classList.remove('active');
        fileInput.value = '';
    }
}

async function handlePdfSelect() {
    const selectedOption = pdfSelect.options[pdfSelect.selectedIndex];
    currentPdfId = selectedOption.value; // This now updates the global variable

    if (currentPdfId) {
        if (currentPdfFile && pdfSelect.options[pdfSelect.selectedIndex].textContent === currentPdfFile.name) {
            renderPdf(currentPdfFile);
        } else {
            currentPdfFile = null;
            pdfCanvas.style.display = 'none';
            const placeholder = pdfViewer.querySelector('.pdf-placeholder');
            placeholder.style.display = 'flex';
            placeholder.querySelector('h3').textContent = "PDF Preview Not Available";
            placeholder.querySelector('p').textContent = "Re-upload the file to view it, or select a newly uploaded PDF.";
        }
        generateQuizBtn.disabled = false;
    } else {
        currentPdfFile = null;
        pdfCanvas.style.display = 'none';
        const placeholder = pdfViewer.querySelector('.pdf-placeholder');
        placeholder.style.display = 'flex';
        placeholder.querySelector('h3').textContent = "No PDF Selected";
        placeholder.querySelector('p').textContent = "Upload or select a PDF to view it here";
        generateQuizBtn.disabled = true;
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

// Quiz Lifecycle (rest of the functions remain the same)
async function generateQuiz() {
    if (!currentPdfId) {
        showToast('Please select a PDF first.', 'warning');
        return;
    }
    showLoading('Crafting your custom quiz...');
    try {
        const response = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfId: currentPdfId }),
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
                pdfId: currentPdfId,
                quizQuestions: currentQuiz,
                userAnswers: userAnswers
            }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Scoring failed');

        displayScore(result);
        displayFeedback(result.questionFeedback);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function displayScore(result) {
    scoreContent.innerHTML = `
        <div class="score-display">
            <div class="score-circle"><span class="score-percentage">${result.score}</span></div>
            <h3 class="score-message">Great Effort!</h3>
            <p class="score-details">${result.overallFeedback}</p>
        </div>`;
    scoreModal.classList.add('active');
}

function displayFeedback(feedbackData) {
    const questionCards = document.querySelectorAll('.question-card');
    feedbackData.forEach((fb, index) => {
        if (questionCards[index]) {
            const feedbackCard = questionCards[index].querySelector('.feedback-card');
            const isCorrect = fb.feedback.toLowerCase().includes('correct') || fb.feedback.toLowerCase().includes('good');
            feedbackCard.innerHTML = `
                <div class="feedback-header">
                    <span class="feedback-icon ${isCorrect ? 'correct' : 'incorrect'}">
                        <i class="fas ${isCorrect ? 'fa-check' : 'fa-times'}"></i>
                    </span>
                    <h4>Feedback</h4>
                </div>
                <p class="feedback-text">${fb.feedback}</p>
            `;
            feedbackCard.style.display = 'block';
        }
    });
    document.querySelectorAll('#quizForm input, #quizForm textarea, #quizForm button').forEach(el => el.disabled = true);
}


// Progress Tracking
async function loadProgress() {
    showLoading('Fetching your progress...');
    try {
        const response = await fetch('/api/progress');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch progress');

        renderProgress(data.attempts);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderProgress(attempts) {
    progressAttempts.textContent = attempts.length;
    if (attempts.length === 0) {
        attemptsList.innerHTML = '<p>No quiz attempts recorded yet.</p>';
        progressAverage.textContent = '0%';
        return;
    }

    const totalScore = attempts.reduce((acc, attempt) => acc + parseInt(attempt.score || '0'), 0);
    const avg = Math.round(totalScore / attempts.length);
    progressAverage.textContent = `${avg}%`;
    document.getElementById('avgScore').textContent = `${avg}%`;

    attemptsList.innerHTML = attempts.map(attempt => `
        <div class="attempt-item">
            <span class="attempt-date">${new Date(attempt.timestamp).toLocaleDateString()}</span>
            <span class="attempt-score">${attempt.score || 'N/A'}</span>
        </div>
    `).join('');
}


// UI Helpers
function showLoading(text) {
    loadingText.textContent = text;
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

function showToast(message, type = 'success') {
    const icon = toast.querySelector('.toast-icon');
    toast.querySelector('.toast-message').textContent = message;
    toast.className = `toast ${type}`;
    icon.className = `toast-icon fas ${type === 'success' ? 'fa-check-circle' : 'fa-times-circle'}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}