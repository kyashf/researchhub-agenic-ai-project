import os
import json
import numpy as np
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth, firestore
from sentence_transformers import SentenceTransformer
from limma.llm import config, generate

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Comprehensive CORS configuration
CORS(app, 
     origins=["http://localhost:5173", "http://localhost:3000"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "Accept"],
     expose_headers=["Content-Type", "Authorization"],
     supports_credentials=True,
     max_age=3600)

# Additional CORS handling for preflight requests
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Initialize Firebase with error handling
try:
    service_key_json = os.getenv("SERVICE_KEY_JSON")
    if not service_key_json:
        raise ValueError("SERVICE_KEY_JSON environment variable is not set")
    
    cred_dict = json.loads(service_key_json)
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase initialized successfully")
except json.JSONDecodeError as e:
    print(f"Error parsing SERVICE_KEY_JSON: {e}")
    raise
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    raise

# Initialize AI models
try:
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    print("Embedding model loaded successfully")
except Exception as e:
    print(f"Error loading embedding model: {e}")
    embedding_model = None

# Groq API configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not set")

# Configure limma
try:
    config(api_key=GROQ_API_KEY, provider="groq", model="llama-3.3-70b-versatile")
    print("LLM configured successfully")
except Exception as e:
    print(f"Error configuring LLM: {e}")

