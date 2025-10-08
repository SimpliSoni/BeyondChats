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
    chats: [], // Array of chat objects: { id, title, messages: [], createdAt }
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

/**
 * Initialize chat interface when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeChatInterface();
});

function initializeChatInterface() {
    setupChatEventListeners();
    loadChatHistory();
    
    // Auto-resize textarea
    autoResizeTextarea();
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupChatEventListeners() {
    // New chat button
    chatElements.newChatBtn.addEventListener('click', createNewChat);
    
    // Send button
    chatElements.sendBtn.addEventListener('click', sendMessage);
    
    // Input field
    chatElements.input.addEventListener('input', handleInputChange);
    chatElements.input.addEventListener('keydown', handleInputKeydown);
    
    // Sidebar toggle (mobile)
    chatElements.sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const suggestion = e.currentTarget.dataset.suggestion;
            chatElements.input.value = suggestion;
            handleInputChange();
            sendMessage();
        });
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!chatElements.sidebar.contains(e.target) && 
                !chatElements.sidebarToggle.contains(e.target) &&
                chatElements.sidebar.classList.contains('open')) {
                toggleSidebar();
            }
        }
    });
}

// ============================================
// INPUT HANDLING
// ============================================

/**
 * Handle input field changes - enable/disable send button
 */
function handleInputChange() {
    const hasContent = chatElements.input.value.trim().length > 0;
    chatElements.sendBtn.disabled = !hasContent || chatState.isTyping;
    autoResizeTextarea();
}

/**
 * Handle keyboard shortcuts in input field
 * Enter = send, Shift+Enter = new line
 */
function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!chatElements.sendBtn.disabled) {
            sendMessage();
        }
    }
}

/**
 * Auto-resize textarea based on content
 */
function autoResizeTextarea() {
    const textarea = chatElements.input;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

// ============================================
// MESSAGE HANDLING
// ============================================

/**
 * Send a message to the AI teacher
 */
async function sendMessage() {
    const message = chatElements.input.value.trim();
    if (!message || chatState.isTyping) return;
    
    // Create new chat if needed
    if (!chatState.currentChatId) {
        createNewChat();
    }
    
    // Add user message to UI
    addMessageToUI('user', message);
    
    // Clear input
    chatElements.input.value = '';
    chatElements.input.style.height = 'auto';
    handleInputChange();
    
    // Add message to current chat
    const currentChat = getCurrentChat();
    currentChat.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
    });
    
    // Save to localStorage
    saveChatHistory();
    
    // Show typing indicator
    showTypingIndicator();
    
    // Send to backend
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                chatId: chatState.currentChatId,
                history: currentChat.messages,
            }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to get response');
        }
        
        // Remove typing indicator
        hideTypingIndicator();
        
        // Add AI response
        addMessageToUI('ai', data.response);
        
        // Update chat history
        currentChat.messages.push({
            role: 'ai',
            content: data.response,
            timestamp: new Date().toISOString(),
        });
        
        // Update chat title if it's the first exchange
        if (currentChat.messages.length === 2) {
            currentChat.title = generateChatTitle(message);
            updateChatHistoryUI();
        }
        
        // Save to localStorage
        saveChatHistory();
        
    } catch (error) {
        hideTypingIndicator();
        showToast(error.message, 'error');
        
        // Add error message
        addMessageToUI('ai', 'Sorry, I encountered an error. Please try again.');
    }
}

/**
 * Add a message to the UI
 * @param {string} role - 'user' or 'ai'
 * @param {string} content - Message content
 */
function addMessageToUI(role, content) {
    // Remove welcome screen if present
    const welcome = chatElements.messagesContainer.querySelector('.chat-welcome');
    if (welcome) {
        welcome.remove();
    }
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'chat-message-avatar';
    avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'chat-message-content';
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-message-bubble';
    bubble.textContent = content;
    
    const time = document.createElement('span');
    time.className = 'chat-message-time';
    time.textContent = formatTime(new Date());
    
    contentDiv.appendChild(bubble);
    contentDiv.appendChild(time);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    chatElements.messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom with smooth animation
    scrollToBottom();
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
    chatState.isTyping = true;
    chatElements.sendBtn.disabled = true;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-typing';
    typingDiv.id = 'typingIndicator';
    
    typingDiv.innerHTML = `
        <div class="chat-message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="chat-message-content">
            <div class="chat-message-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        </div>
    `;
    
    chatElements.messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
    chatState.isTyping = false;
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
    handleInputChange();
}

/**
 * Scroll chat to bottom smoothly
 */
function scrollToBottom() {
    setTimeout(() => {
        chatElements.messagesContainer.scrollTo({
            top: chatElements.messagesContainer.scrollHeight,
            behavior: 'smooth',
        });
    }, 100);
}

// ============================================
// CHAT MANAGEMENT
// ============================================

/**
 * Create a new chat
 */
