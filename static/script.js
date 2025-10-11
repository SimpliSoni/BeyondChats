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

// FIXED: Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

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
    
    // FIXED: Load progress data when switching to progress tab
    if (viewName === 'progress') {
        loadProgress();
    }
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

    // FIXED: Validate file size (16MB limit)
    const maxSize = 16 * 1024 * 1024; // 16MB in bytes
    if (file.size > maxSize) {
        showToast('File too large. Maximum size is 16MB.', 'error');
        fileInput.value = '';
        return;
    }

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
        
        // FIXED: Update chat context properly
        updateChatContext(file.name);
        
        generateQuizBtn.disabled = false;
        
        // FIXED: Enable video recommendations button
        getVideoRecsBtn.disabled = false;
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        uploadProgress.classList.remove('active');
        fileInput.value = '';
    }
}

// FIXED: Complete rewrite of handlePdfSelect
async function handlePdfSelect() {
    const selectedOption = pdfSelect.options[pdfSelect.selectedIndex];
    window.currentPdfId = selectedOption.value;

    if (window.currentPdfId) {
        // FIXED: Update chat context properly
        updateChatContext(selectedOption.textContent);
        
        // FIXED: Always show placeholder for selected PDFs (serverless limitation)
        currentPdfFile = null;
        pdfCanvas.style.display = 'none';
        const placeholder = pdfViewer.querySelector('.pdf-placeholder');
        placeholder.style.display = 'flex';
        
        // Update placeholder text based on selection
        placeholder.querySelector('h3').textContent = selectedOption.textContent;
        placeholder.querySelector('p').textContent = "PDF processed successfully. Preview available for newly uploaded files only.";
        
        generateQuizBtn.disabled = false;
        getVideoRecsBtn.disabled = false;
    } else {
        currentPdfFile = null;
        window.currentPdfId = null;
        pdfCanvas.style.display = 'none';
        const placeholder = pdfViewer.querySelector('.pdf-placeholder');
        placeholder.style.display = 'flex';
        placeholder.querySelector('h3').textContent = "No PDF Selected";
        placeholder.querySelector('p').textContent = "Upload or select a PDF to view it here";
        generateQuizBtn.disabled = true;
        getVideoRecsBtn.disabled = true;
        
        // Clear chat context
        updateChatContext(null);
    }
}

// FIXED: New helper function to update chat context
function updateChatContext(pdfName) {
    const chatPdfContext = document.getElementById('chatPdfContext');
    if (chatPdfContext) {
        if (pdfName) {
            chatPdfContext.textContent = `Discussing: ${pdfName}`;
            chatPdfContext.style.display = 'inline-block';
        } else {
            chatPdfContext.textContent = "No PDF Selected";
            chatPdfContext.style.display = 'inline-block';
        }
    }
}

async function renderPdf(file) {
    try {
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1.5 });

                const canvas = pdfCanvas;
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;
                
                canvas.style.display = 'block';
                pdfViewer.querySelector('.pdf-placeholder').style.display = 'none';
            } catch (error) {
                console.error('Error rendering PDF:', error);
                showToast('Failed to render PDF preview', 'error');
            }
        };
        fileReader.onerror = () => {
            showToast('Failed to read PDF file', 'error');
        };
        fileReader.readAsArrayBuffer(file);
    } catch (error) {
        console.error('Error in renderPdf:', error);
        showToast('Failed to load PDF', 'error');
    }
}

// Quiz Lifecycle
async function generateQuiz() {
    if (!window.currentPdfId) {
        showToast('Please select a PDF first.', 'warning');
        return;
    }
    
    // FIXED: Show proper button states during generation
    const isNewQuiz = newQuizBtn.style.display !== 'none';
    if (isNewQuiz) {
        newQuizBtn.style.display = 'none';
    }
    generateQuizBtn.style.display = 'none';
    
    showLoading('Crafting your custom quiz...');
    try {
        const response = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfId: window.currentPdfId }),
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
        // FIXED: Restore button state on error
        if (isNewQuiz) {
            newQuizBtn.style.display = 'flex';
        } else {
            generateQuizBtn.style.display = 'flex';
        }
    } finally {
        hideLoading();
    }
}

