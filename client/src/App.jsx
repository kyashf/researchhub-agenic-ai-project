import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  Link
} from 'react-router-dom';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
// Add these imports at the top of PaperDetailPage component
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import './App.css'

// Initialize Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// API configuration
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') + "/api";

// Axios interceptor for auth token
axios.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route
            path="/"
            element={user ? <Dashboard /> : <LandingPage />}
          />
          <Route
            path="/dashboard"
            element={user ? <Dashboard /> : <Navigate to="/" />}
          />
          <Route
            path="/papers"
            element={user ? <PapersPage /> : <Navigate to="/" />}
          />
          <Route
            path="/papers/:paperId"
            element={user ? <PaperDetailPage /> : <Navigate to="/" />}
          />
          <Route
            path="/workspaces"
            element={user ? <WorkspacesPage /> : <Navigate to="/" />}
          />
          <Route
            path="/workspaces/:workspaceId"
            element={user ? <WorkspaceDetailPage /> : <Navigate to="/" />}
          />
          <Route
            path="/search"
            element={user ? <SearchPage /> : <Navigate to="/" />}
          />
        </Routes>
      </div>
    </Router>
  );
}

// Landing Page Component
function LandingPage() {
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">ResearchHub AI</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleGoogleSignIn}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Sign In with Google
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            AI-Powered Research Paper Management
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Discover, organize, and analyze academic papers with cutting-edge AI assistance.
            Stop struggling with manual searches and start focusing on what matters - your research.
          </p>
          <button
            onClick={handleGoogleSignIn}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
          >
            Get Started Free
          </button>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-blue-600 text-3xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">Smart Discovery</h3>
            <p className="text-gray-600">
              Find relevant papers across multiple databases with AI-powered search and recommendations.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-blue-600 text-3xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold mb-2">AI Analysis</h3>
            <p className="text-gray-600">
              Get instant summaries, insights, and answers to your questions about any paper.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-blue-600 text-3xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2">Organized Workspace</h3>
            <p className="text-gray-600">
              Create workspaces, collaborate with team members, and keep your research organized.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dashboard Component
function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalPapers: 0,
    recentPapers: [],
    workspaces: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [papersRes, workspacesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/papers`),
        axios.get(`${API_BASE_URL}/workspaces`)
      ]);

      setStats({
        totalPapers: papersRes.data.length,
        recentPapers: papersRes.data.slice(0, 5),
        workspaces: workspacesRes.data.slice(0, 3)
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">ResearchHub AI</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-700 hover:text-blue-600">Dashboard</Link>
              <Link to="/papers" className="text-gray-700 hover:text-blue-600">Papers</Link>
              <Link to="/workspaces" className="text-gray-700 hover:text-blue-600">Workspaces</Link>
              <Link to="/search" className="text-gray-700 hover:text-blue-600">Search</Link>
              <button
                onClick={handleSignOut}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalPapers}</div>
            <div className="text-gray-600">Total Papers</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-3xl font-bold text-blue-600 mb-2">{stats.workspaces.length}</div>
            <div className="text-gray-600">Workspaces</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-3xl font-bold text-blue-600 mb-2">0</div>
            <div className="text-gray-600">Collaborators</div>
          </div>
        </div>

        {/* Recent Papers */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Recent Papers</h2>
          {stats.recentPapers.length > 0 ? (
            <div className="space-y-4">
              {stats.recentPapers.map((paper) => (
                <div
                  key={paper.id}
                  className="border-b pb-4 last:border-0 last:pb-0 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  onClick={() => navigate(`/papers/${paper.id}`)}
                >
                  <h3 className="font-medium text-blue-600">{paper.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {paper.authors?.join(', ') || 'Unknown authors'} • {paper.year}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No papers yet. Start by adding some papers!</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => navigate('/papers')}
            className="bg-blue-600 text-white p-6 rounded-xl shadow-md hover:bg-blue-700 transition text-left"
          >
            <div className="text-2xl mb-2">📄</div>
            <h3 className="text-lg font-semibold mb-2">Add New Paper</h3>
            <p className="text-blue-100">Import papers manually or search by DOI/URL</p>
          </button>
          <button
            onClick={() => navigate('/search')}
            className="bg-purple-600 text-white p-6 rounded-xl shadow-md hover:bg-purple-700 transition text-left"
          >
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="text-lg font-semibold mb-2">Smart Search</h3>
            <p className="text-purple-100">Search across your library with AI</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// Papers Page Component
function PapersPage() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPaper, setNewPaper] = useState({
    title: '',
    authors: [],
    abstract: '',
    url: '',
    doi: '',
    year: new Date().getFullYear(),
    venue: '',
    tags: []
  });
  const [authorInput, setAuthorInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    fetchPapers();
  }, []);

  const fetchPapers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/papers`);
      setPapers(response.data);
    } catch (error) {
      console.error('Error fetching papers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaper = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/papers`, newPaper);
      setPapers([response.data, ...papers]);
      setShowAddModal(false);
      setNewPaper({
        title: '',
        authors: [],
        abstract: '',
        url: '',
        doi: '',
        year: new Date().getFullYear(),
        venue: '',
        tags: []
      });
    } catch (error) {
      console.error('Error adding paper:', error);
    }
  };

  const handleDeletePaper = async (paperId, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this paper?')) {
      try {
        await axios.delete(`${API_BASE_URL}/papers/${paperId}`);
        setPapers(papers.filter(p => p.id !== paperId));
      } catch (error) {
        console.error('Error deleting paper:', error);
      }
    }
  };

  const addAuthor = () => {
    if (authorInput.trim()) {
      setNewPaper({
        ...newPaper,
        authors: [...newPaper.authors, authorInput.trim()]
      });
      setAuthorInput('');
    }
  };

  const removeAuthor = (index) => {
    setNewPaper({
      ...newPaper,
      authors: newPaper.authors.filter((_, i) => i !== index)
    });
  };

  const addTag = () => {
    if (tagInput.trim()) {
      setNewPaper({
        ...newPaper,
        tags: [...newPaper.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const removeTag = (index) => {
    setNewPaper({
      ...newPaper,
      tags: newPaper.tags.filter((_, i) => i !== index)
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation (same as dashboard) */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">ResearchHub AI</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-700 hover:text-blue-600">Dashboard</Link>
              <Link to="/papers" className="text-gray-700 hover:text-blue-600">Papers</Link>
              <Link to="/workspaces" className="text-gray-700 hover:text-blue-600">Workspaces</Link>
              <Link to="/search" className="text-gray-700 hover:text-blue-600">Search</Link>
              <button
                onClick={() => signOut(auth)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Papers</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            + Add Paper
          </button>
        </div>

        {/* Papers List */}
        {papers.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className="bg-white p-6 rounded-xl shadow-md cursor-pointer hover:shadow-lg transition"
                onClick={() => navigate(`/papers/${paper.id}`)}
              >
                <div className="flex justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-blue-600 mb-2">{paper.title}</h2>
                    <p className="text-gray-600 mb-2">
                      {paper.authors?.join(', ') || 'Unknown authors'} • {paper.year}
                    </p>
                    {paper.venue && (
                      <p className="text-sm text-gray-500 mb-2">{paper.venue}</p>
                    )}
                    <p className="text-gray-700 line-clamp-2">{paper.abstract}</p>

                    {/* Tags */}
                    {paper.tags && paper.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {paper.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeletePaper(paper.id, e)}
                    className="ml-4 text-red-600 hover:text-red-800"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No papers yet. Start by adding your first paper!</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Add Your First Paper
            </button>
          </div>
        )}
      </div>

      {/* Add Paper Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">Add New Paper</h2>

              <form onSubmit={handleAddPaper}>
                {/* Title */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPaper.title}
                    onChange={(e) => setNewPaper({ ...newPaper, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Authors */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Authors
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={authorInput}
                      onChange={(e) => setAuthorInput(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add author"
                    />
                    <button
                      type="button"
                      onClick={addAuthor}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newPaper.authors.map((author, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded flex items-center gap-1"
                      >
                        {author}
                        <button
                          type="button"
                          onClick={() => removeAuthor(index)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Abstract */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Abstract
                  </label>
                  <textarea
                    value={newPaper.abstract}
                    onChange={(e) => setNewPaper({ ...newPaper, abstract: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* URL and DOI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL
                    </label>
                    <input
                      type="url"
                      value={newPaper.url}
                      onChange={(e) => setNewPaper({ ...newPaper, url: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      DOI
                    </label>
                    <input
                      type="text"
                      value={newPaper.doi}
                      onChange={(e) => setNewPaper({ ...newPaper, doi: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Year and Venue */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Year
                    </label>
                    <input
                      type="number"
                      value={newPaper.year}
                      onChange={(e) => setNewPaper({ ...newPaper, year: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Venue/Journal
                    </label>
                    <input
                      type="text"
                      value={newPaper.venue}
                      onChange={(e) => setNewPaper({ ...newPaper, venue: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add tag"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newPaper.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-purple-100 text-purple-800 px-2 py-1 rounded flex items-center gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(index)}
                          className="text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Add Paper
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Paper Detail Page Component with Markdown Support
function PaperDetailPage() {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const [paper, setPaper] = useState(null);
  const [summary, setSummary] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  // Add state for summaries list
  const [summaries, setSummaries] = useState([]);

  useEffect(() => {
    fetchPaperDetails();
  }, [paperId]);

  const fetchPaperDetails = async () => {
    try {
      const [paperRes, chatsRes, summariesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/papers/${paperId}`),
        axios.get(`${API_BASE_URL}/papers/${paperId}/chats`),
        axios.get(`${API_BASE_URL}/papers/${paperId}/summaries`)
      ]);

      setPaper(paperRes.data);
      setChatMessages(chatsRes.data);
      setSummaries(summariesRes.data);

      // Set the most recent summary if available
      if (summariesRes.data.length > 0) {
        setSummary(summariesRes.data[0]);
      }

    } catch (error) {
      console.error('Error fetching paper details:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const response = await axios.post(`${API_BASE_URL}/papers/${paperId}/chat`, {
        message: newMessage
      });

      setChatMessages([...chatMessages,
      { role: 'user', content: newMessage, created_at: new Date() },
      response.data
      ]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const generateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/papers/${paperId}/summarize`);
      setSummary(response.data);
      // Refresh summaries list
      const summariesRes = await axios.get(`${API_BASE_URL}/papers/${paperId}/summaries`);
      setSummaries(summariesRes.data);
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setGeneratingSummary(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Paper not found</p>
        <button
          onClick={() => navigate('/papers')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          Back to Papers
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">ResearchHub AI</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-700 hover:text-blue-600">Dashboard</Link>
              <Link to="/papers" className="text-gray-700 hover:text-blue-600">Papers</Link>
              <Link to="/workspaces" className="text-gray-700 hover:text-blue-600">Workspaces</Link>
              <Link to="/search" className="text-gray-700 hover:text-blue-600">Search</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/papers')}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Papers
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Paper Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{paper.title}</h1>

              <div className="mb-4">
                <h2 className="text-sm font-medium text-gray-500 mb-1">Authors</h2>
                <p className="text-gray-900">{paper.authors?.join(', ') || 'Unknown'}</p>
              </div>

              {paper.venue && (
                <div className="mb-4">
                  <h2 className="text-sm font-medium text-gray-500 mb-1">Venue/Journal</h2>
                  <p className="text-gray-900">{paper.venue}</p>
                </div>
              )}

              <div className="mb-4">
                <h2 className="text-sm font-medium text-gray-500 mb-1">Year</h2>
                <p className="text-gray-900">{paper.year}</p>
              </div>

              {paper.doi && (
                <div className="mb-4">
                  <h2 className="text-sm font-medium text-gray-500 mb-1">DOI</h2>
                  <a
                    href={`https://doi.org/${paper.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {paper.doi}
                  </a>
                </div>
              )}

              {paper.url && (
                <div className="mb-4">
                  <h2 className="text-sm font-medium text-gray-500 mb-1">URL</h2>
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 break-all"
                  >
                    {paper.url}
                  </a>
                </div>
              )}

              <div className="mb-4">
                <h2 className="text-sm font-medium text-gray-500 mb-1">Abstract</h2>
                <p className="text-gray-700 leading-relaxed">{paper.abstract || 'No abstract available'}</p>
              </div>

              {paper.tags && paper.tags.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-gray-500 mb-2">Tags</h2>
                  <div className="flex flex-wrap gap-2">
                    {paper.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* AI Summary Section - UPDATED WITH MARKDOWN RENDERING */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold">AI Summary</h2>
                  {summaries.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Generated on {new Date(summaries[0].created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={generateSummary}
                  disabled={generatingSummary}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {generatingSummary ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    'Generate New Summary'
                  )}
                </button>
              </div>

              {summary ? (
                <div className="prose prose-blue max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Customize heading styles
                      h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mt-5 mb-3 text-gray-800" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-lg font-medium mt-4 mb-2 text-gray-800" {...props} />,
                      h4: ({ node, ...props }) => <h4 className="text-base font-medium mt-3 mb-2 text-gray-800" {...props} />,

                      // Paragraph styles
                      p: ({ node, ...props }) => <p className="mb-4 text-gray-700 leading-relaxed" {...props} />,

                      // List styles
                      ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-1" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-4 text-gray-700 space-y-1" {...props} />,
                      li: ({ node, ...props }) => <li className="mb-1" {...props} />,

                      // Code styles
                      code: ({ node, inline, ...props }) =>
                        inline ?
                          <code className="bg-gray-100 rounded px-1 py-0.5 text-sm font-mono text-pink-600" {...props} /> :
                          <code className="block bg-gray-100 rounded p-3 text-sm font-mono text-gray-800 overflow-x-auto" {...props} />,

                      // Blockquote styles
                      blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-700 mb-4" {...props} />
                      ),

                      // Table styles
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto mb-4">
                          <table className="min-w-full divide-y divide-gray-200" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => <thead className="bg-gray-50" {...props} />,
                      th: ({ node, ...props }) => <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props} />,
                      td: ({ node, ...props }) => <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700" {...props} />,

                      // Link styles
                      a: ({ node, ...props }) => <a className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer" {...props} />,

                      // Horizontal rule
                      hr: ({ node, ...props }) => <hr className="my-6 border-gray-200" {...props} />,
                    }}
                  >
                    {summary.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-600 mb-4">
                    No summary available for this paper yet.
                  </p>
                  <button
                    onClick={generateSummary}
                    disabled={generatingSummary}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {generatingSummary ? 'Generating...' : 'Generate First Summary'}
                  </button>
                </div>
              )}

              {/* Previous Summaries Dropdown */}
              {summaries.length > 1 && (
                <div className="mt-6 pt-6 border-t">
                  <details className="group">
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-blue-600 flex items-center gap-2">
                      <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Previous Summaries ({summaries.length - 1})
                    </summary>
                    <div className="mt-4 space-y-4">
                      {summaries.slice(1).map((prevSummary, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-gray-500">
                              Generated on {new Date(prevSummary.created_at).toLocaleString()}
                            </span>
                            <button
                              onClick={() => setSummary(prevSummary)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              View
                            </button>
                          </div>
                          <div className="prose prose-sm max-w-none line-clamp-3">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {prevSummary.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Chat Interface */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md h-[calc(100vh-12rem)] flex flex-col">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Chat with Paper</h2>
                <p className="text-sm text-gray-600">Ask questions about this paper</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                        }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <form onSubmit={sendMessage} className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Ask a question..."
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Workspaces Page Component
function WorkspacesPage() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState(null);
  const [newWorkspace, setNewWorkspace] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/workspaces`);
      setWorkspaces(response.data);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/workspaces`, newWorkspace);
      setWorkspaces([...workspaces, response.data]);
      setShowCreateModal(false);
      setNewWorkspace({ name: '', description: '' });
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/workspaces/${workspaceToDelete.id}`);
      setWorkspaces(workspaces.filter(w => w.id !== workspaceToDelete.id));
      setShowDeleteModal(false);
      setWorkspaceToDelete(null);
    } catch (error) {
      console.error('Error deleting workspace:', error);
    }
  };

  const confirmDelete = (workspace, e) => {
    e.stopPropagation(); // Prevent navigation to workspace detail
    setWorkspaceToDelete(workspace);
    setShowDeleteModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">ResearchHub AI</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-700 hover:text-blue-600">Dashboard</Link>
              <Link to="/papers" className="text-gray-700 hover:text-blue-600">Papers</Link>
              <Link to="/workspaces" className="text-gray-700 hover:text-blue-600">Workspaces</Link>
              <Link to="/search" className="text-gray-700 hover:text-blue-600">Search</Link>
              <button
                onClick={() => signOut(auth)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Workspaces</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Workspace
          </button>
        </div>

        {/* Workspaces Grid */}
        {workspaces.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 relative group"
              >
                {/* Delete Button */}
                <button
                  onClick={(e) => confirmDelete(workspace, e)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete workspace"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                {/* Main Content - Click to navigate */}
                <div
                  onClick={() => navigate(`/workspaces/${workspace.id}`)}
                  className="p-6 cursor-pointer"
                >
                  <h2 className="text-xl font-semibold text-blue-600 mb-2 pr-8">{workspace.name}</h2>
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {workspace.description || 'No description provided'}
                  </p>
                  
                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {workspace.paper_count || 0} papers
                      </span>
                    </div>
                    <span className="text-gray-400">
                      {new Date(workspace.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl shadow-md">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Workspaces Yet</h3>
            <p className="text-gray-600 mb-6">Create your first workspace to organize your research papers.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Workspace
            </button>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">Create New Workspace</h2>

              <form onSubmit={handleCreateWorkspace}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Workspace Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newWorkspace.name}
                    onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Machine Learning Research"
                    autoFocus
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newWorkspace.description}
                    onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe the purpose of this workspace..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    Create Workspace
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && workspaceToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h2 className="text-xl font-bold text-center mb-2">Delete Workspace</h2>
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to delete "{workspaceToDelete.name}"? This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setWorkspaceToDelete(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteWorkspace}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex-1"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Workspace Detail Page Component
function WorkspaceDetailPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [papers, setPapers] = useState([]);
  const [availablePapers, setAvailablePapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPapersModal, setShowAddPapersModal] = useState(false);
  const [selectedPapers, setSelectedPapers] = useState(new Set());
  const [addingPapers, setAddingPapers] = useState(false);

  useEffect(() => {
    fetchWorkspaceDetails();
  }, [workspaceId]);

  const fetchWorkspaceDetails = async () => {
    try {
      const [workspaceRes, papersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/workspaces/${workspaceId}`),
        axios.get(`${API_BASE_URL}/workspaces/${workspaceId}/papers`)
      ]);

      setWorkspace(workspaceRes.data);
      setPapers(papersRes.data);
    } catch (error) {
      console.error('Error fetching workspace details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePapers = async () => {
    try {
      // Get all user's papers
      const response = await axios.get(`${API_BASE_URL}/papers`);
      
      // Filter out papers already in this workspace
      const paperIdsInWorkspace = new Set(papers.map(p => p.id));
      const available = response.data.filter(paper => !paperIdsInWorkspace.has(paper.id));
      
      setAvailablePapers(available);
    } catch (error) {
      console.error('Error fetching available papers:', error);
    }
  };

  const handleAddPapers = async () => {
    if (selectedPapers.size === 0) return;
    
    setAddingPapers(true);
    try {
      // Add each selected paper to workspace
      const promises = Array.from(selectedPapers).map(paperId =>
        axios.post(`${API_BASE_URL}/workspaces/${workspaceId}/papers`, { paper_id: paperId })
      );
      
      await Promise.all(promises);
      
      // Refresh papers list
      const papersRes = await axios.get(`${API_BASE_URL}/workspaces/${workspaceId}/papers`);
      setPapers(papersRes.data);
      
      // Update workspace paper count
      setWorkspace({
        ...workspace,
        paper_count: papersRes.data.length
      });
      
      setShowAddPapersModal(false);
      setSelectedPapers(new Set());
    } catch (error) {
      console.error('Error adding papers:', error);
    } finally {
      setAddingPapers(false);
    }
  };

  const handleRemovePaper = async (paperId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('Remove this paper from the workspace?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/workspaces/${workspaceId}/papers/${paperId}`);
      
      // Update papers list
      setPapers(papers.filter(p => p.id !== paperId));
      
      // Update workspace paper count
      setWorkspace({
        ...workspace,
        paper_count: workspace.paper_count - 1
      });
    } catch (error) {
      console.error('Error removing paper:', error);
    }
  };

  const togglePaperSelection = (paperId) => {
    const newSelection = new Set(selectedPapers);
    if (newSelection.has(paperId)) {
      newSelection.delete(paperId);
    } else {
      newSelection.add(paperId);
    }
    setSelectedPapers(newSelection);
  };

  const openAddPapersModal = () => {
    fetchAvailablePapers();
    setShowAddPapersModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Workspace not found</p>
        <button
          onClick={() => navigate('/workspaces')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          Back to Workspaces
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">ResearchHub AI</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-700 hover:text-blue-600">Dashboard</Link>
              <Link to="/papers" className="text-gray-700 hover:text-blue-600">Papers</Link>
              <Link to="/workspaces" className="text-gray-700 hover:text-blue-600">Workspaces</Link>
              <Link to="/search" className="text-gray-700 hover:text-blue-600">Search</Link>
              <button
                onClick={() => signOut(auth)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/workspaces')}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Workspaces
        </button>

        {/* Workspace Header */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{workspace.name}</h1>
              <p className="text-gray-600 mb-4">{workspace.description || 'No description provided'}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {workspace.paper_count || 0} papers
                </span>
                <span>Created {new Date(workspace.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            
            {/* Add Papers Button */}
            <button
              onClick={openAddPapersModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Papers
            </button>
          </div>
        </div>

        {/* Papers Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-4">Papers in this Workspace</h2>
          
          {papers.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {papers.map((paper) => (
                <div
                  key={paper.id}
                  className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => navigate(`/papers/${paper.id}`)}
                >
                  <div className="flex justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-blue-600 mb-2">{paper.title}</h3>
                      <p className="text-gray-600 mb-2">
                        {paper.authors?.join(', ') || 'Unknown authors'} • {paper.year}
                      </p>
                      {paper.venue && (
                        <p className="text-sm text-gray-500 mb-2">{paper.venue}</p>
                      )}
                      <p className="text-gray-700 line-clamp-2">{paper.abstract}</p>
                      
                      {/* Tags */}
                      {paper.tags && paper.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {paper.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Remove from Workspace Button */}
                    <button
                      onClick={(e) => handleRemovePaper(paper.id, e)}
                      className="ml-4 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove from workspace"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-xl shadow-md">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Papers Yet</h3>
              <p className="text-gray-600 mb-6">Add papers to this workspace to get started.</p>
              <button
                onClick={openAddPapersModal}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Papers
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Papers Modal */}
      {showAddPapersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Add Papers to Workspace</h2>
                <button
                  onClick={() => {
                    setShowAddPapersModal(false);
                    setSelectedPapers(new Set());
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {availablePapers.length > 0 ? (
                <>
                  <div className="mb-4">
                    <p className="text-gray-600">
                      Select papers to add to "{workspace.name}"
                    </p>
                  </div>

                  <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                    {availablePapers.map((paper) => (
                      <div
                        key={paper.id}
                        onClick={() => togglePaperSelection(paper.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedPapers.has(paper.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedPapers.has(paper.id)}
                            onChange={() => togglePaperSelection(paper.id)}
                            className="mt-1"
                          />
                          <div>
                            <h3 className="font-semibold text-gray-900">{paper.title}</h3>
                            <p className="text-sm text-gray-600">
                              {paper.authors?.join(', ') || 'Unknown authors'} • {paper.year}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowAddPapersModal(false);
                        setSelectedPapers(new Set());
                      }}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddPapers}
                      disabled={selectedPapers.size === 0 || addingPapers}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {addingPapers ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Adding...
                        </>
                      ) : (
                        `Add ${selectedPapers.size} Paper${selectedPapers.size !== 1 ? 's' : ''}`
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">No papers available to add.</p>
                  <button
                    onClick={() => {
                      setShowAddPapersModal(false);
                      navigate('/papers');
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Go to Papers to create new papers
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Search Page Component
function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/search`, { query });
      setResults(response.data);
      setHasSearched(true);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">ResearchHub AI</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-700 hover:text-blue-600">Dashboard</Link>
              <Link to="/papers" className="text-gray-700 hover:text-blue-600">Papers</Link>
              <Link to="/workspaces" className="text-gray-700 hover:text-blue-600">Workspaces</Link>
              <Link to="/search" className="text-gray-700 hover:text-blue-600">Search</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Smart Search</h1>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for papers by title, author, or topic..."
              className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-lg"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Search uses AI to find semantically relevant papers in your library.
          </p>
        </form>

        {/* Results */}
        {hasSearched && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              {results.length > 0 ? `Found ${results.length} results` : 'No results found'}
            </h2>

            <div className="space-y-4">
              {results.map((paper) => (
                <div
                  key={paper.id}
                  className="bg-white p-6 rounded-xl shadow-md cursor-pointer hover:shadow-lg transition"
                  onClick={() => navigate(`/papers/${paper.id}`)}
                >
                  <h3 className="text-xl font-semibold text-blue-600 mb-2">{paper.title}</h3>
                  <p className="text-gray-600 mb-2">
                    {paper.authors?.join(', ') || 'Unknown authors'} • {paper.year}
                  </p>
                  <p className="text-gray-700 mb-2 line-clamp-3">{paper.abstract}</p>
                  {paper.similarity && (
                    <p className="text-sm text-green-600">
                      Relevance: {Math.round(paper.similarity * 100)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;