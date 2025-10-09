// ============================================
// MASTER SCRIPT - Handles all frontend logic
// ============================================

// Make currentPdfId globally accessible
window.currentPdfId = null;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Configure PDF.js worker
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
    }
    
    // Initialize both main app and chat features
    initializeApp();
    initializeChatInterface();
});


// ============================================
//
//          MAIN APP LOGIC
//
// ============================================

// --- DOM ELEMENTS (Main App) ---
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
const avgScore = document.getElementById('avgScore');
const totalPdfs = document.getElementById('totalPdfs');
const getVideoRecsBtn = document.getElementById('getVideoRecsBtn');
const videoModal = document.getElementById('videoModal');
const closeVideoModal = document.getElementById('closeVideoModal');
const closeVideoModalBtn = document.getElementById('closeVideoModalBtn');
const videoContent = document.getElementById('videoContent');

// --- STATE (Main App) ---
let currentQuiz = null;
let currentPdfFile = null;

// --- INITIALIZER (Main App) ---
function initializeApp() {
    loadPDFs();
    setupMainEventListeners();
    checkTheme();
    loadProgress(); // Load progress on initial page load
}

// --- EVENT LISTENERS (Main App) ---
function setupMainEventListeners() {
    fileInput.addEventListener('change', handleFileUpload);
    pdfSelect.addEventListener('change', handlePdfSelect);
    generateQuizBtn.addEventListener('click', generateQuiz);
    newQuizBtn.addEventListener('click', () => {
        quizContainer.innerHTML = ''; // Clear old quiz
        generateQuiz();
    });
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

// --- THEME MANAGEMENT ---
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

// --- VIEW MANAGEMENT ---
function switchView(viewName) {
    navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
    contentViews.forEach(view => view.classList.toggle('active', view.id === `${viewName}View`));
    
    // Load progress data when switching to progress view
    if (viewName === 'progress') {
        loadProgress();
    }
    
    // Reinitialize chat welcome when switching to chat view
    if (viewName === 'chat' && !chatState.currentChatId) {
        showWelcomeScreen();
    }
}


// --- PDF MANAGEMENT ---
async function loadPDFs() {
    try {
        const response = await fetch('/api/pdfs');
        if (!response.ok) throw new Error('Failed to fetch PDFs');
        const data = await response.json();
        
        pdfSelect.innerHTML = '<option value="">Choose a PDF...</option>';
        data.pdfs.forEach(pdf => {
            const option = document.createElement('option');
            option.value = pdf._id;
            option.textContent = pdf.filename;
            pdfSelect.appendChild(option);
        });
        totalPdfs.textContent = data.pdfs.length;
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
        
        // Manually trigger the change event to update the UI
        handlePdfSelect();
        
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        uploadProgress.classList.remove('active');
        fileInput.value = ''; // Reset for next upload
    }
}

async function handlePdfSelect() {
    const selectedOption = pdfSelect.options[pdfSelect.selectedIndex];
    window.currentPdfId = selectedOption.value;
    const hasPdf = !!window.currentPdfId;

    generateQuizBtn.disabled = !hasPdf;
    getVideoRecsBtn.disabled = !hasPdf;
    
    const chatPdfContext = document.getElementById('chatPdfContext');

    if (hasPdf) {
        chatPdfContext.textContent = `Discussing: ${selectedOption.textContent}`;
        // Only try to render if it's the file we just uploaded
        if (currentPdfFile && selectedOption.textContent === currentPdfFile.name) {
            renderPdf(currentPdfFile);
        } else {
            currentPdfFile = null; // Clear stale file object
            pdfCanvas.style.display = 'none';
            const placeholder = pdfViewer.querySelector('.pdf-placeholder');
            placeholder.style.display = 'flex';
            placeholder.querySelector('h3').textContent = "PDF Preview Not Available";
            placeholder.querySelector('p').textContent = "Preview is only for newly uploaded files in this session.";
        }
    } else {
        chatPdfContext.textContent = "No PDF Selected";
        pdfCanvas.style.display = 'none';
        const placeholder = pdfViewer.querySelector('.pdf-placeholder');
        placeholder.style.display = 'flex';
        placeholder.querySelector('h3').textContent = "No PDF Selected";
        placeholder.querySelector('p').textContent = "Upload or select a PDF to view it here";
    }
}

async function renderPdf(file) {
    const fileReader = new FileReader();
    
    fileReader.onerror = function() {
        showToast('Failed to read PDF file.', 'error');
        console.error("FileReader error:", fileReader.error);
    };
    
    fileReader.onload = async function() {
        try {
            if (typeof pdfjsLib === 'undefined') {
                throw new Error('PDF.js library not loaded');
            }
            
            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });

            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;
            const context = pdfCanvas.getContext('2d');

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            pdfCanvas.style.display = 'block';
            pdfViewer.querySelector('.pdf-placeholder').style.display = 'none';
        } catch (error) {
            showToast('Failed to render PDF preview.', 'error');
            console.error("PDF rendering error:", error);
            // Show placeholder with error message
            const placeholder = pdfViewer.querySelector('.pdf-placeholder');
            placeholder.style.display = 'flex';
            placeholder.querySelector('h3').textContent = 'PDF Preview Error';
            placeholder.querySelector('p').textContent = error.message;
        }
    };
    
    fileReader.readAsArrayBuffer(file);
}


