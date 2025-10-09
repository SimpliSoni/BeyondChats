# BeyondChats

# BeyondChats FSWD Assignment: AI Revision Assistant

This project is a fully functional, responsive web application built to help students revise from their coursebooks by generating quizzes from uploaded PDF documents.

**Live URL:** [Insert Your Deployed URL Here]

---

## Features Implemented

### Must-Have Features (100% Covered)
-   **✅ Source Selector:** Users can select from a list of previously uploaded PDFs.
-   **✅ PDF Uploader:** A drag-and-drop interface allows users to upload their own PDF coursebooks.
-   **✅ PDF Viewer:** An embedded viewer displays the content of newly uploaded PDFs (serverless limitation: preview only available for current session uploads).
-   **✅ Quiz Generator Engine:**
    -   Generates Multiple Choice, Short Answer, and Long Answer questions directly from the PDF content using the Gemini API.
    -   Renders the quiz in a clean, user-friendly format.
    -   Captures and submits user answers.
    -   Scores submissions and stores attempts in a MongoDB database.
    -   Provides AI-generated feedback and explanations for each question.
-   **✅ Progress Tracking:**
    -   A dedicated "Progress" tab shows a history of all quiz attempts.
    -   Displays key metrics like total attempts and average score.

### UI/UX & Responsiveness
-   **🎨 Modern UI/UX:** The interface is inspired by modern web applications like ChatGPT, with a clean sidebar/main content layout.
-   **📱 Fully Responsive:** The layout seamlessly adapts to mobile, tablet, and desktop screens.
-   **🌓 Light/Dark Mode:** Includes a theme toggler for user preference.
-   **💬 User Feedback:** Incorporates loading spinners, progress bars, and toast notifications to keep the user informed.

---

## Tech Stack & Architecture

This project uses a classic and robust client-server architecture optimized for serverless deployment.

-   **Backend:** **Flask (Python)**
    -   A lightweight and powerful framework for building the REST API.
-   **Database:** **MongoDB**
    -   A flexible NoSQL database, perfect for storing PDF metadata and quiz attempts. `PyMongo` is used as the driver.
-   **Frontend:** **Vanilla HTML, CSS, and JavaScript**
    -   This choice was made deliberately to showcase strong foundational skills in core web technologies without relying on a framework. It demonstrates proficiency in DOM manipulation, asynchronous API calls (`fetch`), and state management from first principles.
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

-   **Vanilla JS vs. a Framework:** I chose to use vanilla JavaScript to demonstrate strong foundational web development skills. While a framework like React could offer more complex state management, the chosen approach was faster to implement for this scope and proves a deeper understanding of the underlying browser APIs.
-   **Gemini API for Scoring:** Instead of simple string matching, I used a second call to the Gemini API for scoring. This provides more nuanced, intelligent feedback, which is a significant value-add for a learning tool, even if it introduces a slight delay.
-   **No User Authentication:** To focus on the core features required by the assignment within the given timeframe, a user authentication system was intentionally omitted. All data is currently public.
-   **In-Memory PDF Processing:** For serverless deployment compatibility, PDFs are processed entirely in-memory without persistent file storage. This is a trade-off between deployment simplicity and the ability to re-view uploaded PDFs.

---

## LLM Usage

Large Language Models (Google Gemini) were used extensively and aggressively to meet the project's tight deadline, as encouraged by the assignment.

-   **Code Generation:** The Gemini API was prompted to generate boilerplate code for the Flask backend, including API endpoint structures and database connection logic.
-   **Frontend Logic:** It assisted in writing complex JavaScript functions for DOM manipulation, asynchronous API calls, and dynamic HTML rendering.
-   **UI/UX Ideas:** The overall UI design was refined based on suggestions and CSS code generated by the LLM.
-   **Debugging:** The LLM was used as a debugging partner to identify issues in both Python and JavaScript code, significantly speeding up the development process.
-   **Serverless Adaptation:** LLM assistance was crucial in adapting the application for serverless deployment constraints.