/* CSS Variables for Theme */
:root {
    --primary-color: #6366f1;
    --primary-hover: #4f46e5;
    --primary-light: #e0e7ff;
    --secondary-color: #8b5cf6;
    --success-color: #10b981;
    --warning-color: #f59e0b;
    --error-color: #ef4444;
    --info-color: #3b82f6;
    --youtube-red: #ff0000;
    --youtube-hover: #cc0000;
    
    --bg-primary: #ffffff;
    --bg-secondary: #f9fafb;
    --bg-tertiary: #f3f4f6;
    --bg-card: #ffffff;
    
    --text-primary: #111827;
    --text-secondary: #6b7280;
    --text-tertiary: #9ca3af;
    
    --border-color: #e5e7eb;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
    
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Dark Theme */
[data-theme="dark"] {
    --primary-color: #818cf8;
    --primary-hover: #6366f1;
    --primary-light: #312e81;
    --secondary-color: #a78bfa;
    --youtube-red: #ff4444;
    --youtube-hover: #ff0000;
    
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-tertiary: #334155;
    --bg-card: #1e293b;
    
    --text-primary: #f1f5f9;
    --text-secondary: #cbd5e1;
    --text-tertiary: #94a3b8;
    
    --border-color: #334155;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}

/* Global Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg-secondary);
    color: var(--text-primary);
    line-height: 1.6;
    transition: var(--transition);
}

/* Header */
.app-header {
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: var(--shadow-sm);
}

.header-content {
    max-width: 1440px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
}

.logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--primary-color);
}

.logo i {
    font-size: 1.5rem;
}

.header-nav {
    display: flex;
    gap: 0.5rem;
}

.nav-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--transition);
}

.nav-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
}

.nav-btn.active {
    background: var(--primary-light);
    color: var(--primary-color);
}

.theme-toggle {
    width: 40px;
    height: 40px;
    padding: 0;
    justify-content: center;
}

/* Main Layout */
.app-container {
    max-width: 1440px;
    margin: 0 auto;
    display: flex;
    gap: 1.5rem;
    padding: 1.5rem;
    min-height: calc(100vh - 73px);
}

/* Sidebar */
.sidebar {
    width: 320px;
    background: var(--bg-card);
    border-radius: var(--radius-xl);
    padding: 1.5rem;
    height: fit-content;
    position: sticky;
    top: 97px;
    box-shadow: var(--shadow-md);
}

.sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.sidebar-header h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
}

/* Upload Section */
.upload-section {
    margin-bottom: 1.5rem;
}

.upload-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    border: 2px dashed var(--border-color);
    border-radius: var(--radius-lg);
    background: var(--bg-secondary);
    cursor: pointer;
    transition: var(--transition);
}

.upload-area:hover {
    border-color: var(--primary-color);
    background: var(--primary-light);
}

.upload-area i {
    font-size: 2.5rem;
    color: var(--primary-color);
    margin-bottom: 0.75rem;
}

.upload-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.upload-hint {
    font-size: 0.75rem;
    color: var(--text-tertiary);
}

.upload-progress {
    display: none;
    margin-top: 1rem;
}

.upload-progress.active {
    display: block;
}

.progress-bar {
    width: 100%;
    height: 4px;
    background: var(--bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--primary-color);
    width: 0%;
    transition: width 0.3s ease;
}

.progress-text {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
    display: block;
}

/* PDF Selection */
.pdf-section {
    margin-bottom: 1.5rem;
}

.section-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.select-wrapper {
    position: relative;
}

.modern-select {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    color: var(--text-primary);
    cursor: pointer;
    appearance: none;
    transition: var(--transition);
}

.modern-select:hover {
    border-color: var(--primary-color);
}

.modern-select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
}

.select-icon {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
    pointer-events: none;
}

/* Quiz Controls */
.quiz-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
}

/* Buttons */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--transition);
    text-decoration: none;
    line-height: 1;
}

.btn-primary {
    background: var(--primary-color);
    color: white;
}

.btn-primary:hover {
    background: var(--primary-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

.btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
}

.btn-secondary:hover {
    background: var(--bg-secondary);
}

.btn-large {
    padding: 1rem 1.5rem;
    font-size: 0.9375rem;
    width: 100%;
}

.btn-icon {
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--transition);
}

.btn-icon:hover {
    background: var(--bg-tertiary);
    color: var(--primary-color);
}

/* Stats Card */
.stats-card {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: 1rem;
}

.stats-card h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
}

.stat-label {
    font-size: 0.8125rem;
    color: var(--text-tertiary);
}

.stat-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
}

/* Main Content */
.main-content {
    flex: 1;
    background: var(--bg-card);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-md);
}

