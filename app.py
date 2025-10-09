import os
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
    raise

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
            response = model.generate_content(prompt)
            if not response or not response.text:
                raise Exception("Empty response from Gemini API")
            return response
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
    Lightweight keyword-based retrieval with improved scoring.
    """
    if not text or not query:
        return text[:2000] if text else ""
    
    def tokenize(s):
        return re.findall(r'\b\w+\b', s.lower())
    
    query_words = set(tokenize(query))
    if not query_words:
        return text[:2000]
    
    words = text.split()
    if not words:
        return ""
    
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
    
    return relevant_text if relevant_text.strip() else (chunks[0] if chunks else text[:2000])

# --- API Endpoints ---

@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    """Upload and process PDF file"""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part in request"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        if not file.filename.lower().endswith('.pdf'):
            return jsonify({"error": "Invalid file type. Only PDF files are allowed."}), 400

        original_filename = secure_filename(file.filename)
        
        try:
            # Read PDF content
            pdf_reader = PyPDF2.PdfReader(file.stream)
            
            # Extract text from all pages
            extracted_text = ""
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    extracted_text += page_text + "\n"
            
            if not extracted_text.strip():
                return jsonify({"error": "Could not extract text from PDF. The file may be empty or contain only images."}), 400
            
            # Store in MongoDB
            pdf_doc = {
                "filename": original_filename,
                "extracted_text": extracted_text,
                "page_count": len(pdf_reader.pages),
                "uploaded_at": datetime.datetime.utcnow()
            }
            result = pdfs_collection.insert_one(pdf_doc)
            
            return jsonify({
                "success": True,
                "message": "PDF uploaded and processed successfully.",
                "pdf_id": str(result.inserted_id),
                "filename": original_filename,
                "page_count": len(pdf_reader.pages)
            }), 201
            
        except Exception as e:
            print(f"PDF processing error: {e}")
            return jsonify({"error": f"Failed to process PDF: {str(e)}"}), 500
            
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@app.route('/api/pdfs', methods=['GET'])
def get_pdfs():
    """Retrieve all PDFs (without full text content)"""
    try:
        all_pdfs = list(pdfs_collection.find({}, {
            "extracted_text": 0  # Exclude large text field
        }).sort("uploaded_at", -1))
        
        return jsonify({
            "success": True,
            "pdfs": [serialize_doc(pdf) for pdf in all_pdfs]
        }), 200
    except Exception as e:
        print(f"Error fetching PDFs: {e}")
        return jsonify({"error": f"Failed to retrieve PDFs: {str(e)}"}), 500

@app.route('/api/generate-quiz', methods=['POST'])
def generate_quiz():
    """Generate quiz questions from PDF content"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON data"}), 400
            
        pdf_id = data.get('pdfId')
        if not pdf_id:
            return jsonify({"error": "PDF ID is required."}), 400
        
        if not ObjectId.is_valid(pdf_id):
            return jsonify({"error": "Invalid PDF ID format."}), 400
        
        pdf_doc = pdfs_collection.find_one({"_id": ObjectId(pdf_id)})
        if not pdf_doc:
            return jsonify({"error": "PDF not found."}), 404
            
        if not pdf_doc.get('extracted_text'):
            return jsonify({"error": "PDF has no extractable text content."}), 400

        # Limit text content to prevent token overflow
        text_content = " ".join(pdf_doc['extracted_text'].split()[:4000])
        
        prompt = f"""
You are an expert educational quiz generator. Based on the following text from a coursebook, generate a comprehensive quiz.

Generate exactly:
- 2 Multiple Choice Questions (MCQs)
- 2 Short Answer Questions (SAQs)
- 1 Long Answer Question (LAQ)

Return ONLY a valid JSON object with this exact structure:
{{
    "mcqs": [
        {{
            "question": "question text",
            "options": ["option1", "option2", "option3", "option4"],
            "correctAnswer": "correct option text"
        }}
    ],
    "saqs": [
        {{
            "question": "question text",
            "idealAnswer": "detailed ideal answer"
        }}
    ],
    "laqs": [
        {{
            "question": "question text",
            "idealAnswer": "comprehensive ideal answer"
        }}
    ]
}}

Rules:
- Make questions relevant to the content
- MCQ options should be plausible distractors
- Ideal answers should be comprehensive
- Questions should test understanding, not just memorization

Text Content:
---
{text_content}
---

JSON Response:
"""
        
        response = generate_with_retry(model, prompt)
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "").strip()
        
        try:
            quiz_data = json.loads(cleaned_response)
            
            # Validate quiz structure
            if not isinstance(quiz_data, dict):
                raise ValueError("Response is not a JSON object")
            
            if "mcqs" not in quiz_data or "saqs" not in quiz_data or "laqs" not in quiz_data:
                raise ValueError("Missing required quiz sections")
            
            return jsonify(quiz_data), 200
            
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            print(f"Response: {cleaned_response}")
            return jsonify({"error": "Failed to parse quiz data from AI response"}), 500
            
    except Exception as e:
        print(f"Quiz generation error: {e}")
        return jsonify({"error": f"Failed to generate quiz: {str(e)}"}), 500