// --- QUIZ LIFECYCLE ---
async function generateQuiz() {
    if (!window.currentPdfId) {
        showToast('Please select a PDF first.', 'warning');
        return;
    }
    
    quizContainer.innerHTML = `
        <div class="quiz-content quiz-loading" style="padding: 3rem; text-align: center;">
            <i class="fas fa-brain" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
            <p style="color: var(--text-secondary);">Analyzing your PDF and crafting questions...</p>
        </div>
    `;
    
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
        quizContainer.innerHTML = `
            <div class="quiz-placeholder">
                <i class="fas fa-exclamation-circle" style="color: var(--error-color);"></i>
                <h3>Error Generating Quiz</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

function renderQuiz(quizData) {
    let questionCounter = 0;
    const renderQuestion = (type, qData) => {
        questionCounter++;
        let optionsHtml = '';
        if (type === 'mcq' && qData.options) {
            optionsHtml = qData.options.map((opt, i) => `
                <div class="option-item">
                    <input type="radio" id="q${questionCounter}_opt${i}" name="q${questionCounter}" value="${escapeHtml(opt)}">
                    <label for="q${questionCounter}_opt${i}">${escapeHtml(opt)}</label>
                </div>
            `).join('');
        } else {
            optionsHtml = `<textarea class="answer-input" name="q${questionCounter}" placeholder="Your answer here..."></textarea>`;
        }
        return `
            <div class="question-card" data-question-type="${type}">
                <div class="question-number">${questionCounter}</div>
                <p class="question-text">${escapeHtml(qData.question)}</p>
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
                    ${section.questions.map(q => renderQuestion(section.type, q)).join('')}
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
        
        console.log('Refreshing progress data...');
        await loadProgress();
        console.log('Progress data refreshed');
        
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
        if (questionCards[index] && fb) {
            const feedbackCard = questionCards[index].querySelector('.feedback-card');
            const feedbackText = fb.feedback || '';
            const isCorrect = feedbackText.toLowerCase().includes('correct') || feedbackText.toLowerCase().includes('good');
            feedbackCard.innerHTML = `
                <div class="feedback-header">
                    <span class="feedback-icon ${isCorrect ? 'correct' : 'incorrect'}">
                        <i class="fas ${isCorrect ? 'fa-check' : 'fa-times'}"></i>
                    </span>
                    <h4>Feedback</h4>
                </div>
                <p class="feedback-text">${escapeHtml(feedbackText)}</p>
            `;
            feedbackCard.style.display = 'block';
        }
    });
    
    // Disable all inputs after submission
    const quizForm = document.getElementById('quizForm');
    if (quizForm) {
        quizForm.querySelectorAll('input, textarea, button[type="submit"]').forEach(el => el.disabled = true);
    }
}


