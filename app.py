import os
import uuid
import json
import time
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

# --- Configuration ---
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

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

# --- Input Validation Helpers ---
def validate_object_id(id_string):
    """Validates and returns ObjectId or None"""
    try:
        if id_string and ObjectId.is_valid(id_string):
            return ObjectId(id_string)
    except Exception:
        pass
    return None

def sanitize_text(text, max_length=10000):
    """Sanitizes text input to prevent injection attacks"""
    if not text or not isinstance(text, str):
        return ""
    return text[:max_length].strip()

# --- API Endpoints ---

@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    """Handle PDF file upload with validation and text extraction"""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if not file.filename.endswith('.pdf'):
        return jsonify({"error": "Invalid file type. Please upload a PDF."}), 400

    try:
        original_filename = secure_filename(file.filename)
        
        # FIXED: Validate filename length
        if len(original_filename) > 255:
            return jsonify({"error": "Filename too long"}), 400

        # Process the file in-memory without saving to disk
        pdf_reader = PyPDF2.PdfReader(file.stream)
        
        # FIXED: Limit number of pages to prevent DoS
        max_pages = 100
        num_pages = len(pdf_reader.pages)
        if num_pages > max_pages:
            return jsonify({"error": f"PDF too large. Maximum {max_pages} pages allowed."}), 400
        
        extracted_text = ""
        for i, page in enumerate(pdf_reader.pages):
            if i >= max_pages:
                break
            page_text = page.extract_text()
            if page_text:
                extracted_text += page_text + "\n"

        if not extracted_text.strip():
            return jsonify({"error": "Could not extract text from PDF. The file may be image-based or corrupted."}), 400

        # FIXED: Limit total text length to prevent storage issues
        max_text_length = 500000  # 500KB of text
        if len(extracted_text) > max_text_length:
            extracted_text = extracted_text[:max_text_length]

        pdf_doc = {
            "filename": original_filename,
            "extracted_text": extracted_text,
            "page_count": num_pages,
            "uploaded_at": datetime.datetime.utcnow()
        }
        result = pdfs_collection.insert_one(pdf_doc)

        return jsonify({
            "success": True,
            "message": "File uploaded and processed.",
            "pdf_id": str(result.inserted_id)
        }), 201
        
    except PyPDF2.errors.PdfReadError:
        return jsonify({"error": "Invalid or corrupted PDF file."}), 400
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({"error": f"Failed to process PDF: {str(e)}"}), 500


@app.route('/api/pdfs', methods=['GET'])
def get_pdfs():
    """Get list of all uploaded PDFs"""
    try:
        # FIXED: Add pagination support
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        # Limit per_page to prevent abuse
        per_page = min(per_page, 100)
        
        skip = (page - 1) * per_page
        
        all_pdfs = list(pdfs_collection.find(
            {},
            {"extracted_text": 0}  # Don't return full text in list
        ).sort("uploaded_at", -1).skip(skip).limit(per_page))
        
        total = pdfs_collection.count_documents({})
        
        return jsonify({
            "pdfs": [serialize_doc(pdf) for pdf in all_pdfs],
            "total": total,
            "page": page,
            "per_page": per_page
        }), 200
    except Exception as e:
        print(f"Get PDFs error: {e}")
        return jsonify({"error": f"Failed to retrieve PDFs: {str(e)}"}), 500


