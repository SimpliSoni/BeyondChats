// ==================== Global State ====================
let currentQuiz = null;
let currentPdfFile = null;

const chatState = {
    chats: [],
    currentChatId: null,
    isTyping: false,
};

// ==================== DOM Element References ====================
// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Quiz Elements
const pdfUpload = document.getElementById('pdf-upload');
const pdfSelect = document.getElementById('pdf-select');
const generateQuizBtn = document.getElementById('generate-quiz-btn');
const newQuizBtn = document.getElementById('new-quiz-btn');
const quizContainer = document.getElementById('quiz-container');
const submitQuizBtn = document.getElementById('submit-quiz-btn');
const pdfViewer = document.getElementById('pdf-viewer');

// Chat Elements
const chatElements = {
    messages: document.getElementById('chat-messages'),
    input: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-chat-btn'),
    newChatBtn: document.getElementById('new-chat-btn'),
    historyList: document.getElementById('chat-history-list'),
    welcomeScreen: document.querySelector('.chat-welcome'),
};

// Video Elements
const getVideoRecsBtn = document.getElementById('get-video-recs-btn');
const videoModal = document.getElementById('video-modal');
const closeVideoModal = document.getElementById('close-video-modal');
const closeVideoModalBtn = document.getElementById('close-video-modal-btn');
const videoList = document.getElementById('video-list');

// Progress Elements
const attemptsList = document.getElementById('attempts-list');
const progressAttempts = document.getElementById('progress-attempts');
const progressAverage = document.getElementById('progress-average');

// Stats Elements
const totalPdfs = document.getElementById('total-pdfs');
const avgScore = document.getElementById('avg-score');

// Score Modal
const scoreModal = document.getElementById('score-modal');
const scoreContent = document.getElementById('score-content');
const closeScoreModal = document.getElementById('close-score-modal');
const closeScoreModalBtn = document.getElementById('close-score-modal-btn');

// Loading and Toast
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const toast = document.getElementById('toast');

// Upload Progress
const uploadProgress = document.getElementById('upload-progress');