// --- VIDEO RECOMMENDATIONS ---
async function getYouTubeRecommendations() {
    if (!window.currentPdfId) {
        showToast('Please select a PDF first.', 'warning');
        return;
    }

    showLoading('Finding relevant videos...');
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
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function displayVideoRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) {
        videoContent.innerHTML = `<div class="video-empty-state"><i class="fab fa-youtube"></i><p>No recommendations found.</p></div>`;
        return;
    }
    const videoList = recommendations.map((video, index) => {
        let url = video.url;
        if (!url || !url.startsWith("https://www.youtube.com/")) {
            url = "#";
        }
        return `
            <li class="video-item">
                <div class="video-number">${index + 1}</div>
                <div class="video-info">
                    <h4 class="video-title">${escapeHtml(video.title)}</h4>
                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="video-link">
                        <i class="fab fa-youtube"></i> Watch on YouTube <i class="fas fa-external-link-alt"></i>
                    </a>
                </div>
            </li>
        `;
    }).join('');
    videoContent.innerHTML = `
        <div class="video-recommendations-intro"><p>Here are some videos to help you learn more:</p></div>
        <ul class="video-list">${videoList}</ul>
    `;
}

// --- PROGRESS TRACKING ---
async function loadProgress() {
    try {
        const response = await fetch('/api/progress');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch progress');

        const attempts = data.attempts || [];
        const totalAttempts = attempts.length;
        const averageScoreValue = totalAttempts > 0 ?
            attempts.reduce((sum, a) => sum + parseFloat((a.score || '0%').replace('%', '')), 0) / totalAttempts
            : 0;

        progressAttempts.textContent = totalAttempts;
        progressAverage.textContent = `${averageScoreValue.toFixed(0)}%`;
        avgScore.textContent = `${averageScoreValue.toFixed(0)}%`;

        if (attemptsList) {
            if (attempts.length === 0) {
                attemptsList.innerHTML = '<div class="attempt-item"><p>You haven\'t attempted any quizzes yet.</p></div>';
            } else {
                attemptsList.innerHTML = attempts.map(attempt => {
                    const date = attempt.timestamp ? new Date(attempt.timestamp).toLocaleString() : 'N/A';
                    return `
                        <div class="attempt-item">
                            <div class="attempt-details">
                                <p class="attempt-pdf">PDF: ${escapeHtml(attempt.pdf_filename || 'Unknown')}</p>
                                <p class="attempt-date">${date}</p>
                            </div>
                            <div class="attempt-score">${escapeHtml(attempt.score || 'N/A')}</div>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (error) {
        showToast(`Error loading progress: ${error.message}`, 'error');
        if (attemptsList) attemptsList.innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`;
    }
}


// ============================================
//
//          CHAT INTERFACE LOGIC
//
// ============================================

// --- DOM ELEMENTS (Chat) ---
const chatElements = {
    sidebar: document.getElementById('chatSidebar'),
    sidebarToggle: document.getElementById('chatSidebarToggle'),
    newChatBtn: document.getElementById('newChatBtn'),
    historyList: document.getElementById('chatHistoryList'),
    messagesContainer: document.getElementById('chatMessages'),
    input: document.getElementById('chatInput'),
    sendBtn: document.getElementById('chatSendBtn'),
};

// --- STATE (Chat) ---
const chatState = {
    currentChatId: null,
    chats: [],
    isTyping: false,
};

// --- INITIALIZER (Chat) ---
function initializeChatInterface() {
    setupChatEventListeners();
    loadChatHistory();
    autoResizeTextarea();
    showWelcomeScreen();
}

// --- EVENT LISTENERS (Chat) ---
function setupChatEventListeners() {
    chatElements.newChatBtn.addEventListener('click', createNewChat);
    chatElements.sendBtn.addEventListener('click', sendMessage);
    chatElements.input.addEventListener('input', handleInputChange);
    chatElements.input.addEventListener('keydown', handleInputKeydown);
    chatElements.sidebarToggle.addEventListener('click', () => toggleSidebar());

    // Use event delegation for suggestion chips for robustness
    chatElements.messagesContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.suggestion-chip');
        if (chip) {
            const suggestion = chip.dataset.suggestion;
            chatElements.input.value = suggestion;
            handleInputChange(); // Update button state
            sendMessage();
        }
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && !chatElements.sidebar.contains(e.target) && !chatElements.sidebarToggle.contains(e.target) && chatElements.sidebar.classList.contains('open')) {
            toggleSidebar(false);
        }
    });
}

// --- INPUT HANDLING (Chat) ---
function handleInputChange() {
    const hasContent = chatElements.input.value.trim().length > 0;
    chatElements.sendBtn.disabled = !hasContent || chatState.isTyping;
    autoResizeTextarea();
}

function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!chatElements.sendBtn.disabled) {
            sendMessage();
        }
    }
}

