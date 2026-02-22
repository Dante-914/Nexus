import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { useScrollAnimation } from './hooks/useScrollAnimation';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Todos from './pages/Todos';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import Notes from './pages/Notes';
import MoodTracker from './pages/MoodTracker';
import StudyPlanner from './pages/StudyPlanner';
import MemoryGame from './pages/MemoryGame';
import ChessGame from './pages/ChessGame';
import NewsHub from './pages/NewsHub';
import './App.css';

// Theme Context
export const ThemeContext = React.createContext();

function AppContent() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.innerWidth > 768;
  });
  
  const { currentUser, logout } = useAuth();

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.className = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sidebarOpen', sidebarOpen);
  }, [sidebarOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      } else {
        const saved = localStorage.getItem('sidebarOpen');
        if (saved === null) {
          setSidebarOpen(true);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`app ${theme}`}>
        {/* Mobile Header */}
        <header className="mobile-header">
          <button 
            className="menu-toggle"
            onClick={toggleSidebar}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <h1 className="gradient-text">NEXUS</h1>
          <button className="theme-toggle-mobile" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </header>

        {/* Sidebar - only show if logged in */}
        {currentUser && (
          <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
              <h2 className="gradient-text">NX</h2>
              <button 
                className="close-sidebar" 
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>
            
            {/* User Info */}
            <div className="user-info">
              <img src={currentUser.photoURL || 'https://via.placeholder.com/40'} alt="profile" />
              <div>
                <p className="user-name">{currentUser.displayName || 'User'}</p>
                <p className="user-email">{currentUser.email}</p>
              </div>
            </div>

            <nav className="sidebar-nav">
              <Link to="/" className="nav-item" onClick={() => {
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}>
                Dashboard
              </Link>
              <Link to="/todos" className="nav-item" onClick={() => {
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}>
                Todos
              </Link>
              <Link to="/notes" className="nav-item" onClick={() => {
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}>
                Notes
              </Link>
              <Link to="/mood" className="nav-item" onClick={() => {
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}>
                Mood
              </Link>
              <Link to="/study" className="nav-item" onClick={() => {
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}>
                Study
              </Link>
              <Link to="/memory" className="nav-item" onClick={() => {
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}>
                Memory
              </Link>
              <Link to="/chess" className="nav-item" onClick={() => {
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}>
                Chess
              </Link>
              <Link to="/news" className="nav-item" onClick={() => {
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}>
                News
              </Link>
            </nav>
            
            <div className="sidebar-footer">
              <button className="theme-toggle" onClick={toggleTheme}>
                {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </button>
              <button className="logout-btn" onClick={logout}>
                🚪 Logout
              </button>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className={`main-content ${!currentUser ? 'no-sidebar' : ''}`}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/todos" element={
              <ProtectedRoute>
                <Todos />
              </ProtectedRoute>
            } />
            <Route path="/notes" element={
              <ProtectedRoute>
                <Notes />
              </ProtectedRoute>
            } />
            <Route path="/mood" element={
              <ProtectedRoute>
                <MoodTracker />
              </ProtectedRoute>
            } />
            <Route path="/study" element={
              <ProtectedRoute>
                <StudyPlanner />
              </ProtectedRoute>
            } />
            <Route path="/memory" element={
              <ProtectedRoute>
                <MemoryGame />
              </ProtectedRoute>
            } />
            <Route path="/chess" element={
              <ProtectedRoute>
                <ChessGame />
              </ProtectedRoute>
            } />
            <Route path="/news" element={
              <ProtectedRoute>
                <NewsHub />
              </ProtectedRoute>
            } />
          </Routes>
        </main>

        {/* Mobile Bottom Navigation - only show if logged in */}
        {currentUser && (
          <nav className="bottom-nav">
            <Link to="/" className="bottom-nav-item">📊</Link>
            <Link to="/todos" className="bottom-nav-item">✓</Link>
            <Link to="/notes" className="bottom-nav-item">📝</Link>
            <Link to="/mood" className="bottom-nav-item">😊</Link>
            <Link to="/study" className="bottom-nav-item">📚</Link>
            <Link to="/news" className="bottom-nav-item">📰</Link>
          </nav>
        )}
      </div>
    </ThemeContext.Provider>
  );
}

// Dashboard Component
function Dashboard() {
  const { currentUser } = useAuth();
  const [recentTodos, setRecentTodos] = useState([]);
  const [todoStats, setTodoStats] = useState({
    total: 0,
    completed: 0,
    active: 0
  });
  const [loading, setLoading] = useState(true);

  // Animation refs
  const [headerRef, headerVisible] = useScrollAnimation();
  const [statsRef, statsVisible] = useScrollAnimation();
  const [recentRef, recentVisible] = useScrollAnimation();
  const [quickRef, quickVisible] = useScrollAnimation();
  const [tipRef, tipVisible] = useScrollAnimation();

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'todos'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todos = [];
      snapshot.forEach((doc) => {
        todos.push({ id: doc.id, ...doc.data() });
      });

      const completed = todos.filter(t => t.completed).length;
      const active = todos.filter(t => !t.completed).length;

      setTodoStats({
        total: todos.length,
        completed,
        active
      });

      const recent = [...todos]
        .sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.toMillis() - a.createdAt.toMillis();
          }
          return 0;
        })
        .slice(0, 3);

      setRecentTodos(recent);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  const formatDate = (dueDate) => {
    if (!dueDate) return 'No due date';
    
    if (typeof dueDate === 'string') {
      const [year, month, day] = dueDate.split('-');
      return `${day}/${month}/${year}`;
    }
    
    if (dueDate.toDate) {
      const date = dueDate.toDate();
      return date.toLocaleDateString('en-GB');
    }
    
    return 'No due date';
  };

  return (
    <div className="dashboard">
      <h1 
        ref={headerRef}
        className={`animate-on-scroll fade-in-up ${headerVisible ? 'visible' : ''}`}
      >
        Welcome back, {currentUser?.displayName || 'User'}!
      </h1>
      
      <div className="dashboard-grid">
        {/* Stats Card */}
        <div 
          ref={statsRef}
          className={`dashboard-card stats-card animate-on-scroll slide-in-left ${statsVisible ? 'visible' : ''}`}
        >
          <h3>Task Overview</h3>
          <div className="stats-container">
            <div className="stat-item hover-lift">
              <span className="stat-label">Total Tasks</span>
              <span className="stat-value total">{todoStats.total}</span>
            </div>
            <div className="stat-item hover-lift">
              <span className="stat-label">Active</span>
              <span className="stat-value active">{todoStats.active}</span>
            </div>
            <div className="stat-item hover-lift">
              <span className="stat-label">Completed</span>
              <span className="stat-value completed">{todoStats.completed}</span>
            </div>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: todoStats.total > 0 
                  ? `${(todoStats.completed / todoStats.total) * 100}%` 
                  : '0%' 
              }}
            ></div>
          </div>
          <Link to="/todos" className="card-link hover-scale">View all tasks →</Link>
        </div>

        {/* Recent Tasks Card */}
        <div 
          ref={recentRef}
          className={`dashboard-card recent-todos-card animate-on-scroll fade-in-up ${recentVisible ? 'visible' : ''}`}
        >
          <h3>Recent Tasks</h3>
          {loading ? (
            <div className="skeleton-list">
              <div className="skeleton-item shimmer"></div>
              <div className="skeleton-item shimmer"></div>
              <div className="skeleton-item shimmer"></div>
            </div>
          ) : recentTodos.length > 0 ? (
            <ul className="recent-todos-list stagger-children visible">
              {recentTodos.map((todo, index) => (
                <li 
                  key={todo.id} 
                  className="recent-todo-item hover-lift"
                  style={{ transitionDelay: `${index * 0.1}s` }}
                >
                  <span className={`todo-status ${todo.completed ? 'completed' : 'pending'}`}>
                    {todo.completed ? '✓' : '○'}
                  </span>
                  <span className={`todo-title ${todo.completed ? 'completed-text' : ''}`}>
                    {todo.text}
                  </span>
                  {todo.dueDate && (
                    <span className="todo-due-date">
                      📅 {formatDate(todo.dueDate)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-message">No tasks yet. Create your first task!</p>
          )}
          <Link to="/todos" className="card-link hover-scale">Manage tasks →</Link>
        </div>

        {/* Quick Actions Card */}
        <div 
          ref={quickRef}
          className={`dashboard-card quick-add-card animate-on-scroll slide-in-right ${quickVisible ? 'visible' : ''}`}
        >
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <Link to="/todos" className="quick-action-btn hover-scale">
              <span className="quick-icon">✓</span>
              <span>Add Task</span>
            </Link>
            <Link to="/notes" className="quick-action-btn hover-scale">
              <span className="quick-icon">📝</span>
              <span>New Note</span>
            </Link>
            <Link to="/mood" className="quick-action-btn hover-scale">
              <span className="quick-icon">😊</span>
              <span>Log Mood</span>
            </Link>
          </div>
        </div>

        {/* Tip Card */}
        <div 
          ref={tipRef}
          className={`dashboard-card tip-card animate-on-scroll scale-in ${tipVisible ? 'visible' : ''}`}
        >
          <h3>Productivity Tip</h3>
          <p className="fade-in">
            {todoStats.active > 0 
              ? `You have ${todoStats.active} active tasks. Start with the smallest one!` 
              : todoStats.completed > 0 
                ? `Great job! You've completed ${todoStats.completed} tasks. Time for a break?` 
                : "Add your first task to get started!"}
          </p>
          <div className="tip-decoration bounce">✨</div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;