# Authentication middleware
def verify_token(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401
        
        token = auth_header.split(' ')[1]
        try:
            decoded_token = auth.verify_id_token(token)
            g.user_id = decoded_token['uid']
            g.user_email = decoded_token.get('email', '')
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401
    
    return decorated_function

# Helper functions
def generate_embedding(text):
    """Generate embedding for text using sentence-transformers"""
    if embedding_model is None:
        return None
    try:
        embedding = embedding_model.encode(text)
        return embedding.tolist()
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None

def query_llm(prompt, system_prompt="You are a helpful research assistant."):
    """Query LLM API with given prompt"""  
    final_prompt = f"""System: {system_prompt}
    User: {prompt}"""

    try:
        response = generate(final_prompt)
        return response
    except Exception as e:
        print(f"LLM API error: {e}")
        return None

# Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

# User routes
@app.route('/api/user/profile', methods=['GET'])
@verify_token
def get_user_profile():
    try:
        user_ref = db.collection('users').document(g.user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            # Create user profile if not exists
            user_data = {
                'email': g.user_email,
                'created_at': datetime.now(),
                'updated_at': datetime.now(),
                'settings': {
                    'theme': 'light',
                    'notifications': True
                }
            }
            user_ref.set(user_data)
            return jsonify(user_data), 201
        
        return jsonify(user_doc.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Paper routes
@app.route('/api/papers', methods=['GET'])
@verify_token
def get_papers():
    try:
        papers_ref = db.collection('users').document(g.user_id).collection('papers')
        papers = papers_ref.order_by('created_at', direction=firestore.Query.DESCENDING).stream()
        
        papers_list = []
        for paper in papers:
            paper_data = paper.to_dict()
            paper_data['id'] = paper.id
            # Convert datetime objects to ISO format for JSON serialization
            if 'created_at' in paper_data and paper_data['created_at']:
                paper_data['created_at'] = paper_data['created_at'].isoformat()
            if 'updated_at' in paper_data and paper_data['updated_at']:
                paper_data['updated_at'] = paper_data['updated_at'].isoformat()
            papers_list.append(paper_data)
        
        return jsonify(papers_list), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/papers', methods=['POST'])
@verify_token
def add_paper():
    try:
        data = request.json
        required_fields = ['title']
        
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        paper_data = {
            'title': data['title'],
            'authors': data.get('authors', []),
            'abstract': data.get('abstract', ''),
            'url': data.get('url', ''),
            'doi': data.get('doi', ''),
            'year': data.get('year', datetime.now().year),
            'venue': data.get('venue', ''),
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'tags': data.get('tags', []),
            'notes': data.get('notes', ''),
            'status': data.get('status', 'unread')
        }
        
        # Generate embedding for semantic search
        if paper_data['abstract']:
            embedding = generate_embedding(paper_data['abstract'])
            if embedding:
                paper_data['embedding'] = embedding
        
        # Add paper to user's collection
        papers_ref = db.collection('users').document(g.user_id).collection('papers')
        doc_ref = papers_ref.add(paper_data)
        
        paper_data['id'] = doc_ref[1].id
        
        # Convert datetime objects to ISO format for JSON serialization
        paper_data['created_at'] = paper_data['created_at'].isoformat()
        paper_data['updated_at'] = paper_data['updated_at'].isoformat()
        
        return jsonify(paper_data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/papers/<paper_id>', methods=['GET'])
@verify_token
def get_paper(paper_id):
    try:
        paper_ref = db.collection('users').document(g.user_id).collection('papers').document(paper_id)
        paper_doc = paper_ref.get()
        
        if not paper_doc.exists:
            return jsonify({'error': 'Paper not found'}), 404
        
        paper_data = paper_doc.to_dict()
        paper_data['id'] = paper_doc.id
        
        # Convert datetime objects to ISO format for JSON serialization
        if 'created_at' in paper_data and paper_data['created_at']:
            paper_data['created_at'] = paper_data['created_at'].isoformat()
        if 'updated_at' in paper_data and paper_data['updated_at']:
            paper_data['updated_at'] = paper_data['updated_at'].isoformat()
        
        return jsonify(paper_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/papers/<paper_id>', methods=['PUT'])
@verify_token
def update_paper(paper_id):
    try:
        data = request.json
        paper_ref = db.collection('users').document(g.user_id).collection('papers').document(paper_id)
        
        if not paper_ref.get().exists:
            return jsonify({'error': 'Paper not found'}), 404
        
        update_data = {
            'updated_at': datetime.now()
        }
        
        updatable_fields = ['title', 'authors', 'abstract', 'url', 'doi', 'year', 'venue', 'tags', 'notes', 'status']
        for field in updatable_fields:
            if field in data:
                update_data[field] = data[field]
        
        # Regenerate embedding if abstract changed
        if 'abstract' in data and data['abstract']:
            embedding = generate_embedding(data['abstract'])
            if embedding:
                update_data['embedding'] = embedding
        
        paper_ref.update(update_data)
        
        return jsonify({'message': 'Paper updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/papers/<paper_id>', methods=['DELETE'])
@verify_token
def delete_paper(paper_id):
    try:
        paper_ref = db.collection('users').document(g.user_id).collection('papers').document(paper_id)
        
        if not paper_ref.get().exists:
            return jsonify({'error': 'Paper not found'}), 404
        
        # Delete associated summaries
        for summary in paper_ref.collection('summaries').stream():
            summary.reference.delete()

        # Delete associated chats
        for chat in paper_ref.collection('chats').stream():
            chat.reference.delete()
        
        # Delete the paper
        paper_ref.delete()
        
        return jsonify({'message': 'Paper deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# AI Routes - Summaries
@app.route('/api/papers/<paper_id>/summaries', methods=['GET'])
@verify_token
def get_paper_summaries(paper_id):
    try:
        paper_ref = db.collection('users').document(g.user_id).collection('papers').document(paper_id)
        
        if not paper_ref.get().exists:
            return jsonify({'error': 'Paper not found'}), 404
        
        summaries_ref = paper_ref.collection('summaries').order_by('created_at', direction=firestore.Query.DESCENDING).stream()
        
        summaries = []
        for summary in summaries_ref:
            summary_data = summary.to_dict()
            summary_data['id'] = summary.id
            # Convert datetime to ISO format
            if 'created_at' in summary_data and summary_data['created_at']:
                summary_data['created_at'] = summary_data['created_at'].isoformat()
            summaries.append(summary_data)
        
        return jsonify(summaries), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/papers/<paper_id>/summarize', methods=['POST'])
@verify_token
def summarize_paper(paper_id):
    try:
        paper_ref = db.collection('users').document(g.user_id).collection('papers').document(paper_id)
        paper_doc = paper_ref.get()
        
        if not paper_doc.exists:
            return jsonify({'error': 'Paper not found'}), 404
        
        paper_data = paper_doc.to_dict()
        
        # Prepare prompt for summarization
        prompt = f"""
        Title: {paper_data['title']}
        Authors: {', '.join(paper_data.get('authors', []))}
        Abstract: {paper_data.get('abstract', 'No abstract available')}
        
        Please provide a comprehensive summary of this research paper including:
        1. Main objective and research question
        2. Methodology used
        3. Key findings and results
        4. Conclusions and implications
        5. Limitations and future work
        
        Format the summary in clear sections with bullet points where appropriate.
        """
        
        summary = query_llm(prompt, "You are an expert research assistant specializing in summarizing academic papers.")
        
        if not summary:
            return jsonify({'error': 'Failed to generate summary'}), 500
        
        # Store summary
        summary_data = {
            'content': summary,
            'created_at': datetime.now(),
            'paper_id': paper_id
        }
        
        summaries_ref = paper_ref.collection('summaries')
        doc_ref = summaries_ref.add(summary_data)
        summary_data['id'] = doc_ref[1].id
        
        # Convert datetime to ISO format
        summary_data['created_at'] = summary_data['created_at'].isoformat()
        
        return jsonify(summary_data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# AI Routes - Chat
@app.route('/api/papers/<paper_id>/chat', methods=['POST'])
@verify_token
def chat_with_paper(paper_id):
    try:
        data = request.json
        message = data.get('message')
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        paper_ref = db.collection('users').document(g.user_id).collection('papers').document(paper_id)
        paper_doc = paper_ref.get()
        
        if not paper_doc.exists:
            return jsonify({'error': 'Paper not found'}), 404
        
        paper_data = paper_doc.to_dict()
        
        # Get chat history
        chats_ref = paper_ref.collection('chats').order_by('created_at').limit(10)
        chat_history = chats_ref.stream()
        
        history = []
        for chat in chat_history:
            chat_data = chat.to_dict()
            history.append({
                'role': chat_data['role'],
                'content': chat_data['content']
            })
        
        # Prepare context
        context = f"""
        Paper Title: {paper_data['title']}
        Authors: {', '.join(paper_data.get('authors', []))}
        Abstract: {paper_data.get('abstract', 'No abstract available')}
        Notes: {paper_data.get('notes', '')}
        
        Previous conversation:
        {json.dumps(history[-5:]) if history else 'No previous conversation'}
        """
        
        prompt = f"""
        Context about the paper:
        {context}
        
        User question: {message}
        
        Please provide a helpful answer based on the paper's content. If the information is not in the paper, politely suggest that the user might want to look for additional sources.
        """
        
        response = query_llm(prompt, "You are a knowledgeable research assistant helping users understand academic papers. Be precise, cite specific parts of the paper when relevant.")
        
        if not response:
            return jsonify({'error': 'Failed to generate response'}), 500
        
        # Store user message
        user_message_data = {
            'role': 'user',
            'content': message,
            'created_at': datetime.now()
        }
        paper_ref.collection('chats').add(user_message_data)
        
        # Store assistant response
        assistant_message_data = {
            'role': 'assistant',
            'content': response,
            'created_at': datetime.now()
        }
        doc_ref = paper_ref.collection('chats').add(assistant_message_data)
        assistant_message_data['id'] = doc_ref[1].id
        
        # Convert datetime to ISO format
        assistant_message_data['created_at'] = assistant_message_data['created_at'].isoformat()
        
        return jsonify(assistant_message_data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/papers/<paper_id>/chats', methods=['GET'])
@verify_token
def get_chat_history(paper_id):
    try:
        paper_ref = db.collection('users').document(g.user_id).collection('papers').document(paper_id)
        
        if not paper_ref.get().exists:
            return jsonify({'error': 'Paper not found'}), 404
        
        chats_ref = paper_ref.collection('chats').order_by('created_at').stream()
        
        chats = []
        for chat in chats_ref:
            chat_data = chat.to_dict()
            chat_data['id'] = chat.id
            # Convert datetime to ISO format
            if 'created_at' in chat_data and chat_data['created_at']:
                chat_data['created_at'] = chat_data['created_at'].isoformat()
            chats.append(chat_data)
        
        return jsonify(chats), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Search routes
@app.route('/api/search', methods=['POST'])
@verify_token
def search_papers():
    try:
        data = request.json
        query = data.get('query')
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        # Generate embedding for query
        query_embedding = generate_embedding(query)
        
        if not query_embedding or embedding_model is None:
            # Fallback to text search
            papers_ref = db.collection('users').document(g.user_id).collection('papers')
            papers = papers_ref.stream()
            
            results = []
            for paper in papers:
                paper_data = paper.to_dict()
                if query.lower() in paper_data['title'].lower() or query.lower() in paper_data.get('abstract', '').lower():
                    paper_data['id'] = paper.id
                    # Convert datetime to ISO format
                    if 'created_at' in paper_data and paper_data['created_at']:
                        paper_data['created_at'] = paper_data['created_at'].isoformat()
                    if 'updated_at' in paper_data and paper_data['updated_at']:
                        paper_data['updated_at'] = paper_data['updated_at'].isoformat()
                    results.append(paper_data)
            
            return jsonify(results), 200
        
        # Perform semantic search
        papers_ref = db.collection('users').document(g.user_id).collection('papers')
        papers = papers_ref.stream()
        
        results = []
        for paper in papers:
            paper_data = paper.to_dict()
            paper_embedding = paper_data.get('embedding')
            
            if paper_embedding:
                # Calculate cosine similarity
                similarity = np.dot(query_embedding, paper_embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(paper_embedding)
                )
                
                if similarity > 0.5:  # Threshold for relevance
                    paper_data['id'] = paper.id
                    paper_data['similarity'] = float(similarity)
                    # Convert datetime to ISO format
                    if 'created_at' in paper_data and paper_data['created_at']:
                        paper_data['created_at'] = paper_data['created_at'].isoformat()
                    if 'updated_at' in paper_data and paper_data['updated_at']:
                        paper_data['updated_at'] = paper_data['updated_at'].isoformat()
                    results.append(paper_data)
        
        # Sort by similarity
        results.sort(key=lambda x: x.get('similarity', 0), reverse=True)
        
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Workspace routes
@app.route('/api/workspaces', methods=['GET'])
@verify_token
def get_workspaces():
    try:
        workspaces_ref = db.collection('users').document(g.user_id).collection('workspaces')
        workspaces = workspaces_ref.order_by('created_at').stream()
        
        workspaces_list = []
        for workspace in workspaces:
            workspace_data = workspace.to_dict()
            workspace_data['id'] = workspace.id
            # Convert datetime to ISO format
            if 'created_at' in workspace_data and workspace_data['created_at']:
                workspace_data['created_at'] = workspace_data['created_at'].isoformat()
            if 'updated_at' in workspace_data and workspace_data['updated_at']:
                workspace_data['updated_at'] = workspace_data['updated_at'].isoformat()
            workspaces_list.append(workspace_data)
        
        return jsonify(workspaces_list), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/workspaces', methods=['POST'])
@verify_token
def create_workspace():
    try:
        data = request.json
        name = data.get('name')
        
        if not name:
            return jsonify({'error': 'Workspace name is required'}), 400
        
        workspace_data = {
            'name': name,
            'description': data.get('description', ''),
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'paper_count': 0
        }
        
        workspaces_ref = db.collection('users').document(g.user_id).collection('workspaces')
        doc_ref = workspaces_ref.add(workspace_data)
        workspace_data['id'] = doc_ref[1].id
        
        # Convert datetime to ISO format
        workspace_data['created_at'] = workspace_data['created_at'].isoformat()
        workspace_data['updated_at'] = workspace_data['updated_at'].isoformat()
        
        return jsonify(workspace_data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/workspaces/<workspace_id>', methods=['GET'])
@verify_token
def get_workspace(workspace_id):
    try:
        workspace_ref = db.collection('users').document(g.user_id).collection('workspaces').document(workspace_id)
        workspace_doc = workspace_ref.get()
        
        if not workspace_doc.exists:
            return jsonify({'error': 'Workspace not found'}), 404
        
        workspace_data = workspace_doc.to_dict()
        workspace_data['id'] = workspace_doc.id
        
        # Convert datetime to ISO format
        if 'created_at' in workspace_data and workspace_data['created_at']:
            workspace_data['created_at'] = workspace_data['created_at'].isoformat()
        if 'updated_at' in workspace_data and workspace_data['updated_at']:
            workspace_data['updated_at'] = workspace_data['updated_at'].isoformat()
        
        return jsonify(workspace_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/workspaces/<workspace_id>/papers', methods=['GET'])
@verify_token
def get_workspace_papers(workspace_id):
    try:
        workspace_ref = db.collection('users').document(g.user_id).collection('workspaces').document(workspace_id)
        
        if not workspace_ref.get().exists:
            return jsonify({'error': 'Workspace not found'}), 404
        
        # Get paper references from workspace
        paper_refs = workspace_ref.collection('papers').stream()
        
        papers = []
        for paper_ref_doc in paper_refs:
            paper_id = paper_ref_doc.id
            paper_doc = db.collection('users').document(g.user_id).collection('papers').document(paper_id).get()
            
            if paper_doc.exists:
                paper_data = paper_doc.to_dict()
                paper_data['id'] = paper_doc.id
                # Convert datetime to ISO format
                if 'created_at' in paper_data and paper_data['created_at']:
                    paper_data['created_at'] = paper_data['created_at'].isoformat()
                if 'updated_at' in paper_data and paper_data['updated_at']:
                    paper_data['updated_at'] = paper_data['updated_at'].isoformat()
                papers.append(paper_data)
        
        return jsonify(papers), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/workspaces/<workspace_id>/papers', methods=['POST'])
@verify_token
def add_paper_to_workspace(workspace_id):
    try:
        data = request.json
        paper_id = data.get('paper_id')
        
        if not paper_id:
            return jsonify({'error': 'Paper ID is required'}), 400
        
        workspace_ref = db.collection('users').document(g.user_id).collection('workspaces').document(workspace_id)
        
        if not workspace_ref.get().exists:
            return jsonify({'error': 'Workspace not found'}), 404
        
        # Check if paper exists
        paper_ref = db.collection('users').document(g.user_id).collection('papers').document(paper_id)
        if not paper_ref.get().exists:
            return jsonify({'error': 'Paper not found'}), 404
        
        # Add paper reference to workspace
        workspace_ref.collection('papers').document(paper_id).set({
            'added_at': datetime.now()
        })
        
        # Update paper count using firestore.Increment
        workspace_ref.update({
            'paper_count': firestore.Increment(1),
            'updated_at': datetime.now()
        })
        
        return jsonify({'message': 'Paper added to workspace'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/workspaces/<workspace_id>/papers/<paper_id>', methods=['DELETE'])
@verify_token
def remove_paper_from_workspace(workspace_id, paper_id):
    try:
        workspace_ref = db.collection('users').document(g.user_id).collection('workspaces').document(workspace_id)
        
        if not workspace_ref.get().exists:
            return jsonify({'error': 'Workspace not found'}), 404
        
        # Remove paper reference from workspace
        workspace_ref.collection('papers').document(paper_id).delete()
        
        # Update paper count using firestore.Increment (decrement by 1)
        workspace_ref.update({
            'paper_count': firestore.Increment(-1),
            'updated_at': datetime.now()
        })
        
        return jsonify({'message': 'Paper removed from workspace'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Handle OPTIONS requests explicitly
@app.route('/api/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    response = jsonify({'message': 'OK'})
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response, 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)