@app.route('/api/chat', methods=['POST'])
def handle_chat():
    """Handle chat messages with RAG-based context"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON data"}), 400
            
        user_message = data.get('message')
        pdf_id = data.get('pdfId')
        
        if not user_message or not user_message.strip():
            return jsonify({"error": "Message is required."}), 400
            
        if not pdf_id:
            return jsonify({"error": "PDF ID is required."}), 400
        
        if not ObjectId.is_valid(pdf_id):
            return jsonify({"error": "Invalid PDF ID format."}), 400
        
        pdf_doc = pdfs_collection.find_one({"_id": ObjectId(pdf_id)})
        if not pdf_doc:
            return jsonify({"error": "PDF not found."}), 404
            
        if not pdf_doc.get('extracted_text'):
            return jsonify({"error": "PDF has no extractable text content."}), 404
        
        full_text = pdf_doc.get('extracted_text', '')
        relevant_text = simple_keyword_search(full_text, user_message, chunk_size=500, top_k=3)
        
        prompt = f"""
You are a helpful and knowledgeable AI teacher. A student has asked you a question about their study material.

Your task:
1. Provide a clear, accurate, and educational answer based ONLY on the provided context
2. Include a direct quote from the context that supports your answer
3. If the context doesn't contain relevant information, say so honestly

Return ONLY a valid JSON object with this exact structure:
{{
    "answer": "Your clear and helpful answer to the student",
    "citation": "A direct, verbatim quote from the context that supports your answer"
}}

Context from Document:
---
{relevant_text}
---

Student's Question: "{user_message}"

