import os
import uuid
import json
import time
import google.generativeai as genai
from flask import Flask, request, jsonify, render_template, send_from_directory
from pymongo import MongoClient
from bson import ObjectId
import PyPDF2
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
import datetime
import magic

# --- Initialization ---
load_dotenv()

app = Flask(__name__)

# --- Configuration ---
app.config['UPLOAD_FOLDER'] = 'static/uploads'

# Create uploads directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

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

# --- API Endpoints ---

@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and file.filename.endswith('.pdf'):
        try:
            # Validate MIME type
            file_head = file.stream.read(2048)
            file.stream.seek(0)
            mime_type = magic.from_buffer(file_head, mime=True)
            
            if mime_type != 'application/pdf':
                return jsonify({"error": "Invalid file type. Please upload a valid PDF."}), 400
            
            original_filename = secure_filename(file.filename)
            
            # Extract text first
            reader = PyPDF2.PdfReader(file.stream)
            extracted_text = "".join(page.extract_text() for page in reader.pages if page.extract_text())
            
            if not extracted_text:
                return jsonify({"error": "Could not extract text from PDF."}), 400
            
            # Save to database
            pdf_doc = {"filename": original_filename, "extracted_text": extracted_text}
            result = pdfs_collection.insert_one(pdf_doc)
            new_id = str(result.inserted_id)
            
            # Save file with ID as filename for persistence
            file.stream.seek(0)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], f"{new_id}.pdf"))
            
            return jsonify({
                "success": True,
                "message": "File uploaded and processed.",
                "pdf_id": new_id
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
        
        text_content = pdf_doc.get('extracted_text')
        
        prompt = f"""
        You are a helpful AI teacher. A student has asked a question about a document they've uploaded.
        Your task is to provide a clear and concise answer based ONLY on the provided text from the document.
        Do not use any external knowledge.

        Full Document Text:
        ---
        {text_content}
        ---

        Student's Question: "{user_message}"

        Your Answer:
        """
        response = generate_with_retry(model, prompt)
        ai_response = response.text

        return jsonify({"response": ai_response}), 200
    except Exception as e:
        print(f"Chat API Error: {e}")
        return jsonify({"error": f"An error occurred while getting the AI response: {e}"}), 500

# NEW: YouTube Video Recommendations Endpoint
@app.route('/api/recommend-videos', methods=['POST'])
def recommend_videos():
    """
    Generates YouTube video recommendations based on the content of a selected PDF.
    Uses the Gemini API to analyze the PDF text and suggest relevant educational videos.
    """
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
        You are an expert educational content curator specializing in finding the best YouTube videos for students.
        
        Analyze the following educational text and identify the key topics, concepts, and subject areas covered.
        Based on this analysis, recommend exactly 5 highly relevant, educational YouTube videos that would help 
        a student learn more about these topics.
        
        For each recommendation, provide:
        1. A clear, descriptive title for the video topic (not the actual video title, but what the student should search for)
        2. A YouTube search URL in the format: https://www.youtube.com/results?search_query=YOUR+SEARCH+TERMS
        
        Make sure the search terms are specific, educational, and directly related to the content. Use proper URL encoding 
        (spaces as +, special characters encoded).
        
        Return ONLY a valid JSON object with this exact structure:
        {{
          "recommendations": [
            {{
              "title": "Clear descriptive title",
              "url": "https://www.youtube.com/results?search_query=encoded+search+terms"
            }}
          ]
        }}
        
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
        
    except json.JSONDecodeError as e:
        return jsonify({"error": f"Failed to parse AI response: {e}"}), 500
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
        quiz_attempts_collection.insert_one({
            "pdfId": pdf_id_obj,
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

# NEW ENDPOINT: Serve PDF files
@app.route('/api/pdf/<pdf_id>')
def get_pdf_file(pdf_id):
    """Serve a PDF file by its ID."""
    try:
        if not ObjectId.is_valid(pdf_id):
            return jsonify({"error": "Invalid PDF ID."}), 400
        
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{pdf_id}.pdf")
        if not os.path.exists(pdf_path):
            return jsonify({"error": "PDF file not found."}), 404
        
        return send_from_directory(app.config['UPLOAD_FOLDER'], f"{pdf_id}.pdf")
    except Exception as e:
        return jsonify({"error": f"Error serving PDF: {e}"}), 500

# --- Frontend Serving ---
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)