.content-view {
    display: none;
    height: 100%;
}

.content-view.active {
    display: flex;
}

/* Quiz View */
#quizView {
    gap: 1px;
    background: var(--border-color);
}

.pdf-viewer,
.quiz-container {
    flex: 1;
    background: var(--bg-card);
    min-height: calc(100vh - 145px);
}

.pdf-placeholder,
.quiz-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
}

.pdf-placeholder i,
.quiz-placeholder i {
    font-size: 4rem;
    color: var(--text-tertiary);
    margin-bottom: 1rem;
}

.pdf-placeholder h3,
.quiz-placeholder h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.pdf-placeholder p,
.quiz-placeholder p {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
}

#pdfFrame {
    width: 100%;
    height: 100%;
    border: none;
}

.feature-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    text-align: left;
    margin-top: 1rem;
}

.feature-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
}

.feature-item i {
    font-size: 1rem;
    color: var(--success-color);
}

/* Quiz Content */
.quiz-content {
    padding: 2rem;
    max-width: 800px;
    margin: 0 auto;
}

.quiz-header {
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
}

.quiz-header h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.quiz-meta {
    display: flex;
    gap: 1.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.question-section {
    margin-bottom: 2rem;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-color);
    margin-bottom: 1rem;
    padding: 0.5rem;
    background: var(--primary-light);
    border-radius: var(--radius-md);
}

.question-card {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    margin-bottom: 1rem;
    animation: fadeIn 0.4s ease;
    border-left: 4px solid var(--primary-color);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.question-card:hover {
    transform: translateX(4px);
    box-shadow: var(--shadow-md);
}

.question-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
}

.question-text {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 1rem;
    line-height: 1.6;
}

.options-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.option-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--transition);
}

.option-item:hover {
    border-color: var(--primary-color);
    background: var(--primary-light);
}

.option-item input[type="radio"] {
    margin-right: 0.75rem;
    accent-color: var(--primary-color);
    cursor: pointer;
    width: 20px;
    height: 20px;
}

.option-item label {
    flex: 1;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-primary);
}

.answer-input {
    width: 100%;
    min-height: 80px;
    padding: 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    color: var(--text-primary);
    font-family: inherit;
    resize: vertical;
    transition: var(--transition);
}

.answer-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
}

.feedback-card {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-card);
    border-left: 4px solid var(--info-color);
    border-radius: var(--radius-md);
}

.feedback-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
}

.feedback-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 0.875rem;
}

.feedback-icon.correct {
    background: var(--success-color);
    color: white;
}

.feedback-icon.incorrect {
    background: var(--error-color);
    color: white;
}

.feedback-header h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
}

.feedback-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.6;
}

.quiz-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border-color);
}

.submit-quiz-btn {
    padding: 0.875rem 2rem;
    font-size: 1rem;
}

/* Progress View */
#progressView {
    flex-direction: column;
    padding: 2rem;
    overflow-y: auto;
}

.progress-header {
    text-align: center;
    margin-bottom: 2rem;
}

.progress-header h2 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.progress-header p {
    font-size: 1rem;
    color: var(--text-secondary);
}

.progress-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.progress-card {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    text-align: center;
    transition: var(--transition);
}

.progress-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
}

.progress-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 1rem;
    background: var(--primary-light);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary-color);
    font-size: 1.25rem;
}

.progress-card h3 {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
}

.progress-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
}

.recent-attempts {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
}

.recent-attempts h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1rem;
}

.attempts-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.attempt-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--bg-card);
    border-radius: var(--radius-md);
}

.attempt-details {
    flex: 1;
}

.attempt-pdf {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.attempt-date {
    font-size: 0.75rem;
    color: var(--text-tertiary);
}

.attempt-score {
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-color);
}

/* ============================================
   VIDEO RECOMMENDATIONS MODAL
   ============================================ */

#getVideoRecsBtn {
    background: var(--youtube-red);
    color: white;
    margin-top: 0.75rem;
}

#getVideoRecsBtn:hover {
    background: var(--youtube-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 0, 0, 0.3);
}

#getVideoRecsBtn i {
    font-size: 1rem;
}

.video-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 1000;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.3s ease;
}

.video-modal.active {
    display: flex;
}

.video-modal-content {
    background: var(--bg-card);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 700px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
    animation: slideUp 0.3s ease;
}

.video-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
}

.video-modal-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.video-modal-header h2 i {
    color: var(--youtube-red);
    font-size: 1.5rem;
}

.video-modal-close {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: var(--transition);
}

.video-modal-close:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
}

.video-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
}

.video-recommendations-intro {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--primary-light);
    border-radius: var(--radius-md);
}