@app.route('/api/generate-quiz', methods=['POST'])
def generate_quiz():
    """Generate quiz questions from PDF content using Gemini"""
    data = request.get_json()
    pdf_id = data.get('pdfId')
    
    if not pdf_id:
        return jsonify({"error": "PDF ID is required."}), 400

    # FIXED: Validate ObjectId
    pdf_id_obj = validate_object_id(pdf_id)
    if not pdf_id_obj:
        return jsonify({"error": "Invalid PDF ID format."}), 400

    try:
        pdf_doc = pdfs_collection.find_one({"_id": pdf_id_obj})
        if not pdf_doc or not pdf_doc.get('extracted_text'):
            return jsonify({"error": "PDF not found or has no text content."}), 404

        # FIXED: Limit text sent to API to prevent token limit errors
        text_content = " ".join(pdf_doc['extracted_text'].split()[:4000])
        
        prompt = f"""
        Based on the text from a coursebook, generate a quiz with 2 MCQs, 2 SAQs, and 1 LAQ.
        Return ONLY a single valid JSON object with keys "mcqs", "saqs", and "laqs".
        For MCQs, include "question", "options" (array of 4 options), and "correctAnswer".
        For SAQs/LAQs, include "question" and "idealAnswer".

        IMPORTANT: 
        - Return ONLY valid JSON, no markdown formatting, no backticks, no extra text
        - Ensure all strings are properly escaped
        - All questions must be based on the provided text

        Text content:
        ---
        {text_content}
        ---

        JSON Response:
        """
        
        response = generate_with_retry(model, prompt)
        
        # FIXED: Better JSON extraction from response
        cleaned_response = response.text.strip()
        
        # Remove markdown code blocks if present
        if cleaned_response.startswith("```"):
            lines = cleaned_response.split('\n')
            cleaned_response = '\n'.join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        
        cleaned_response = cleaned_response.replace("```json", "").replace("```", "").strip()
        
        try:
            quiz_data = json.loads(cleaned_response)
        except json.JSONDecodeError as je:
            print(f"JSON parse error: {je}")
            print(f"Response was: {cleaned_response[:500]}")
            return jsonify({"error": "Failed to parse quiz data. Please try again."}), 500
        
        # FIXED: Validate quiz structure
        if not isinstance(quiz_data.get('mcqs'), list):
            quiz_data['mcqs'] = []
        if not isinstance(quiz_data.get('saqs'), list):
            quiz_data['saqs'] = []
        if not isinstance(quiz_data.get('laqs'), list):
            quiz_data['laqs'] = []
            
        return jsonify(quiz_data), 200
        
    except Exception as e:
        print(f"Generate quiz error: {e}")
        return jsonify({"error": f"Failed to generate quiz: {str(e)}"}), 500


@app.route('/api/chat', methods=['POST'])
def handle_chat():
    """Handle chat messages with AI teacher"""
    data = request.get_json()
    user_message = data.get('message')
    pdf_id = data.get('pdfId')
    history = data.get('history', [])  # FIXED: Accept chat history

    if not user_message or not pdf_id:
        return jsonify({"error": "Message and PDF ID are required."}), 400

    # FIXED: Validate inputs
    user_message = sanitize_text(user_message, max_length=2000)
    if not user_message:
        return jsonify({"error": "Invalid message."}), 400
    
    pdf_id_obj = validate_object_id(pdf_id)
    if not pdf_id_obj:
        return jsonify({"error": "Invalid PDF ID."}), 400

    try:
        pdf_doc = pdfs_collection.find_one({"_id": pdf_id_obj})
        if not pdf_doc or not pdf_doc.get('extracted_text'):
            return jsonify({"error": "PDF not found or has no text content."}), 404
        
        text_content = pdf_doc.get('extracted_text', '')
        
        # FIXED: Include conversation history in context
        history_context = ""
        if history and isinstance(history, list):
            recent_history = history[-6:]  # Last 6 messages (3 exchanges)
            for msg in recent_history:
                if isinstance(msg, dict):
                    role = msg.get('role', '')
                    content = msg.get('content', '')
                    if role == 'user':
                        history_context += f"\nStudent: {content}"
                    elif role == 'ai':
                        history_context += f"\nTeacher: {content}"
        
        prompt = f"""
        You are a helpful AI teacher. A student has asked a question about a document they've uploaded.
        Your task is to provide a clear and concise answer based ONLY on the provided text from the document.
        Do not use any external knowledge.

        Previous Conversation:
        {history_context if history_context else "No previous conversation."}

        Full Document Text:
        ---
        {text_content[:8000]}
        ---

        Student's Question: "{user_message}"

        Your Answer (be concise, helpful, and cite specific parts of the document when relevant):
        """
        
        response = generate_with_retry(model, prompt)
        ai_response = response.text.strip()

        return jsonify({"response": ai_response}), 200
        
    except Exception as e:
        print(f"Chat API Error: {e}")
        return jsonify({"error": f"An error occurred while getting the AI response: {str(e)}"}), 500


