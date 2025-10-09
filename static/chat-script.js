/**
 * CHAT INTERFACE JAVASCRIPT
 * Handles all chat functionality including message sending,
 * chat history management, and UI interactions
 */

// ============================================
// STATE MANAGEMENT
// ============================================
const chatState = {
    currentChatId: null,
    chats: [],
    isTyping: false,
};

// ============================================
// DOM ELEMENTS
// ============================================
const chatElements = {
    sidebar: document.getElementById('chatSidebar'),
    sidebarToggle: document.getElementById('chatSidebarToggle'),
    newChatBtn: document.getElementById('newChatBtn'),
    historyList: document.getElementById('chatHistoryList'),
    messagesContainer: document.getElementById('chatMessages'),
    input: document.getElementById('chatInput'),
    sendBtn: document.getElementById('chatSendBtn'),
    view: document.getElementById('chatView'),
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeChatInterface();
});

function initializeChatInterface() {
    setupChatEventListeners();
    loadChatHistory();
    autoResizeTextarea();
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupChatEventListeners() {
    chatElements.newChatBtn.addEventListener('click', createNewChat);
    chatElements.sendBtn.addEventListener('click', sendMessage);
    chatElements.input.addEventListener('input', handleInputChange);
    chatElements.input.addEventListener('keydown', handleInputKeydown);
    chatElements.sidebarToggle.addEventListener('click', toggleSidebar);

    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const suggestion = e.currentTarget.dataset.suggestion;
            chatElements.input.value = suggestion;
            handleInputChange();
            sendMessage();
        });
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && !chatElements.sidebar.contains(e.target) && !chatElements.sidebarToggle.contains(e.target) && chatElements.sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    });
}

// ============================================
// INPUT HANDLING
// ============================================
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

// ============================================
// MESSAGE HANDLING
// ============================================
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
    autoResizeTextarea();
    handleInputChange();

    const currentChat = getCurrentChat();
    currentChat.messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    saveChatHistory();
    showTypingIndicator();

    try {
        // FIXED: Implement sliding window for chat history
        const history = currentChat.messages.slice(-10);

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                pdfId: window.currentPdfId,
                history: history, // Send only the last 10 messages
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get response');

        hideTypingIndicator();
        addMessageToUI('ai', data.response);

        currentChat.messages.push({ role: 'ai', content: data.response, timestamp: new Date().toISOString() });
        if (currentChat.messages.length === 2) {
            currentChat.title = generateChatTitle(message);
            updateChatHistoryUI();
        }
        saveChatHistory();

    } catch (error) {
        hideTypingIndicator();
        addMessageToUI('ai', `Sorry, I encountered an error: ${error.message}`);
    }
}

function addMessageToUI(role, content) {
    const welcome = chatElements.messagesContainer.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;

    const avatar = `<div class="chat-message-avatar"><i class="fas ${role === 'user' ? 'fa-user' : 'fa-robot'}"></i></div>`;
    const bubble = `<div class="chat-message-content"><div class="chat-message-bubble">${escapeHtml(content).replace(/\n/g, '<br>')}</div><span class="chat-message-time">${formatTime(new Date())}</span></div>`;

    messageDiv.innerHTML = avatar + bubble;
    chatElements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    chatState.isTyping = true;
    chatElements.sendBtn.disabled = true;

    if (document.getElementById('typingIndicator')) return;

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
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
    handleInputChange();
}

function scrollToBottom() {
    chatElements.messagesContainer.scrollTo({ top: chatElements.messagesContainer.scrollHeight, behavior: 'smooth' });
}

// ============================================
// CHAT MANAGEMENT
// ============================================
function createNewChat() {
    const newChat = {
        id: generateChatId(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString(),
    };

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
        chat.messages.forEach(msg => addMessageToUI(msg.role, msg.content));
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
    const welcomeHTML = `
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
    chatElements.messagesContainer.innerHTML = welcomeHTML;

    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const suggestion = e.currentTarget.dataset.suggestion;
            chatElements.input.value = suggestion;
            handleInputChange();
            sendMessage();
        });
    });
}

// ============================================
// CHAT HISTORY UI
// ============================================
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
            chatState.currentChatId = data.currentChatId || null;
            if (chatState.currentChatId) loadChat(chatState.currentChatId);
        }
        updateChatHistoryUI();
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
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

// ============================================
// UTILITY & SIDEBAR
// ============================================
function toggleSidebar(force) {
    chatElements.sidebar.classList.toggle('open', force);
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}