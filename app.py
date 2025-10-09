import os
import uuid
import json
import time
import re
from collections import Counter
import google.generativeai as genai
from flask import Flask, request, jsonify, render_template
from pymongo import MongoClient
from bson import ObjectId
import PyPDF2
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
import datetime

# --- Initialization ---
load_dotenv()

app = Flask(__name__)

# --- Gemini AI and MongoDB Setup ---
try:
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-2.5-flash')
    client = MongoClient(os.getenv("MONGO_URI"))
    db = client.school_reviser_db
    pdfs_collection = db.pdfs
    quiz_attempts_collection = db.quiz_attempts
    print("Successfully connected to MongoDB and configured Gemini API.")
except Exception as e:
    print(f"Error during setup: {e}")

# --- Helper for JSON serialization ---
def serialize_doc(doc):
    """Recursively converts a MongoDB doc to a JSON-serializable format."""
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        serialized = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                serialized[key] = str(value)
            elif isinstance(value, datetime.datetime):
                serialized[key] = value.isoformat()
            elif isinstance(value, (dict, list)):
                serialized[key] = serialize_doc(value)
            else:
                serialized[key] = value
        return serialized
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime.datetime):
        return doc.isoformat()
    return doc

# --- Gemini API Retry Logic ---
def generate_with_retry(model, prompt, retries=3, delay=2):
    """
    Calls the Gemini API with exponential backoff retry logic.
    
    Args:
        model: The Gemini model instance
        prompt: The prompt to send
        retries: Number of retry attempts
        delay: Initial delay in seconds (doubles with each retry)
    
    Returns:
        The API response
    
    Raises:
        Exception: If all retries fail
    """
    for i in range(retries):
        try:
            return model.generate_content(prompt)
        except Exception as e:
            if i < retries - 1:
                wait_time = delay ** (i + 1)
                print(f"API call failed (attempt {i+1}/{retries}): {e}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"API call failed after {retries} attempts: {e}")
                raise e

# --- Lightweight RAG Implementation ---
def simple_keyword_search(text, query, chunk_size=500, top_k=3):
    """
    Lightweight keyword-based retrieval without heavy ML dependencies.
    Uses word frequency and overlap scoring.
    
    Args:
        text: Full document text
        query: User's question
        chunk_size: Number of words per chunk
        top_k: Number of top chunks to return
    
    Returns:
        Concatenated relevant text chunks
    """
    if not text or not query:
        return text[:2000] if text else ""
    
    # Normalize and tokenize
    def tokenize(s):
        return re.findall(r'\b\w+\b', s.lower())
    
    query_words = set(tokenize(query))
    
    # Split into chunks
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunk_text = ' '.join(words[i:i+chunk_size])
        chunks.append(chunk_text)
    
    if not chunks:
        return text[:2000]
    
    # Score chunks by keyword overlap
    chunk_scores = []
    for idx, chunk in enumerate(chunks):
        chunk_words = set(tokenize(chunk))
        # Calculate overlap score
        overlap = len(query_words & chunk_words)
        # Boost score if query words appear multiple times
        word_counts = Counter(tokenize(chunk))
        frequency_boost = sum(word_counts[w] for w in query_words if w in word_counts)
        score = overlap * 10 + frequency_boost
        chunk_scores.append((score, idx))
    
    # Get top k chunks
    chunk_scores.sort(reverse=True)
    top_indices = [idx for _, idx in chunk_scores[:top_k]]
    top_indices.sort()  # Maintain document order
    
    relevant_text = '\n\n'.join([chunks[i] for i in top_indices])
    
    # Fallback if no good matches
    if not relevant_text.strip():
        return chunks[0] if chunks else text[:2000]
    
    return relevant_text

# --- API Endpoints ---

@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and file.filename.endswith('.pdf'):
        original_filename = secure_filename(file.filename)

        try:
            # Process the file in-memory without saving to disk
            pdf_reader = PyPDF2.PdfReader(file.stream)
            extracted_text = "".join(page.extract_text() for page in pdf_reader.pages if page.extract_text())

            if not extracted_text:
                return jsonify({"error": "Could not extract text from PDF."}), 400

            pdf_doc = {
                "filename": original_filename,
                "extracted_text": extracted_text,
                "uploaded_at": datetime.datetime.utcnow()
            }
            result = pdfs_collection.insert_one(pdf_doc)

            return jsonify({
                "success": True,
                "message": "File uploaded and processed.",
                "pdf_id": str(result.inserted_id)
            }), 201
        except Exception as e:
            return jsonify({"error": f"Failed to process PDF: {e}"}), 500
    else:
        return jsonify({"error": "Invalid file type. Please upload a PDF."}), 400


@app.route('/api/pdfs', methods=['GET'])
def get_pdfs():
    try:
        all_pdfs = list(pdfs_collection.find({}, {"extracted_text": 0}))
        return jsonify({"pdfs": [serialize_doc(pdf) for pdf in all_pdfs]}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve PDFs: {e}"}), 500

@app.route('/api/generate-quiz', methods=['POST'])
def generate_quiz():
    data = request.get_json()
    pdf_id = data.get('pdfId')
    if not pdf_id:
        return jsonify({"error": "PDF ID is required."}), 400

    try:
        pdf_doc = pdfs_collection.find_one({"_id": ObjectId(pdf_id)})
        if not pdf_doc or not pdf_doc.get('extracted_text'):
            return jsonify({"error": "PDF not found or has no text content."}), 404

        text_content = " ".join(pdf_doc['extracted_text'].split()[:4000])
        prompt = f"""
        Based on the text from a coursebook, generate a quiz with 2 MCQs, 2 SAQs, and 1 LAQ.
        Return ONLY a single valid JSON object with keys "mcqs", "saqs", and "laqs".
        For MCQs, include "question", "options", and "correctAnswer".
        For SAQs/LAQs, include "question" and "idealAnswer".

        Text content: --- {text_content} ---
        """
        response = generate_with_retry(model, prompt)
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "")
        quiz_data = json.loads(cleaned_response)
        return jsonify(quiz_data), 200
    except Exception as e:
        return jsonify({"error": f"Failed to generate quiz: {e}"}), 500

@app.route('/api/chat', methods=['POST'])
def handle_chat():
    data = request.get_json()
    user_message = data.get('message')
    pdf_id = data.get('pdfId')

    if not user_message or not pdf_id:
        return jsonify({"error": "Message and PDF ID are required."}), 400

    try:
        pdf_doc = pdfs_collection.find_one({"_id": ObjectId(pdf_id)})
        if not pdf_doc or not pdf_doc.get('extracted_text'):
            return jsonify({"error": "PDF not found or has no text content."}), 404
        
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
const avgScore = document.getElementById('avgScore');


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
        
        renderPdf(file);
        
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
        const chatPdfContext = document.getElementById('chatPdfContext');
        if (chatPdfContext) {
            chatPdfContext.textContent = `Discussing: ${selectedOption.textContent}`;
        }
        
        if (currentPdfFile && pdfSelect.options[pdfSelect.selectedIndex].textContent === currentPdfFile.name) {
            renderPdf(currentPdfFile);
        } else {
            currentPdfFile = null;
            pdfCanvas.style.display = 'none';
            const placeholder = pdfViewer.querySelector('.pdf-placeholder');
            placeholder.style.display = 'flex';
            placeholder.querySelector('h3').textContent = "PDF Preview Not Available";
            placeholder.querySelector('p').textContent = "Preview is only available for newly uploaded files.";
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
    const renderQuestion = (type, question, options = []) => {
        questionCounter++;
        let optionsHtml = '';
        if (type === 'mcq') {
            optionsHtml = options.map((opt, i) => `
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
            const isCorrect = (fb.feedback || '').toLowerCase().includes('correct') || (fb.feedback || '').toLowerCase().includes('good');

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
                <span>These recommendations are generated based on the content of your selected PDF.</span>
            </div>
        </div>
    `;
}

async function loadProgress() {
    try {
        showLoading('Loading your progress...');
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

        const attemptsListEl = document.getElementById('attemptsList');
        if (attempts.length === 0) {
            attemptsListEl.innerHTML = '<div class="attempt-item"><p>You haven\'t attempted any quizzes yet.</p></div>';
            return;
        }

        attemptsListEl.innerHTML = attempts.map(attempt => {
            const date = attempt.timestamp ? new Date(attempt.timestamp).toLocaleString() : 'N/A';
            const score = attempt.score || 'N/A';
            const filename = attempt.pdf_filename || 'Unknown';
            
            return `
                <div class="attempt-item">
                    <div class="attempt-details">
                        <p class="attempt-pdf">PDF: ${escapeHtml(filename)}</p>
                        <p class="attempt-date">${date}</p>
                    </div>
                    <div class="attempt-score">${score}</div>
                </div>
            `;
        }).join('');

    } catch (error) {
        showToast(`Error loading progress: ${error.message}`, 'error');
        document.getElementById('attemptsList').innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`;
    } finally {
        hideLoading();
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
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    if (!toastMessage) { // Simple fallback
        toast.textContent = message;
    } else {
        toastMessage.textContent = message;
    }
    
    toast.className = 'toast show'; // Base class
    toast.classList.add(type); // Type class

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