JSON Response:
"""
        
        response = generate_with_retry(model, prompt)
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "").strip()
        
        try:
            ai_data = json.loads(cleaned_response)
            
            # Validate response structure
            if not isinstance(ai_data, dict):
                raise ValueError("Response is not a JSON object")
            
            # Ensure required fields exist
            if "answer" not in ai_data:
                ai_data["answer"] = cleaned_response
            if "citation" not in ai_data:
                ai_data["citation"] = relevant_text[:200] + "..."
            
            return jsonify(ai_data), 200
            
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return jsonify({
                "answer": cleaned_response,
                "citation": relevant_text[:200] + "..."
            }), 200
            
    except Exception as e:
        print(f"Chat API Error: {e}")
        return jsonify({"error": f"An error occurred while processing your request: {str(e)}"}), 500

@app.route('/api/recommend-videos', methods=['POST'])
def recommend_videos():
    """Generate YouTube video recommendations based on PDF content"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON data"}), 400
            
        pdf_id = data.get('pdfId')
        if not pdf_id:
            return jsonify({"error": "PDF ID is required."}), 400
        
        if not ObjectId.is_valid(pdf_id):
            return jsonify({"error": "Invalid PDF ID format."}), 400
        
        pdf_doc = pdfs_collection.find_one({"_id": ObjectId(pdf_id)})
        if not pdf_doc:
            return jsonify({"error": "PDF not found."}), 404
            
        if not pdf_doc.get('extracted_text'):
            return jsonify({"error": "PDF has no extractable text content."}), 404
        
        text_content = " ".join(pdf_doc['extracted_text'].split()[:3000])
        
        prompt = f"""
You are an expert educational content curator. Analyze the following educational text and recommend exactly 5 relevant YouTube videos that would help students learn this material.

For each video, provide:
- A descriptive title (what topic/concept to search for)
- A YouTube search URL (format: https://www.youtube.com/results?search_query=YOUR+SEARCH+TERMS)

Return ONLY a valid JSON object with this exact structure:
{{
    "recommendations": [
        {{
            "title": "Video topic/title",
            "url": "https://www.youtube.com/results?search_query=..."
        }}
    ]
}}

Guidelines:
- Focus on educational channels and tutorials
- Make search terms specific and relevant
- Replace spaces with + in URLs
- Recommend diverse aspects of the topic

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
            
            if not isinstance(recommendations_data, dict) or "recommendations" not in recommendations_data:
                raise ValueError("Invalid response structure")
            
            if not isinstance(recommendations_data["recommendations"], list):
                raise ValueError("Recommendations must be a list")
            
            # Validate each recommendation
            for rec in recommendations_data["recommendations"]:
                if not isinstance(rec, dict) or "title" not in rec or "url" not in rec:
                    raise ValueError("Invalid recommendation format")
            
            return jsonify(recommendations_data), 200
            
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Video recommendation parsing error: {e}")
            return jsonify({"error": "Failed to parse video recommendations"}), 500
            
    except Exception as e:
        print(f"Video recommendation error: {e}")
        return jsonify({"error": f"Failed to generate video recommendations: {str(e)}"}), 500

@app.route('/api/score-quiz', methods=['POST'])
def score_quiz():
    """Score quiz submission and provide detailed feedback"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON data"}), 400
            
        pdf_id_str = data.get('pdfId')
        quiz_questions = data.get('quizQuestions')
        user_answers = data.get('userAnswers')
        
        if not all([quiz_questions, user_answers]):
            return jsonify({"error": "Quiz questions and user answers are required."}), 400
        
        prompt = f"""
You are an expert educator evaluating a student's quiz submission.

Quiz Questions with Ideal Answers:
---
{json.dumps(quiz_questions, indent=2)}
---

Student's Answers:
---
{json.dumps(user_answers, indent=2)}
---

Evaluate the submission and return ONLY a valid JSON object with this exact structure:
{{
    "score": "X%",
    "overallFeedback": "Comprehensive feedback about their overall performance",
    "questionFeedback": [
        {{
            "question": "Question text",
            "userAnswer": "Student's answer",
            "isCorrect": true/false,
            "feedback": "Specific feedback for this question"
        }}
    ]
}}

Scoring Guidelines:
- MCQs: Full credit for exact match, zero otherwise
- SAQs/LAQs: Partial credit based on accuracy, completeness, and understanding
- Provide constructive, encouraging feedback
- Be specific about what was correct and what needs improvement
- Give actionable advice for improvement

JSON Response:
"""
        
        response = generate_with_retry(model, prompt)
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "").strip()
        
        try:
            scoring_result = json.loads(cleaned_response)
            
            # Validate scoring structure
            if not isinstance(scoring_result, dict):
                raise ValueError("Response is not a JSON object")
            
            if "score" not in scoring_result:
                scoring_result["score"] = "0%"
            if "overallFeedback" not in scoring_result:
                scoring_result["overallFeedback"] = "Quiz completed."
            
            # Store quiz attempt in database
            pdf_id_obj = None
            pdf_filename = "Unknown PDF"
            
            if pdf_id_str and ObjectId.is_valid(pdf_id_str):
                pdf_id_obj = ObjectId(pdf_id_str)
                pdf_doc = pdfs_collection.find_one({"_id": pdf_id_obj})
                if pdf_doc:
                    pdf_filename = pdf_doc.get("filename", "Unknown PDF")
            
            quiz_attempts_collection.insert_one({
                "pdfId": pdf_id_obj,
                "pdf_filename": pdf_filename,
                "answers": user_answers,
                "score": scoring_result.get("score"),
                "feedback": scoring_result.get("overallFeedback"),
                "timestamp": datetime.datetime.utcnow()
            })
            
            return jsonify(scoring_result), 200
            
        except json.JSONDecodeError as e:
            print(f"Scoring JSON parsing error: {e}")
            return jsonify({"error": "Failed to parse scoring results"}), 500
            
    except Exception as e:
        print(f"Scoring error: {e}")
        return jsonify({"error": f"Failed to score quiz: {str(e)}"}), 500

@app.route('/api/progress', methods=['GET'])
def get_progress():
    """Retrieve user's quiz progress and statistics"""
    try:
        attempts = list(quiz_attempts_collection.find({}).sort("timestamp", -1).limit(50))
        
        return jsonify({
            "success": True,
            "attempts": [serialize_doc(attempt) for attempt in attempts]
        }), 200
    except Exception as e:
        print(f"Progress fetch error: {e}")
        return jsonify({"error": f"Failed to retrieve progress: {str(e)}"}), 500

# --- Frontend Serving ---
@app.route('/')
def index():
    """Serve the main application page"""
    return render_template('index.html')

@app.route('/health')
def health_check():
    """Health check endpoint for monitoring"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }), 200

# --- Error Handlers ---
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "File size exceeds 16MB limit"}), 413

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)