// ==================== Utility Functions ====================
function showLoading(text = 'Loading...') {
    loadingText.textContent = text;
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== Tab Switching ====================
function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${target}-tab`).classList.add('active');
        });
    });
}

// ==================== PDF Upload and Selection ====================
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.includes('pdf')) {
        showToast('Please upload a PDF file', 'error');
        return;
    }

    currentPdfFile = file;
    const formData = new FormData();
    formData.append('file', file);

    uploadProgress.style.display = 'block';
    uploadProgress.querySelector('.upload-progress-fill').style.width = '0%';
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');
        
        const result = await response.json();
        showToast('PDF uploaded successfully!', 'success');
        
        uploadProgress.querySelector('.upload-progress-fill').style.width = '100%';
        setTimeout(() => {
            uploadProgress.style.display = 'none';
        }, 1000);
        
        await loadPDFs();
        await loadProgress();
        
        pdfSelect.value = result.pdf_id;
        window.currentPdfId = result.pdf_id;
        generateQuizBtn.disabled = false;
        getVideoRecsBtn.disabled = false;
        
        await renderPdf(currentPdfFile);
    } catch (error) {
        uploadProgress.style.display = 'none';
        showToast('Failed to upload PDF. Please try again.', 'error');
        console.error('Upload error:', error);
    } finally {
        pdfUpload.value = '';
    }
}

async function loadPDFs() {
    try {
        const response = await fetch('/api/pdfs');
        if (!response.ok) throw new Error('Failed to fetch PDFs');
        
        const data = await response.json();
        const pdfs = data.pdfs || [];

        pdfSelect.innerHTML = '<option value="">Select a PDF</option>';
        pdfs.forEach(pdf => {
            const option = document.createElement('option');
            option.value = pdf._id;
            option.textContent = pdf.filename;
            pdfSelect.appendChild(option);
        });

        totalPdfs.textContent = pdfs.length;
    } catch (error) {
        showToast('Failed to load PDFs', 'error');
        console.error('Load PDFs error:', error);
    }
}

async function handlePdfSelect() {
    const selectedPdfId = pdfSelect.value;
    if (!selectedPdfId) {
        generateQuizBtn.disabled = true;
        getVideoRecsBtn.disabled = true;
        pdfViewer.innerHTML = '<p class="no-pdf">Select a PDF to view</p>';
        return;
    }
    
    window.currentPdfId = selectedPdfId;
    generateQuizBtn.disabled = false;
    getVideoRecsBtn.disabled = false;
    quizContainer.innerHTML = '';
    newQuizBtn.style.display = 'none';
    
    pdfViewer.innerHTML = '<p class="no-pdf">PDF preview is only available for newly uploaded files in the current session.</p>';
    
    showToast('PDF selected! You can now generate a quiz.', 'success');
}

async function renderPdf(file) {
    if (!file) {
        pdfViewer.innerHTML = '<p class="no-pdf">No PDF to display</p>';
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        pdfViewer.innerHTML = '';
        
        for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 5); pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.className = 'pdf-page';
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            pdfViewer.appendChild(canvas);
        }

        if (pdf.numPages > 5) {
            const morePages = document.createElement('p');
            morePages.className = 'more-pages';
            morePages.textContent = `... and ${pdf.numPages - 5} more pages`;
            pdfViewer.appendChild(morePages);
        }
    } catch (error) {
        console.error('PDF rendering error:', error);
        pdfViewer.innerHTML = '<p class="no-pdf">Failed to render PDF preview</p>';
    }
}

// ==================== Quiz Generation and Submission ====================
async function generateQuiz() {
    if (!window.currentPdfId) {
        showToast('Please select a PDF first', 'warning');
        return;
    }

    showLoading('Generating quiz from your PDF...');
    try {
        const response = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfId: window.currentPdfId }),
        });

        if (!response.ok) throw new Error('Failed to generate quiz');
        
        const quizData = await response.json();
        currentQuiz = quizData;
        
        hideLoading();
        renderQuiz(quizData);
        
        quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        newQuizBtn.style.display = 'inline-flex';
        showToast('Quiz generated successfully!', 'success');
    } catch (error) {
        hideLoading();
        showToast('Failed to generate quiz. Please try again.', 'error');
        console.error('Quiz generation error:', error);
    }
}

function renderQuiz(quizData) {
    if (!quizData || (!quizData.mcqs?.length && !quizData.saqs?.length && !quizData.laqs?.length)) {
        quizContainer.innerHTML = '<p class="no-data">No questions generated. Please try again.</p>';
        showToast('No questions were generated. Please try again.', 'warning');
        return;
    }

    let html = '<div class="quiz-questions">';

    if (quizData.mcqs && quizData.mcqs.length > 0) {
        html += '<h3 class="question-type-header">Multiple Choice Questions</h3>';
        quizData.mcqs.forEach((mcq, index) => {
            html += `
                <div class="question-card">
                    <p class="question-text"><strong>Q${index + 1}.</strong> ${escapeHtml(mcq.question)}</p>
                    <div class="mcq-options">
                        ${mcq.options.map((option, optIndex) => `
                            <label class="mcq-option">
                                <input type="radio" name="mcq-${index}" value="${escapeHtml(option)}">
                                <span>${escapeHtml(option)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        });
    }

    if (quizData.saqs && quizData.saqs.length > 0) {
        html += '<h3 class="question-type-header">Short Answer Questions</h3>';
        quizData.saqs.forEach((saq, index) => {
            html += `
                <div class="question-card">
                    <p class="question-text"><strong>Q${index + 1}.</strong> ${escapeHtml(saq.question)}</p>
                    <textarea class="answer-input" data-type="saq" data-index="${index}" placeholder="Enter your answer here..." rows="4"></textarea>
                </div>
            `;
        });
    }

    if (quizData.laqs && quizData.laqs.length > 0) {
        html += '<h3 class="question-type-header">Long Answer Questions</h3>';
        quizData.laqs.forEach((laq, index) => {
            html += `
                <div class="question-card">
                    <p class="question-text"><strong>Q${index + 1}.</strong> ${escapeHtml(laq.question)}</p>
                    <textarea class="answer-input" data-type="laq" data-index="${index}" placeholder="Enter your detailed answer here..." rows="8"></textarea>
                </div>
            `;
        });
    }

    html += '</div>';
    quizContainer.innerHTML = html;
    submitQuizBtn.style.display = 'inline-flex';
}

async function submitQuiz() {
    if (!currentQuiz) {
        showToast('No quiz to submit', 'warning');
        return;
    }

    const userAnswers = { mcqs: [], saqs: [], laqs: [] };

    if (currentQuiz.mcqs) {
        currentQuiz.mcqs.forEach((_, index) => {
            const selected = document.querySelector(`input[name="mcq-${index}"]:checked`);
            userAnswers.mcqs.push(selected ? selected.value : '');
        });
    }

    if (currentQuiz.saqs) {
        currentQuiz.saqs.forEach((_, index) => {
            const textarea = document.querySelector(`textarea[data-type="saq"][data-index="${index}"]`);
            userAnswers.saqs.push(textarea ? textarea.value.trim() : '');
        });
    }

    if (currentQuiz.laqs) {
        currentQuiz.laqs.forEach((_, index) => {
            const textarea = document.querySelector(`textarea[data-type="laq"][data-index="${index}"]`);
            userAnswers.laqs.push(textarea ? textarea.value.trim() : '');
        });
    }

    showLoading('Scoring your quiz...');
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

        if (!response.ok) throw new Error('Failed to score quiz');
        
        const result = await response.json();
        hideLoading();
        displayScore(result);
        await loadProgress();
    } catch (error) {
        hideLoading();
        showToast('Failed to score quiz. Please try again.', 'error');
        console.error('Score quiz error:', error);
    }
}

function displayScore(result) {
    const score = result.score || '0%';
    const feedback = result.overallFeedback || 'No feedback available';
    
    scoreContent.innerHTML = `
        <div class="score-display">
            <div class="score-circle">
                <span class="score-value">${escapeHtml(score)}</span>
            </div>
            <h3>Quiz Complete!</h3>
            <p class="feedback-text">${escapeHtml(feedback)}</p>
        </div>
    `;
    
    scoreModal.classList.add('active');
    scoreModal.scrollTop = 0;
}

// ==================== Chat Functionality ====================
function generateChatId() {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getCurrentChat() {
    return chatState.chats.find(chat => chat.id === chatState.currentChatId);
}

function saveChatHistory() {
    try {
        const chatsToSave = chatState.chats.map(chat => ({
            ...chat,
            messages: chat.messages || []
        }));
        localStorage.setItem('chatHistory', JSON.stringify(chatsToSave));
        localStorage.setItem('currentChatId', chatState.currentChatId || '');
    } catch (error) {
        console.error('Failed to save chat history:', error);
    }
}

function loadChatHistory() {
    try {
        const savedChats = localStorage.getItem('chatHistory');
        const savedCurrentId = localStorage.getItem('currentChatId');
        
        if (savedChats) {
            chatState.chats = JSON.parse(savedChats);
            chatState.currentChatId = savedCurrentId || null;
            
            if (chatState.currentChatId) {
                const currentChat = getCurrentChat();
                if (currentChat && currentChat.messages.length > 0) {
                    hideWelcomeScreen();
                    renderMessages(currentChat.messages);
                }
            }
        }
        
        if (chatState.chats.length === 0) {
            createNewChat();
        } else {
            updateChatHistoryUI();
        }
    } catch (error) {
        console.error('Failed to load chat history:', error);
        createNewChat();
    }
}

function createNewChat() {
    if (chatState.currentChatId && getCurrentChat()) {
        saveChatHistory();
    }
    
    const newChatId = generateChatId();
    const newChat = {
        id: newChatId,
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString(),
    };
    
    chatState.chats.unshift(newChat);
    chatState.currentChatId = newChatId;
    
    clearMessages();
    showWelcomeScreen();
    updateChatHistoryUI();
    saveChatHistory();
    
    chatElements.input.focus();
}

function switchToChat(chatId) {
    if (chatState.currentChatId && getCurrentChat()) {
        saveChatHistory();
    }
    
    chatState.currentChatId = chatId;
    const chat = getCurrentChat();
    
    if (chat) {
        clearMessages();
        if (chat.messages.length === 0) {
            showWelcomeScreen();
        } else {
            hideWelcomeScreen();
            renderMessages(chat.messages);
        }
        updateChatHistoryUI();
    }
}

function deleteChat(chatId, event) {
    event.stopPropagation();
    
    if (chatState.chats.length === 1) {
        showToast('Cannot delete the last chat', 'warning');
        return;
    }
    
    chatState.chats = chatState.chats.filter(chat => chat.id !== chatId);
    
    if (chatState.currentChatId === chatId) {
        chatState.currentChatId = chatState.chats[0].id;
        switchToChat(chatState.currentChatId);
    }
    
    updateChatHistoryUI();
    saveChatHistory();
    showToast('Chat deleted', 'success');
}

function updateChatHistoryUI() {
    chatElements.historyList.innerHTML = chatState.chats.map(chat => `
        <div class="chat-history-item ${chat.id === chatState.currentChatId ? 'active' : ''}" 
             onclick="switchToChat('${chat.id}')">
            <div class="chat-history-content">
                <span class="chat-title">${escapeHtml(chat.title)}</span>
                <span class="chat-date">${new Date(chat.createdAt).toLocaleDateString()}</span>
            </div>
            <button class="delete-chat-btn" onclick="deleteChat('${chat.id}', event)" title="Delete chat">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function showWelcomeScreen() {
    chatElements.welcomeScreen.style.display = 'flex';
}

function hideWelcomeScreen() {
    chatElements.welcomeScreen.style.display = 'none';
}

function clearMessages() {
    chatElements.messages.innerHTML = '';
}

function renderMessages(messages) {
    clearMessages();
    messages.forEach(msg => {
        addMessageToUI(msg.role, msg.content, msg.citation);
    });
}

function addMessageToUI(role, content, citation = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    let messageHTML = `<div class="message-content">${escapeHtml(content)}</div>`;
    
    if (citation && role === 'assistant') {
        messageHTML += `
            <div class="citation">
                <i class="fas fa-quote-left"></i>
                <span>${escapeHtml(citation)}</span>
            </div>
        `;
    }
    
    messageDiv.innerHTML = messageHTML;
    chatElements.messages.appendChild(messageDiv);
    chatElements.messages.scrollTop = chatElements.messages.scrollHeight;
}

async function sendMessage() {
    const message = chatElements.input.value.trim();
    if (!message) return;
    
    if (!window.currentPdfId) {
        showToast('Please select a PDF first from the Quiz tab', 'warning');
        return;
    }
    
    if (chatState.isTyping) return;
    
    const currentChat = getCurrentChat();
    if (!currentChat) return;
    
    hideWelcomeScreen();
    
    currentChat.messages.push({ role: 'user', content: message });
    addMessageToUI('user', message);
    
    if (currentChat.title === 'New Chat' && message.length > 0) {
        currentChat.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
        updateChatHistoryUI();
    }
    
    chatElements.input.value = '';
    chatState.isTyping = true;
    chatElements.sendBtn.disabled = true;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message assistant typing';
    typingDiv.innerHTML = '<div class="message-content"><span class="typing-indicator"><span></span><span></span><span></span></span></div>';
    chatElements.messages.appendChild(typingDiv);
    chatElements.messages.scrollTop = chatElements.messages.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: message,
                pdfId: window.currentPdfId 
            }),
        });

        typingDiv.remove();

        if (!response.ok) throw new Error('Chat request failed');
        
        const data = await response.json();
        const aiMessage = data.answer || 'Sorry, I could not generate a response.';
        const citation = data.citation || null;
        
        currentChat.messages.push({ 
            role: 'assistant', 
            content: aiMessage,
            citation: citation 
        });
        addMessageToUI('assistant', aiMessage, citation);
        
        saveChatHistory();
    } catch (error) {
        typingDiv.remove();
        showToast('Failed to get response. Please try again.', 'error');
        console.error('Chat error:', error);
    } finally {
        chatState.isTyping = false;
        chatElements.sendBtn.disabled = false;
        chatElements.input.focus();
    }
}

