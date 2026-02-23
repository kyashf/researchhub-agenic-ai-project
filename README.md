

# 📚 ResearchHub — Agentic AI Research Assistant

An AI-powered research paper management and exploration platform that helps users **store, organize, search, summarize, and chat with academic papers** using modern LLMs, embeddings, and Firebase.

Built with **Flask + Firebase + SentenceTransformers + Groq LLMs**, ResearchHub provides a smart workspace for researchers, students, and developers to manage knowledge efficiently.

check live project: https://research.firoziyash.life

---

## 🚀 Features

### 📄 Paper Management

* Add, update, delete research papers
* Store metadata (title, authors, DOI, abstract, notes, tags, venue, year)
* Automatic timestamp tracking

### 🤖 AI-Powered Capabilities

* **Automatic embeddings** for semantic search
* **LLM-generated summaries** with structured insights:

  * Objective
  * Methodology
  * Findings
  * Conclusions
  * Limitations
* **Chat with papers**

  * Ask questions about a paper
  * Uses context + conversation history
  * Stores chat logs per paper

### 🔎 Smart Search

* Semantic search using sentence embeddings
* Cosine similarity ranking
* Fallback keyword search if embeddings unavailable

### 🗂 Workspace Organization

* Create multiple workspaces
* Add/remove papers from workspaces
* Automatic paper count tracking

### 🔐 Authentication & Security

* Firebase Authentication token verification
* User-specific Firestore collections
* Secure API routes with middleware

### 🌐 API Ready

* RESTful endpoints
* JSON responses
* CORS configured for frontend integration

---

## 🏗 Tech Stack

**Backend**

* Python
* Flask
* Firebase Admin SDK (Auth + Firestore)
* SentenceTransformers (embeddings)
* Groq LLM via Limma
* NumPy

**AI**

* `all-MiniLM-L6-v2` embedding model
* Llama 3.x (Groq provider)

**Database**

* Google Firestore

**Environment**

* dotenv configuration

---

## 📂 Project Structure (example)

```
researchhub/
│
├── app.py                # Flask API server
├── requirements.txt
├── .env
├── firebase_config.json  # (optional if not using env JSON)
└── README.md
```

---

## ⚙️ Installation

### 1️⃣ Clone repository

```
git clone https://github.com/kyashf/researchhub-agenic-ai-project.git
cd researchhub-agenic-ai-project
```

### 2️⃣ Create virtual environment

```
python -m venv venv
source venv/bin/activate   # mac/linux
venv\Scripts\activate      # windows
```

### 3️⃣ Install dependencies

```
pip install -r requirements.txt
```

---

## 🔑 Environment Variables

Create a `.env` file:

```
SERVICE_KEY_JSON=<firebase-service-account-json-string>
GROQ_API_KEY=<your_groq_api_key>
```

Notes:

* `SERVICE_KEY_JSON` must be a **stringified JSON**
* Must include Firestore + Auth permissions

---

## ▶️ Run Server

```
python app.py
```

Server runs on:

```
http://localhost:5000
```

Health check:

```
GET /api/health
```

---

## 📡 Example API Endpoints

### User

```
GET /api/user/profile
```

### Papers

```
GET    /api/papers
POST   /api/papers
GET    /api/papers/<paper_id>
PUT    /api/papers/<paper_id>
DELETE /api/papers/<paper_id>
```

### AI

```
POST /api/papers/<paper_id>/summarize
POST /api/papers/<paper_id>/chat
GET  /api/papers/<paper_id>/chats
```

### Search

```
POST /api/search
```

### Workspaces

```
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/<id>
POST   /api/workspaces/<id>/papers
DELETE /api/workspaces/<id>/papers/<paper_id>
```

---

## 🧠 How AI Works

1. When a paper is added:

   * Abstract → embedding generated
   * Stored in Firestore

2. When searching:

   * Query → embedding generated
   * Cosine similarity computed vs stored embeddings
   * Results ranked by relevance

3. When summarizing/chatting:

   * Paper context injected into prompt
   * LLM generates response
   * Saved to Firestore

---

## 🛠 Future Improvements

* PDF upload + automatic parsing
* Citation extraction
* Multi-paper chat
* Vector database integration
* Collaborative workspaces
---



