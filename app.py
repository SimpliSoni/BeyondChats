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
    # **FIX**: Corrected the model name to a valid one
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
    Lightweight keyword-based retrieval.
    """
    if not text or not query:
        return text[:2000] if text else ""
    
    def tokenize(s):
        return re.findall(r'\b\w+\b', s.lower())
    
    query_words = set(tokenize(query))
    words = text.split()
    chunks = [' '.join(words[i:i+chunk_size]) for i in range(0, len(words), chunk_size)]
    
    if not chunks:
        return text[:2000]
    
    chunk_scores = []
    for idx, chunk in enumerate(chunks):
        chunk_words = set(tokenize(chunk))
        overlap = len(query_words & chunk_words)
        word_counts = Counter(tokenize(chunk))
        frequency_boost = sum(word_counts.get(w, 0) for w in query_words)
        score = overlap * 10 + frequency_boost
        chunk_scores.append((score, idx))
    
    chunk_scores.sort(reverse=True)
    top_indices = sorted([idx for _, idx in chunk_scores[:top_k]])
    relevant_text = '\n\n'.join([chunks[i] for i in top_indices])
    
    return relevant_text if relevant_text.strip() else chunks[0]

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
        
        full_text = pdf_doc.get('extracted_text', '')
        relevant_text = simple_keyword_search(full_text, user_message, chunk_size=500, top_k=3)
        prompt = f"""
        You are a helpful AI teacher. A student has asked a question about a document.
        Your task is to provide a clear answer based ONLY on the provided "Relevant Context".
        You MUST return a single valid JSON object with two keys:
        1. "answer": Your clear and concise answer to the student's question.
        2. "citation": A direct, verbatim quote from the "Relevant Context" that supports your answer.
        Relevant Context from Document:
        ---
        {relevant_text}
        ---
        Student's Question: "{user_message}"
        JSON Response:
        """
        response = generate_with_retry(model, prompt)
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "")
        ai_data = json.loads(cleaned_response)

        if "answer" not in ai_data or "citation" not in ai_data:
             return jsonify({"answer": cleaned_response, "citation": relevant_text}), 200
        return jsonify(ai_data), 200
    except json.JSONDecodeError:
        return jsonify({"error": "Failed to get a valid structured response from the AI."}), 500
    except Exception as e:
        print(f"Chat API Error: {e}")
        return jsonify({"error": f"An error occurred while getting the AI response: {e}"}), 500

@app.route('/api/recommend-videos', methods=['POST'])
def recommend_videos():
    data = request.get_json()
    pdf_id = data.get('pdfId')
    if not pdf_id:
        return jsonify({"error": "PDF ID is required."}), 400
    try:
        pdf_doc = pdfs_collection.find_one({"_id": ObjectId(pdf_id)})
        if not pdf_doc or not pdf_doc.get('extracted_text'):
            return jsonify({"error": "PDF not found or has no text content."}), 404
        text_content = " ".join(pdf_doc['extracted_text'].split()[:3000])
        prompt = f"""
        You are an expert educational content curator. Analyze the text and recommend exactly 5 relevant educational YouTube videos.
        For each, provide a "title" (what to search for) and a "url" (a direct YouTube search link).
        Return ONLY a valid JSON object: {{"recommendations": [{{"title": "...", "url": "..."}}]}}.
        Educational Text Content:
        ---
        {text_content}
        ---
        JSON Response:
        """
        response = generate_with_retry(model, prompt)
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "")
        recommendations_data = json.loads(cleaned_response)
        if "recommendations" not in recommendations_data:
            return jsonify({"error": "Invalid response format from AI."}), 500
        return jsonify(recommendations_data), 200
    except Exception as e:
        return jsonify({"error": f"Failed to generate video recommendations: {e}"}), 500

@app.route('/api/score-quiz', methods=['POST'])
def score_quiz():
    data = request.get_json()
    pdf_id_str = data.get('pdfId')
    prompt = f"""
    Evaluate a student's quiz submission.
    Quiz Questions & Ideal Answers: --- {json.dumps(data.get('quizQuestions'), indent=2)} ---
    Student's Answers: --- {json.dumps(data.get('userAnswers'), indent=2)} ---
    Return ONLY a single valid JSON object with "score" (e.g., "85%"), "overallFeedback", and an array "questionFeedback" with feedback for each question.
    """
    try:
        response = generate_with_retry(model, prompt)
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "")
        scoring_result = json.loads(cleaned_response)

        pdf_id_obj = ObjectId(pdf_id_str) if pdf_id_str and ObjectId.is_valid(pdf_id_str) else None
        
        pdf_filename = "Unknown PDF"
        if pdf_id_obj:
            pdf_doc = pdfs_collection.find_one({"_id": pdf_id_obj})
            if pdf_doc:
                pdf_filename = pdf_doc.get("filename", "Unknown PDF")

        quiz_attempts_collection.insert_one({
            "pdfId": pdf_id_obj,
            "pdf_filename": pdf_filename,
            "answers": data.get('userAnswers'),
            "score": scoring_result.get("score"),
            "feedback": scoring_result.get("overallFeedback"),
            "timestamp": datetime.datetime.utcnow()
        })
        return jsonify(scoring_result), 200
    except Exception as e:
        return jsonify({"error": f"Failed to score quiz: {e}"}), 500

@app.route('/api/progress', methods=['GET'])
def get_progress():
    try:
        attempts = list(quiz_attempts_collection.find({}).sort("timestamp", -1))
        return jsonify({"attempts": [serialize_doc(attempt) for attempt in attempts]}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve progress: {e}"}), 500

# --- Frontend Serving ---
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)