// ==================== Video Recommendations ====================
async function getVideoRecommendations() {
    if (!window.currentPdfId) {
        showToast('Please select a PDF first', 'warning');
        return;
    }

    showLoading('Finding relevant educational videos...');
    try {
        const response = await fetch('/api/recommend-videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfId: window.currentPdfId }),
        });

        if (!response.ok) throw new Error('Failed to get video recommendations');
        
        const data = await response.json();
        hideLoading();
        displayVideoRecommendations(data.recommendations || []);
    } catch (error) {
        hideLoading();
        showToast('Failed to get video recommendations. Please try again.', 'error');
        console.error('Video recommendations error:', error);
    }
}

function displayVideoRecommendations(videos) {
    if (!videos || videos.length === 0) {
        videoList.innerHTML = '<p class="no-data">No video recommendations available.</p>';
    } else {
        videoList.innerHTML = videos.map(video => `
            <div class="video-card">
                <i class="fab fa-youtube video-icon"></i>
                <div class="video-info">
                    <h4>${escapeHtml(video.title)}</h4>
                    <a href="${escapeHtml(video.url)}" target="_blank" rel="noopener noreferrer" class="video-link">
                        Watch on YouTube <i class="fas fa-external-link-alt"></i>
                    </a>
                </div>
            </div>
        `).join('');
    }
    videoModal.classList.add('active');
}