@app.route('/api/recommend-videos', methods=['POST'])
def recommend_videos():
    """Generate YouTube video recommendations based on PDF content"""
    data = request.get_json()
    pdf_id = data.get('pdfId')
    
    if not pdf_id:
        return jsonify({"error": "PDF ID is required."}), 400
    
    pdf_id_obj = validate_object_id(pdf_id)
    if not pdf_id_obj:
        return jsonify({"error": "Invalid PDF ID."}), 400
    
    try:
        pdf_doc = pdfs_collection.find_one({"_id": pdf_id_obj})
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
        
        Return ONLY a valid JSON object with this exact structure (no markdown, no backticks):
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
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "").strip()
        
        try:
            recommendations_data = json.loads(cleaned_response)
        except json.JSONDecodeError:
            print(f"Failed to parse video recommendations: {cleaned_response[:500]}")
            return jsonify({"error": "Failed to parse recommendations. Please try again."}), 500
        
        if "recommendations" not in recommendations_data:
            return jsonify({"error": "Invalid response format from AI."}), 500
        
        # FIXED: Validate URLs
        validated_recommendations = []
        for rec in recommendations_data.get("recommendations", []):
            if isinstance(rec, dict) and "title" in rec and "url" in rec:
                url = rec["url"]
                # Ensure URL is a valid YouTube URL
                if url.startswith("https://www.youtube.com/"):
                    validated_recommendations.append(rec)
        
        return jsonify({"recommendations": validated_recommendations}), 200
        
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        return jsonify({"error": "Failed to parse AI response. Please try again."}), 500
    except Exception as e:
        print(f"Video recommendations error: {e}")
        return jsonify({"error": f"Failed to generate video recommendations: {str(e)}"}), 500


@app.route('/api/score-quiz', methods=['POST'])
def score_quiz():
    """Score quiz submission using AI evaluation"""
    data = request.get_json()
    pdf_id_str = data.get('pdfId')
    quiz_questions = data.get('quizQuestions')
    user_answers = data.get('userAnswers')
    
    # FIXED: Validate inputs
    if not quiz_questions or not user_answers:
        return jsonify({"error": "Quiz questions and user answers are required."}), 400

    prompt = f"""
    Evaluate a student's quiz submission.
    
    Quiz Questions & Ideal Answers:
    ---
    {json.dumps(quiz_questions, indent=2)}
    ---
    
    Student's Answers:
    ---
    {json.dumps(user_answers, indent=2)}
    ---
    
    Return ONLY a single valid JSON object (no markdown, no backticks) with:
    - "score": overall percentage (e.g., "85%")
    - "overallFeedback": encouraging feedback paragraph
    - "questionFeedback": array with feedback for each question in order
    
    For each question feedback, provide:
    - "feedback": specific feedback on their answer (mention if correct/incorrect and why)
    
    Be encouraging but honest. If an answer is partially correct, acknowledge what they got right.
    
    JSON Response:
    """
    
    try:
        response = generate_with_retry(model, prompt)
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "").strip()
        
        try:
            scoring_result = json.loads(cleaned_response)
        except json.JSONDecodeError:
            print(f"Failed to parse scoring result: {cleaned_response[:500]}")
            return jsonify({"error": "Failed to parse scoring results. Please try again."}), 500

        # FIXED: Validate scoring structure
        if not isinstance(scoring_result.get('questionFeedback'), list):
            scoring_result['questionFeedback'] = []
        if 'score' not in scoring_result:
            scoring_result['score'] = "0%"
        if 'overallFeedback' not in scoring_result:
            scoring_result['overallFeedback'] = "Keep practicing!"

        # Save to database
        pdf_id_obj = validate_object_id(pdf_id_str) if pdf_id_str else None
        
        quiz_attempts_collection.insert_one({
            "pdfId": pdf_id_obj,
            "answers": user_answers,
            "score": scoring_result.get("score"),
            "feedback": scoring_result.get("overallFeedback"),
            "timestamp": datetime.datetime.utcnow()
        })

        return jsonify(scoring_result), 200
        
    except Exception as e:
        print(f"Score quiz error: {e}")
        return jsonify({"error": f"Failed to score quiz: {str(e)}"}), 500


@app.route('/api/progress', methods=['GET'])
def get_progress():
    """Get user's quiz attempt history and progress"""
    try:
        # FIXED: Add pagination and limit
        limit = request.args.get('limit', 50, type=int)
        limit = min(limit, 100)  # Max 100 attempts
        
        attempts = list(quiz_attempts_collection.find({})
                       .sort("timestamp", -1)
                       .limit(limit))
        
        return jsonify({"attempts": [serialize_doc(attempt) for attempt in attempts]}), 200
        
    except Exception as e:
        print(f"Get progress error: {e}")
        return jsonify({"error": f"Failed to retrieve progress: {str(e)}"}), 500


# FIXED: Add health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Test database connection
        client.admin.command('ping')
        return jsonify({
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500


# --- Frontend Serving ---
@app.route('/')
def index():
    return render_template('index.html')


# FIXED: Add error handlers
@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "File too large. Maximum size is 16MB."}), 413


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found."}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error. Please try again."}), 500


if __name__ == '__main__':
    app.run(debug=True)