.video-recommendations-intro p {
    font-size: 0.875rem;
    color: var(--text-primary);
    line-height: 1.6;
}

.video-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.video-item {
    display: flex;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    transition: var(--transition);
    border: 2px solid transparent;
}

.video-item:hover {
    background: var(--bg-tertiary);
    border-color: var(--youtube-red);
    transform: translateX(4px);
}

.video-number {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--youtube-red);
    color: white;
    border-radius: 50%;
    font-weight: 700;
    font-size: 0.875rem;
}

.video-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.video-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.4;
}

.video-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--youtube-red);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: var(--transition);
    width: fit-content;
}

.video-link:hover {
    color: var(--youtube-hover);
    gap: 0.75rem;
}

.video-link i.fab {
    font-size: 1.125rem;
}

.video-link i.fa-external-link-alt {
    font-size: 0.75rem;
}

.video-empty-state {
    text-align: center;
    padding: 3rem 1rem;
}

.video-empty-state i {
    font-size: 4rem;
    color: var(--text-tertiary);
    margin-bottom: 1rem;
}

.video-empty-state p {
    font-size: 1rem;
    color: var(--text-secondary);
}

.video-recommendations-footer {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
}

.video-hint {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.6;
}

.video-hint i {
    color: var(--info-color);
    font-size: 1rem;
    flex-shrink: 0;
}

.video-modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
}

/* ============================================
   SCORE MODAL
   ============================================ */

.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 1000;
    align-items: center;
    justify-content: center;
    padding: 1rem;
}

.modal.active {
    display: flex;
}

.modal-content {
    background: var(--bg-card);
    border-radius: var(--radius-xl);
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
    animation: slideUp 0.3s ease;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
}

.modal-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--transition);
}

.modal-close:hover {
    background: var(--bg-tertiary);
}

.modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
}

.score-display {
    text-align: center;
    padding: 2rem;
}

.score-circle {
    width: 120px;
    height: 120px;
    margin: 0 auto 1.5rem;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
}

.score-percentage {
    font-size: 2rem;
    font-weight: 700;
    color: white;
}

.score-message {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.score-details {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.6;
}

/* Loading Overlay */
.loading-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 2000;
    align-items: center;
    justify-content: center;
}

.loading-overlay.active {
    display: flex;
}

.loading-content {
    text-align: center;
}

.spinner {
    width: 48px;
    height: 48px;
    margin: 0 auto 1.5rem;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.loading-content p {
    font-size: 0.9375rem;
    color: white;
    font-weight: 500;
}

/* Toast Notification */
.toast {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: var(--bg-card);
    padding: 1rem 1.5rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    z-index: 3000;
    transform: translateX(calc(100% + 2rem));
    transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.toast.show {
    transform: translateX(0);
}

.toast-icon {
    font-size: 1.25rem;
}

.toast.success { --toast-color: var(--success-color); }
.toast.error { --toast-color: var(--error-color); }
.toast.warning { --toast-color: var(--warning-color); }
.toast.info { --toast-color: var(--info-color); }

.toast .toast-icon {
    color: var(--toast-color);
}

.toast-message {
    font-size: 0.875rem;
    color: var(--text-primary);
}

/* Animations */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(40px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Responsive Design */
@media (max-width: 1024px) {
    .app-container {
        flex-direction: column;
    }

    .sidebar {
        width: 100%;
        position: static;
    }

    #quizView {
        flex-direction: column;
    }
}

@media (max-width: 768px) {
    .header-content {
        padding: 1rem;
    }

    .logo span {
        display: none;
    }

    .nav-btn span {
        display: none;
    }

    .nav-btn {
        padding: 0.5rem;
        width: 40px;
        height: 40px;
        justify-content: center;
    }

    .app-container {
        padding: 1rem;
    }

    .quiz-content {
        padding: 1.5rem;
    }

    .progress-grid {
        grid-template-columns: 1fr;
    }

    .modal-content,
    .video-modal-content {
        max-height: 90vh;
    }

    .toast {
        bottom: 1rem;
        right: 1rem;
        left: 1rem;
        transform: translateY(calc(100% + 1rem));
    }
    
    .toast.show {
        transform: translateY(0);
    }
}

/* Scrollbar Styling */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--text-tertiary);
}

/* Utility classes */
.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
}

.error-state {
    padding: 2rem;
    text-align: center;
    color: var(--error-color);
}

.error-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.quiz-loading {
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.pdf-tips {
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--primary-light);
    border-radius: var(--radius-md);
}

.pdf-tips small {
    color: var(--text-secondary);
    font-size: 0.8125rem;
}