// ==================== Progress/Stats ====================
async function loadProgress() {
    try {
        const response = await fetch('/api/progress');
        if (!response.ok) throw new Error('Failed to fetch progress');
        
        const data = await response.json();
        const attempts = data.attempts || [];
        
        progressAttempts.textContent = attempts.length;
        
        if (attempts.length > 0) {
            const scores = attempts.map(a => {
                const scoreStr = a.score || '0%';
                return parseInt(scoreStr.replace('%', ''));
            });
            const average = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
            progressAverage.textContent = `${average}%`;
            avgScore.textContent = `${average}%`;
        } else {
            progressAverage.textContent = '0%';
            avgScore.textContent = '0%';
        }
        
        const pdfsResponse = await fetch('/api/pdfs');
        if (pdfsResponse.ok) {
            const pdfsData = await pdfsResponse.json();
            totalPdfs.textContent = pdfsData.pdfs?.length || 0;
        }
        
        if (attempts.length === 0) {
            attemptsList.innerHTML = '<p class="no-data">No quiz attempts yet. Complete a quiz to see your progress!</p>';
        } else {
            attemptsList.innerHTML = attempts.map(attempt => `
                <div class="attempt-card">
                    <div class="attempt-header">
                        <h4>${escapeHtml(attempt.pdf_filename || 'Unknown PDF')}</h4>
                        <span class="attempt-score">${escapeHtml(attempt.score || 'N/A')}</span>
                    </div>
                    <p class="attempt-date">${new Date(attempt.timestamp).toLocaleString()}</p>
                    <p class="attempt-feedback">${escapeHtml(attempt.feedback || 'No feedback available')}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load progress:', error);
        showToast('Failed to load progress data', 'error');
    }
}

// ==================== Event Listeners Setup ====================
function setupMainEventListeners() {
    pdfUpload.addEventListener('change', handleFileUpload);
    pdfSelect.addEventListener('change', handlePdfSelect);
    generateQuizBtn.addEventListener('click', generateQuiz);
    newQuizBtn.addEventListener('click', generateQuiz);
    submitQuizBtn.addEventListener('click', submitQuiz);
    getVideoRecsBtn.addEventListener('click', getVideoRecommendations);
    
    chatElements.sendBtn.addEventListener('click', sendMessage);
    chatElements.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    chatElements.newChatBtn.addEventListener('click', createNewChat);
    
    closeVideoModal.addEventListener('click', () => {
        videoModal.classList.remove('active');
    });
    closeVideoModalBtn.addEventListener('click', () => {
        videoModal.classList.remove('active');
    });
    videoModal.addEventListener('click', (e) => {
        if (e.target === videoModal) {
            videoModal.classList.remove('active');
        }
    });
    
    closeScoreModal.addEventListener('click', () => {
        scoreModal.classList.remove('active');
    });
    closeScoreModalBtn.addEventListener('click', () => {
        scoreModal.classList.remove('active');
    });
    scoreModal.addEventListener('click', (e) => {
        if (e.target === scoreModal) {
            scoreModal.classList.remove('active');
        }
    });
}

// ==================== Initialization ====================
async function init() {
    setupTabs();
    setupMainEventListeners();
    await loadPDFs();
    await loadProgress();
    loadChatHistory();
    
    console.log('App initialized successfully!');
}

document.addEventListener('DOMContentLoaded', init);