function autoResizeTextarea() {
    const textarea = chatElements.input;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

// --- MESSAGE HANDLING (Chat) ---
async function sendMessage() {
    const message = chatElements.input.value.trim();
    if (!message || chatState.isTyping) return;

    if (!window.currentPdfId) {
        showToast('Please select a PDF before starting a chat.', 'warning');
        return;
    }

    if (!chatState.currentChatId) {
        createNewChat();
    }

    addMessageToUI('user', message);
    chatElements.input.value = '';
    handleInputChange();

    const currentChat = getCurrentChat();
    currentChat.messages.push({ role: 'user', content: message });
    saveChatHistory();
    showTypingIndicator();

    try {
        const history = currentChat.messages.slice(-10);
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, pdfId: window.currentPdfId, history }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get response');

        hideTypingIndicator();
        addMessageToUI('ai', data.answer, data.citation);

        currentChat.messages.push({ role: 'ai', content: data.answer, citation: data.citation });
        if (currentChat.messages.length === 2) { // First exchange
            currentChat.title = generateChatTitle(message);
            updateChatHistoryUI();
        }
        saveChatHistory();

    } catch (error) {
        hideTypingIndicator();
        addMessageToUI('ai', `Sorry, an error occurred: ${error.message}`);
    }
}

function addMessageToUI(role, content, citation = null) {
    chatElements.messagesContainer.querySelector('.chat-welcome')?.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    const avatar = `<div class="chat-message-avatar"><i class="fas ${role === 'user' ? 'fa-user' : 'fa-robot'}"></i></div>`;
    
    let citationHtml = '';
    if (role === 'ai' && citation) {
        const citationId = `citation-${Date.now()}`;
        citationHtml = `
            <div class="citation-container">
                <button class="citation-toggle" onclick="toggleCitation('${citationId}')">
                    <i class="fas fa-book-open"></i> View Source
                </button>
                <div class="citation-content" id="${citationId}">
                    <blockquote>${escapeHtml(citation)}</blockquote>
                </div>
            </div>
        `;
    }

    const bubble = `
        <div class="chat-message-content">
            <div class="chat-message-bubble">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
            ${citationHtml}
            <span class="chat-message-time">${formatTime(new Date())}</span>
        </div>`;

    messageDiv.innerHTML = avatar + bubble;
    chatElements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    if (document.getElementById('typingIndicator')) return;
    chatState.isTyping = true;
    handleInputChange();
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message ai';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="chat-message-avatar"><i class="fas fa-robot"></i></div>
        <div class="chat-message-content">
            <div class="chat-message-bubble">
                <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
            </div>
        </div>
    `;
    chatElements.messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

function hideTypingIndicator() {
    chatState.isTyping = false;
    document.getElementById('typingIndicator')?.remove();
    handleInputChange();
}

function scrollToBottom() {
    chatElements.messagesContainer.scrollTo({ top: chatElements.messagesContainer.scrollHeight, behavior: 'smooth' });
}

// --- CHAT MANAGEMENT & HISTORY ---
function createNewChat() {
    const newChat = { id: generateChatId(), title: 'New Chat', messages: [] };
    chatState.chats.unshift(newChat);
    chatState.currentChatId = newChat.id;
    clearMessages();
    showWelcomeScreen();
    updateChatHistoryUI();
    saveChatHistory();
    if (window.innerWidth <= 768) toggleSidebar(false);
}

function loadChat(chatId) {
    const chat = chatState.chats.find(c => c.id === chatId);
    if (!chat) return;
    chatState.currentChatId = chatId;
    clearMessages();
    if (chat.messages.length === 0) {
        showWelcomeScreen();
    } else {
        chat.messages.forEach(msg => addMessageToUI(msg.role, msg.content, msg.citation));
    }
    updateChatHistoryUI();
    if (window.innerWidth <= 768) toggleSidebar(false);
}

function getCurrentChat() {
    return chatState.chats.find(c => c.id === chatState.currentChatId);
}

function clearMessages() {
    chatElements.messagesContainer.innerHTML = '';
}

function showWelcomeScreen() {
    clearMessages();
    chatElements.messagesContainer.innerHTML = `
        <div class="chat-welcome">
            <div class="chat-welcome-icon"><i class="fas fa-chalkboard-teacher"></i></div>
            <h2>Hello! I'm your AI Teacher</h2>
            <p>Select a PDF and ask me anything about your study materials.</p>
            <div class="chat-suggestions">
                <button class="suggestion-chip" data-suggestion="Explain this concept to me"><i class="fas fa-lightbulb"></i>Explain a concept</button>
                <button class="suggestion-chip" data-suggestion="Help me understand this topic better"><i class="fas fa-book-reader"></i>Deep dive into a topic</button>
                <button class="suggestion-chip" data-suggestion="Give me some practice questions"><i class="fas fa-question-circle"></i>Practice questions</button>
                <button class="suggestion-chip" data-suggestion="What are the key takeaways?"><i class="fas fa-key"></i>Key takeaways</button>
            </div>
        </div>`;
}

function updateChatHistoryUI() {
    if (chatState.chats.length === 0) {
        chatElements.historyList.innerHTML = `<div class="chat-history-empty"><i class="fas fa-comments"></i><p>No conversations yet.</p></div>`;
        return;
    }
    chatElements.historyList.innerHTML = chatState.chats.map(chat => `
        <div class="chat-history-item ${chat.id === chatState.currentChatId ? 'active' : ''}" data-chat-id="${chat.id}">
            <i class="fas fa-comment-dots chat-history-icon"></i>
            <span class="chat-history-title">${escapeHtml(chat.title)}</span>
        </div>
    `).join('');
    document.querySelectorAll('.chat-history-item').forEach(item => {
        item.addEventListener('click', () => loadChat(item.dataset.chatId));
    });
}

function loadChatHistory() {
    try {
        const saved = localStorage.getItem('chatHistory');
        if (saved) {
            const data = JSON.parse(saved);
            chatState.chats = data.chats || [];
            if (chatState.chats.length > 0) {
                chatState.currentChatId = data.currentChatId || chatState.chats[0].id;
                loadChat(chatState.currentChatId);
            }
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
        chatState.chats = []; // Reset on error
    }
    updateChatHistoryUI();
}

function saveChatHistory() {
    try {
        localStorage.setItem('chatHistory', JSON.stringify({
            chats: chatState.chats,
            currentChatId: chatState.currentChatId,
        }));
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

// --- CHAT UTILITIES ---
function toggleSidebar(force) {
    chatElements.sidebar.classList.toggle('open', force);
}

function toggleCitation(id) {
    const citationContent = document.getElementById(id);
    if (citationContent) {
        const isVisible = citationContent.style.display === 'block';
        citationContent.style.display = isVisible ? 'none' : 'block';
    }
}

function generateChatId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateChatTitle(message) {
    return message.length > 35 ? message.substr(0, 35) + '...' : message;
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}


// ============================================
//
//          GLOBAL UTILITIES
//
// ============================================

function showLoading(message) {
    loadingText.textContent = message || 'Loading...';
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

function showToast(message, type = 'info') {
    const toastIcon = toast.querySelector('.toast-icon');
    const toastMessage = toast.querySelector('.toast-message');

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle',
    };

    if (toastIcon) toastIcon.className = `toast-icon fas ${icons[type] || 'fa-info-circle'}`;
    if (toastMessage) toastMessage.textContent = message;

    toast.className = 'toast show';
    toast.classList.add(type);

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return '';
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}