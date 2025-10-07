import os
import uuid
import json
from flask import Flask, request, jsonify, send_from_directory, render_template
from pymongo import MongoClient
from bson import ObjectId
import PyPDF2
import openai
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

# --- Initialization ---
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='static')

# --- Configuration ---
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# --- OpenAI and MongoDB Setup ---
try:
    openai.api_key = os.getenv("OPENAI_API_KEY")
    client = MongoClient(os.getenv("MONGO_URI"))
    db = client.school_reviser_db
    pdfs_collection = db.pdfs
    quiz_attempts_collection = db.quiz_attempts
    print("Successfully connected to MongoDB and configured OpenAI.")
except Exception as e:
    print(f"Error during setup: {e}")

# --- Helper for JSON serialization ---
def serialize_doc(doc):
    """Converts a MongoDB doc to a JSON-serializable format."""
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
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
        # Create a unique filename to prevent overwrites
        unique_filename = f"{uuid.uuid4()}_{original_filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)

        try:
            with open(filepath, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                extracted_text = "".join(page.extract_text() for page in reader.pages)
            
            pdf_doc = {
                "filename": original_filename,
                "filepath": os.path.join('uploads', unique_filename).replace("\\", "/"), # Use forward slashes for URLs
                "extracted_text": extracted_text
            }
            pdfs_collection.insert_one(pdf_doc)
            return jsonify({"success": True, "message": "File uploaded and processed."}), 201
        except Exception as e:
            return jsonify({"error": f"Failed to process PDF: {e}"}), 500
    
    return jsonify({"error": "Invalid file type. Please upload a PDF."}), 400

@app.route('/api/pdfs', methods=['GET'])
def get_pdfs():
    try:
        all_pdfs = list(pdfs_collection.find({}, {"extracted_text": 0})) # Exclude large text field
        return jsonify([serialize_doc(pdf) for pdf in all_pdfs]), 200
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

        text_content = pdf_doc['extracted_text'][:8000] # Limit context to avoid token limits

        prompt = f"""
        Based on the following text from a coursebook, generate a quiz.
        The quiz must contain exactly:
        - 2 Multiple Choice Questions (MCQs)
        - 2 Short Answer Questions (SAQs)
        - 1 Long Answer Question (LAQ)

        Return ONLY a single valid JSON object. Do not include any text or markdown formatting before or after the JSON.
        The JSON object must have three keys: "mcqs", "saqs", and "laqs".
        
        For each MCQ, provide a "question", an array of "options", and the "correctAnswer".
        For each SAQ and LAQ, provide just a "question".

        Text content:
        ---
        {text_content}
        ---
        """

        response = openai.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[
                {"role": "system", "content": "You are a helpful assistant designed to generate quizzes in JSON format."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        quiz_data = json.loads(response.choices[0].message.content)
        return jsonify(quiz_data), 200

    except Exception as e:
        return jsonify({"error": f"Failed to generate quiz: {e}"}), 500

@app.route('/api/score-quiz', methods=['POST'])
def score_quiz():
    data = request.get_json()
    # In a real app, you would save this attempt to the database
    # quiz_attempts_collection.insert_one(data)
    print("Received quiz attempt:", data) # For demonstration
    return jsonify({"success": True, "message": "Quiz attempt recorded."}), 200


# --- Frontend Serving ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True)