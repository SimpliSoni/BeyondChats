# BeyondChats

# BeyondChats FSWD Assignment: AI Revision Assistant

This project is a fully functional, responsive web application built to help students revise from their coursebooks by generating quizzes from uploaded PDF documents.

**Live URL:** https://beyondchats-ochre.vercel.app

---
/
## Features Implemented

### Must-Have Features (100% Covered)

- **✅ Source Selector:** Users can select from a list of previously uploaded PDFs. A dropdown menu allows for easy switching between different study materials.
- **✅ PDF Uploader:** A drag-and-drop interface allows users to upload their own PDF coursebooks. The backend processes the PDF to extract text for use in quizzes and chats.
- **✅ PDF Viewer:** An embedded viewer displays the content of newly uploaded PDFs, allowing users to reference the material directly within the app. *(Note: Due to serverless limitations, the preview is only available for the currently uploaded file in a session.)*
- **✅ Quiz Generator Engine:**
    - Generates Multiple Choice, Short Answer, and Long Answer questions directly from the PDF content using the Gemini API.
    - Renders the quiz in a clean, user-friendly format, capturing and submitting user answers.
    - Scores submissions using the AI for nuanced evaluation and stores all attempts in a MongoDB database for tracking.
    - Provides AI-generated feedback and explanations for each question to help users understand the topics better.
    - Includes a "New Quiz" button to allow users to generate a fresh set of questions on demand.
- **✅ Progress Tracking:**
    - A dedicated "Progress" tab provides a dashboard to track the user's learning journey.
    - It displays a history of all quiz attempts, showing the PDF name, date, and score.
    - Key metrics like total attempts and average score are prominently displayed to give users a quick overview of their performance.

### Nice-to-Have Features (100% Covered)

- **✅ Chat UI (ChatGPT-inspired):** A complete, ChatGPT-like interface serves as a virtual teacher for students.
    - Features a left drawer listing all chat histories, a main chat window for conversation, and an input box at the bottom.
    - Users can create new chats or switch between previous conversations seamlessly.
    - The design is clean, modern, and fully mobile-responsive, ensuring a great experience on any device.
- **✅ RAG Answers with Citations:** The AI teaching assistant provides answers based on the content of the selected PDF.
    - To ensure accuracy, the chatbot's answers cite the source material by quoting relevant snippets directly from the document, mimicking a RAG (Retrieval-Augmented Generation) system.
- **✅ YouTube Videos Recommender:** The application enhances the learning experience by recommending relevant educational YouTube videos.
    - Based on the content of the selected PDF, the AI suggests videos that can help the user better understand the topics.

---

## Tech Stack & Architecture

This project uses a classic and robust client-server architecture optimized for serverless deployment.

-   **Backend:** **Flask (Python)**
    -   A lightweight and powerful framework for building the REST API.
-   **Database:** **MongoDB**
    -   A flexible NoSQL database, perfect for storing PDF metadata and quiz attempts. `PyMongo` is used as the driver.
-   **Frontend:** **Vanilla HTML, CSS, and JavaScript**
    -   This choice was made deliberately to showcase strong foundational skills in core web technologies without relying on a framework. It demonstrates proficiency in DOM manipulation, asynchronous logic, and modular JS.
-   **AI Integration:** **Google Gemini API**
    -   Used for the core logic of parsing PDF text to generate questions and for scoring user-submitted answers with detailed feedback.
-   **PDF Processing:** **PyPDF2**
    -   A Python library used on the backend to extract text content from uploaded PDF files in-memory.
-   **Deployment:** **Vercel (Serverless)**
    -   The application is deployed on Vercel's serverless platform, with PDFs processed in-memory to comply with read-only filesystem restrictions.

---

## Serverless Deployment Notes

Due to Vercel's serverless architecture:
- **PDF files are processed in-memory** and not saved to disk
- **PDF preview** is only available for newly uploaded files in the current session
- **Previously uploaded PDFs** can still be used for quiz generation and chat, but their visual preview won't be available after page refresh
- All PDF text content is stored in MongoDB for full functionality

For production deployments requiring persistent PDF storage, consider integrating with cloud storage services like Amazon S3, Google Cloud Storage, or Cloudinary.

---

## How to Run Locally

### Prerequisites
-   Python 3.9+
-   MongoDB Atlas account (or a local MongoDB instance)
-   Google Gemini API Key

### Setup Instructions
1.  **Clone the repository:**
    ```bash
    git clone [your-repo-url]
    cd [repo-name]
    ```

2.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Create the environment file:**
    -   Create a file named `.env` in the root directory.
    -   Add your credentials to this file:
        ```
        MONGO_URI="your_mongodb_connection_string"
        GEMINI_API_KEY="your_gemini_api_key"
        ```

4.  **Run the Flask application:**
    ```bash
    python app.py
    ```

5.  **Open the application:**
    -   Navigate to `http://127.0.0.1:5000` in your web browser.

---

## Deployment to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Set Environment Variables:**
   In the Vercel dashboard, add:
   - `MONGO_URI`
   - `GEMINI_API_KEY`

---

## Project Decisions & Tradeoffs

-   **Vanilla JS vs. a Framework:** I chose to use vanilla JavaScript to demonstrate strong foundational web development skills. While a framework like React could offer more complex state management, this approach highlights expertise in the core technologies.
-   **Gemini API for Scoring:** Instead of simple string matching, I used a second call to the Gemini API for scoring. This provides more nuanced, intelligent feedback, which is a significant value-add for students.
-   **No User Authentication:** To focus on the core features required by the assignment within the given timeframe, a user authentication system was intentionally omitted. All data is currently public and user-agnostic.
-   **In-Memory PDF Processing:** For serverless deployment compatibility, PDFs are processed entirely in-memory without persistent file storage. This is a trade-off between deployment simplicity and long-term scalability.

---

## LLM Usage

Large Language Models such as Claude, Copilot, and Gemini were used extensively and aggressively to meet the project's tight deadline, as encouraged by the assignment.
