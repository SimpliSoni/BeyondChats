import os
import uuid
import json
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
# In a serverless environment, only the /tmp directory is writable.
app.config['UPLOAD_FOLDER'] = '/tmp'

# --- Gemini AI and MongoDB Setup ---
try:
    # Configure the Gemini API client
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-pro')

    # Configure MongoDB client
    client = MongoClient(os.getenv("MONGO_URI"))
    db = client.school_reviser_db
    pdfs_collection = db.pdfs
    quiz_attempts_collection = db.quiz_attempts
    print("Successfully connected to MongoDB and configured Gemini API.")
except Exception as e:
    # This will help debug setup issues in the Vercel logs.
    print(f"Error during setup: {e}")

# --- Helper for JSON serialization ---
def serialize_doc(doc):
    """Converts a MongoDB doc to a JSON-serializable format."""
    if doc:
        if '_id' in doc:
            doc['_id'] = str(doc['_id'])
        # Serialize ObjectId and datetime objects
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                doc[key] = str(value)
            if isinstance(value, datetime.datetime):
                # Convert datetime to ISO 8601 string format
                doc[key] = value.isoformat()
    return doc

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
        unique_filename = f"{uuid.uuid4()}_{original_filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        try:
            file.save(filepath)

            with open(filepath, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                extracted_text = "".join(page.extract_text() for page in reader.pages if page.extract_text())

            if not extracted_text:
                 return jsonify({"error": "Could not extract text from PDF."}), 400

            pdf_doc = {
                "filename": original_filename,
                "extracted_text": extracted_text
            }
            result = pdfs_collection.insert_one(pdf_doc)
            return jsonify({
                "success": True,
                "message": "File uploaded and processed.",
                "pdf_id": str(result.inserted_id)
            }), 201
        except Exception as e:
            return jsonify({"error": f"Failed to process PDF: {e}"}), 500
        finally:
            # Clean up the saved file from /tmp
            if os.path.exists(filepath):
                os.remove(filepath)
    else:
        return jsonify({"error": "Invalid file type. Please upload a PDF."}), 400


@app.route('/api/pdfs', methods=['GET'])
def get_pdfs():
    try:
        # Exclude the large extracted_text field from the initial list
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
        Based on the following text from a coursebook, generate a quiz.
        The quiz must contain exactly:
        - 2 Multiple Choice Questions (MCQs)
        - 2 Short Answer Questions (SAQs)
        - 1 Long Answer Question (LAQ)

        Return ONLY a single valid JSON object. Do not include any text or markdown formatting before or after the JSON.
        The JSON object must have three keys: "mcqs", "saqs", and "laqs".

        For each MCQ, provide a "question", an array of string "options", and the exact string of the "correctAnswer".
        For each SAQ and LAQ, provide a "question" and a brief "idealAnswer" for scoring reference.

        Text content:
        ---
        {text_content}
        ---
        """
        response = model.generate_content(prompt)
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "")
        
        # Add robust JSON parsing
        try:
            quiz_data = json.loads(cleaned_response)
        except json.JSONDecodeError:
            return jsonify({"error": "Failed to parse AI response as JSON. Please try again."}), 500
            
        return jsonify(quiz_data), 200

    except Exception as e:
        return jsonify({"error": f"Failed to generate quiz: {e}"}), 500

@app.route('/api/score-quiz', methods=['POST'])
def score_quiz():
    data = request.get_json()
    user_answers = data.get('userAnswers')
    quiz_questions = data.get('quizQuestions')
    pdf_id_str = data.get('pdfId')

    prompt = f"""
    A student has submitted answers to a quiz. Evaluate their submission based on the provided questions and ideal answers.
    
    Quiz Questions and Ideal Answers:
    ---
    {json.dumps(quiz_questions, indent=2)}
    ---

    Student's Answers:
    ---
    {json.dumps(user_answers, indent=2)}
    ---

    Provide a final score as a percentage (e.g., "85%") and detailed, constructive feedback for each question in a markdown formatted string.
    
    Return ONLY a single valid JSON object with three keys: "score", "overallFeedback", and "questionFeedback".
    - "score" should be a string (e.g., "85%").
    - "overallFeedback" should be a brief, encouraging summary of the student's performance.
    - "questionFeedback" should be an array of objects, where each object has a "question" and a "feedback" string.
    """
    try:
        response = model.generate_content(prompt)
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "")

        # Add robust JSON parsing
        try:
            scoring_result = json.loads(cleaned_response)
        except json.JSONDecodeError:
            return jsonify({"error": "Failed to parse AI scoring response as JSON. Please try again."}), 500

        # Ensure pdfId is always stored as an ObjectId for consistency
        pdf_id_obj = ObjectId(pdf_id_str) if pdf_id_str and ObjectId.is_valid(pdf_id_str) else None

        # Store the attempt in the database
        quiz_attempts_collection.insert_one({
            "pdfId": pdf_id_obj,
            "answers": user_answers,
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