// FIXED: Complete rewrite with validation
function renderQuiz(quizData) {
    // FIXED: Validate quiz has questions
    const totalQuestions = (quizData.mcqs?.length || 0) + 
                          (quizData.saqs?.length || 0) + 
                          (quizData.laqs?.length || 0);
    
    if (totalQuestions === 0) {
        quizContainer.innerHTML = `
            <div class="quiz-placeholder">
                <i class="fas fa-exclamation-triangle" style="color: var(--warning-color);"></i>
                <h3>Unable to Generate Quiz</h3>
                <p>Could not create questions from this PDF. Please try uploading a different document with more text content.</p>
                <div class="feature-list" style="margin-top: 1.5rem;">
                    <div class="feature-item"><i class="fas fa-lightbulb"></i>Try a textbook or study material</div>
                    <div class="feature-item"><i class="fas fa-lightbulb"></i>Ensure PDF has readable text</div>
                    <div class="feature-item"><i class="fas fa-lightbulb"></i>Upload a different chapter</div>
                </div>
            </div>`;
        generateQuizBtn.style.display = 'flex';
        newQuizBtn.style.display = 'none';
        return;
    }
    
    let questionCounter = 0;
    const renderQuestion = (type, question, options = []) => {
        questionCounter++;
        let optionsHtml = '';
        if (type === 'mcq') {
            optionsHtml = options.map((opt, i) => `
                <div class="option-item">
                    <input type="radio" id="q${questionCounter}_opt${i}" name="q${questionCounter}" value="${escapeHtml(opt)}" required>
                    <label for="q${questionCounter}_opt${i}">${escapeHtml(opt)}</label>
                </div>
            `).join('');
        } else {
            optionsHtml = `<textarea class="answer-input" name="q${questionCounter}" placeholder="Your answer here..." required></textarea>`;
        }
        return `
            <div class="question-card" data-question-type="${type}">
                <div class="question-number">${questionCounter}</div>
                <p class="question-text">${escapeHtml(question)}</p>
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
                <button type="submit" class="btn btn-primary submit-quiz-btn">
                    <i class="fas fa-paper-plane"></i> Submit Answers
                </button>
            </div>
        </form>`;
    document.getElementById('quizForm').addEventListener('submit', handleQuizSubmit);
    
    // FIXED: Scroll to quiz on mobile after generation
    setTimeout(() => {
        quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
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

    // FIXED: Validate all questions are answered
    const totalQuestions = (currentQuiz.mcqs?.length || 0) + 
                          (currentQuiz.saqs?.length || 0) + 
                          (currentQuiz.laqs?.length || 0);
    
    if (Object.keys(userAnswers).length < totalQuestions) {
        showToast('Please answer all questions before submitting.', 'warning');
        submitButton.disabled = false;
        return;
    }

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
        
        // FIXED: Update stats after quiz submission
        updateQuickStats();
        
        // FIXED: Scroll to top to show feedback on mobile
        setTimeout(() => {
            quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500);
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        submitButton.disabled = false;
    } finally {
        hideLoading();
    }
}

function displayScore(result) {
    scoreContent.innerHTML = `
        <div class="score-display">
            <div class="score-circle">
                <span class="score-percentage">${escapeHtml(result.score)}</span>
            </div>
            <h3 class="score-message">Great Effort!</h3>
            <p class="score-details">${escapeHtml(result.overallFeedback)}</p>
        </div>`;
    scoreModal.classList.add('active');
}

function displayFeedback(feedbackData) {
    if (!feedbackData || !Array.isArray(feedbackData)) {
        console.warn('No feedback data provided');
        return;
    }

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
                <p class="feedback-text">${escapeHtml(fb.feedback)}</p>
            `;
            feedbackCard.style.display = 'block';
        }
    });
    
    // Disable the form after feedback is displayed
    const quizForm = document.getElementById('quizForm');
    if (quizForm) {
        quizForm.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);
    }
}

// Video Recommendations
async function getYouTubeRecommendations() {
    if (!window.currentPdfId) {
        showToast('Please select a PDF first.', 'warning');
        return;
    }

    // FIXED: Better loading state for button
    const originalHTML = getVideoRecsBtn.innerHTML;
    getVideoRecsBtn.disabled = true;
    getVideoRecsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Videos...';

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
        // FIXED: Restore button state
        getVideoRecsBtn.disabled = false;
        getVideoRecsBtn.innerHTML = originalHTML;
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
        
        // ENHANCED SECURITY: Strict YouTube URL validation
        const isValidYouTubeUrl = url && 
            (url.startsWith("https://www.youtube.com/results?search_query=") || 
             url.startsWith("https://www.youtube.com/watch?v=") ||
             url.startsWith("https://youtu.be/"));
        
        if (!isValidYouTubeUrl) {
            console.warn("Invalid YouTube URL blocked:", url);
            url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(video.title || "educational video");
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

// FIXED: Progress Tab Implementation
async function loadProgress() {
    showLoading('Loading your progress...');
    try {
        const response = await fetch('/api/progress');
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to load progress');

        displayProgressData(data.attempts);
        updateQuickStats();
    } catch (error) {
        showToast(`Error loading progress: ${error.message}`, 'error');
        console.error('Progress loading error:', error);
    } finally {
        hideLoading();
    }
}

// FIXED: Better empty state with CTA
function displayProgressData(attempts) {
    if (!attempts || attempts.length === 0) {
        attemptsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <h3>Start Your Learning Journey</h3>
                <p>Complete your first quiz to track your progress and see detailed analytics!</p>
                <button class="btn btn-primary" onclick="document.querySelector('[data-view=quiz]').click()" style="margin-top: 1.5rem;">
                    <i class="fas fa-play-circle"></i> Take Your First Quiz
                </button>
            </div>`;
        
        progressAttempts.textContent = '0';
        progressAverage.textContent = '0%';
        const trendElement = document.getElementById('progressTrend');
        if (trendElement) {
            trendElement.textContent = '+0%';
            trendElement.style.color = 'var(--text-tertiary)';
        }
        return;
    }

    // Calculate statistics
    const totalAttempts = attempts.length;
    const scores = attempts.map(a => parseFloat(a.score) || 0);
    const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
    
    // Calculate trend (compare last 3 vs previous)
    let trend = 0;
    if (scores.length >= 4) {
        const recentAvg = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const previousAvg = scores.slice(3, 6).reduce((a, b) => a + b, 0) / Math.min(3, scores.length - 3);
        trend = (recentAvg - previousAvg).toFixed(1);
    }

    // Update stats
    progressAttempts.textContent = totalAttempts;
    progressAverage.textContent = `${avgScore}%`;
    const trendElement = document.getElementById('progressTrend');
    if (trendElement) {
        trendElement.textContent = `${trend >= 0 ? '+' : ''}${trend}%`;
        trendElement.style.color = trend >= 0 ? 'var(--success-color)' : 'var(--error-color)';
    }

    // Display attempts list
    attemptsList.innerHTML = attempts.map((attempt, index) => {
        const date = new Date(attempt.timestamp);
        const scoreValue = parseFloat(attempt.score) || 0;
        const scoreClass = scoreValue >= 80 ? 'excellent' : scoreValue >= 60 ? 'good' : 'needs-improvement';
        
        return `
            <div class="attempt-card">
                <div class="attempt-header">
                    <div class="attempt-number">#${totalAttempts - index}</div>
                    <div class="attempt-score ${scoreClass}">
                        <i class="fas fa-star"></i>
                        ${escapeHtml(attempt.score)}
                    </div>
                </div>
                <div class="attempt-body">
                    <div class="attempt-date">
                        <i class="fas fa-calendar"></i>
                        ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        <span class="attempt-time">${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                    ${attempt.feedback ? `
                        <div class="attempt-feedback">
                            <i class="fas fa-comment-dots"></i>
                            <p>${escapeHtml(attempt.feedback.substring(0, 100))}${attempt.feedback.length > 100 ? '...' : ''}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// FIXED: Update quick stats in sidebar
async function updateQuickStats() {
    try {
        const response = await fetch('/api/progress');
        const data = await response.json();
        
        if (response.ok && data.attempts) {
            const scores = data.attempts.map(a => parseFloat(a.score) || 0);
            const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(0) : 0;
            
            const avgScoreEl = document.getElementById('avgScore');
            if (avgScoreEl) {
                avgScoreEl.textContent = `${avgScore}%`;
                // FIXED: Add subtle animation
                avgScoreEl.parentElement.style.animation = 'none';
                setTimeout(() => {
                    avgScoreEl.parentElement.style.animation = 'fadeIn 0.5s ease';
                }, 10);
            }
        }
    } catch (error) {
        console.error('Error updating quick stats:', error);
    }
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

// ENHANCED: Proper HTML escaping to prevent XSS
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
}