function createNewChat() {
    const newChat = {
        id: generateChatId(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString(),
    };
    
    chatState.chats.unshift(newChat);
    chatState.currentChatId = newChat.id;
    
    // Clear messages and show welcome
    clearMessages();
    showWelcomeScreen();
    
    // Update UI
    updateChatHistoryUI();
    saveChatHistory();
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        toggleSidebar(false);
    }
}

/**
 * Load a specific chat
 * @param {string} chatId - Chat ID to load
 */
function loadChat(chatId) {
    const chat = chatState.chats.find(c => c.id === chatId);
    if (!chat) return;
    
    chatState.currentChatId = chatId;
    
    // Clear current messages
    clearMessages();
    
    // Load chat messages
    if (chat.messages.length === 0) {
        showWelcomeScreen();
    } else {
        chat.messages.forEach(msg => {
            addMessageToUI(msg.role, msg.content);
        });
    }
    
    // Update active state in history
    updateChatHistoryUI();
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        toggleSidebar(false);
    }
}

/**
 * Get current active chat
 * @returns {Object} Current chat object
 */
function getCurrentChat() {
    return chatState.chats.find(c => c.id === chatState.currentChatId);
}

/**
 * Clear all messages from UI
 */
function clearMessages() {
    chatElements.messagesContainer.innerHTML = '';
}

/**
 * Show welcome screen
 */
function showWelcomeScreen() {
    chatElements.messagesContainer.innerHTML = `
        <div class="chat-welcome">
            <div class="chat-welcome-icon">
                <i class="fas fa-chalkboard-teacher"></i>
            </div>
            <h2>Hello! I'm your AI Teacher</h2>
            <p>Ask me anything about your study materials, or let's discuss concepts you're learning.</p>
            <div class="chat-suggestions">
                <button class="suggestion-chip" data-suggestion="Explain this concept to me">
                    <i class="fas fa-lightbulb"></i>
                    Explain a concept
                </button>
                <button class="suggestion-chip" data-suggestion="Help me understand this topic better">
                    <i class="fas fa-book-reader"></i>
                    Deep dive into a topic
                </button>
                <button class="suggestion-chip" data-suggestion="Can you give me some practice questions?">
                    <i class="fas fa-question-circle"></i>
                    Practice questions
                </button>
                <button class="suggestion-chip" data-suggestion="What are the key takeaways from this material?">
                    <i class="fas fa-key"></i>
                    Key takeaways
                </button>
            </div>
        </div>
    `;
    
    // Re-attach event listeners to new suggestion chips
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

/**
 * Update chat history list in sidebar
 */
function updateChatHistoryUI() {
    if (chatState.chats.length === 0) {
        chatElements.historyList.innerHTML = `
            <div class="chat-history-empty">
                <i class="fas fa-comments"></i>
                <p>No conversations yet.<br>Start a new chat!</p>
            </div>
        `;
        return;
    }
    
    chatElements.historyList.innerHTML = chatState.chats.map(chat => `
        <div class="chat-history-item ${chat.id === chatState.currentChatId ? 'active' : ''}" 
             data-chat-id="${chat.id}">
            <i class="fas fa-comment-dots chat-history-icon"></i>
            <span class="chat-history-title">${escapeHtml(chat.title)}</span>
            <span class="chat-history-date">${formatDate(new Date(chat.createdAt))}</span>
        </div>
    `).join('');
    
    // Add click listeners
    document.querySelectorAll('.chat-history-item').forEach(item => {
        item.addEventListener('click', () => {
            loadChat(item.dataset.chatId);
        });
    });
}

/**
 * Load chat history from localStorage
 */
function loadChatHistory() {
    try {
        const saved = localStorage.getItem('chatHistory');
        if (saved) {
            const data = JSON.parse(saved);
            chatState.chats = data.chats || [];
            chatState.currentChatId = data.currentChatId || null;
            
            // Load current chat if exists
            if (chatState.currentChatId) {
                loadChat(chatState.currentChatId);
            }
        }
        
        updateChatHistoryUI();
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

/**
 * Save chat history to localStorage
 */
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
// SIDEBAR TOGGLE (Mobile)
// ============================================

/**
 * Toggle sidebar visibility on mobile
 * @param {boolean} force - Force open/close state
 */
function toggleSidebar(force) {
    if (typeof force === 'boolean') {
        chatElements.sidebar.classList.toggle('open', force);
    } else {
        chatElements.sidebar.classList.toggle('open');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate unique chat ID
 * @returns {string} Unique ID
 */
function generateChatId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate chat title from first message
 * @param {string} message - First user message
 * @returns {string} Generated title
 */
function generateChatTitle(message) {
    // Take first 50 characters and add ellipsis if needed
    return message.length > 50 ? message.substr(0, 50) + '...' : message;
}

/**
 * Format time for display
 * @param {Date} date - Date object
 * @returns {string} Formatted time
 */
function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

/**
 * Format date for chat history
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
function formatDate(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// EXPORT FOR BACKEND INTEGRATION
// ============================================

// Make chat functions available globally if needed
window.chatInterface = {
    sendMessage,
    createNewChat,
    loadChat,
    getCurrentChat,
};