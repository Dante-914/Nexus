import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { useScrollAnimation } from './hooks/useScrollAnimation';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/dashboard';
import Todos from './pages/Todos';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import Notes from './pages/Notes';
import MoodTracker from './pages/MoodTracker';
import StudyPlanner from './pages/StudyPlanner';
import MemoryGame from './pages/MemoryGame';
import ChessGame from './pages/ChessGame';
import NewsHub from './pages/NewsHub';
import UserAvatar from './components/UserAvatar';
import { useZoom } from './hooks/useZoom';
import './App.css';

// Theme Context
export const ThemeContext = React.createContext();

function AppContent() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [manualOverride, setManualOverride] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  
  const { currentUser, logout } = useAuth();
  const { zoomLevel, isZoomedIn } = useZoom();
  const navigate = useNavigate(); // Add navigate hook

  // Auto-hide sidebar when zoomed in above 100% - ONLY if not manually overridden
  useEffect(() => {
    if (!manualOverride) {
      if (isZoomedIn) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    }
  }, [isZoomedIn, manualOverride]);

  // Theme effect
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.className = theme;
  }, [theme]);

  // Auto-dismiss indicator after 3 seconds but KEEP manualOverride true
  useEffect(() => {
    let timeoutId;
    
    if (showIndicator) {
      timeoutId = setTimeout(() => {
        setShowIndicator(false);
        // DO NOT reset manualOverride - keep sidebar state as is
      }, 3000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [showIndicator]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    setManualOverride(true); // Lock in manual mode
    setShowIndicator(true); // Show the indicator
  };

  // Reset manual override ONLY when zoom returns to normal AND user hasn't manually interacted recently
  useEffect(() => {
    if (!isZoomedIn && manualOverride) {
      // Only reset when zoom returns to normal
      setManualOverride(false);
      setShowIndicator(false);
    }
  }, [isZoomedIn]);

  // Handle click outside to dismiss indicator
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showIndicator) {
        const indicator = document.querySelector('.manual-override-indicator');
        if (indicator && !indicator.contains(event.target)) {
          setShowIndicator(false);
          // DO NOT reset manualOverride
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showIndicator]);

  // Handle navigation to dashboard
  const goToDashboard = () => {
    if (currentUser) {
      navigate('/');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`app ${theme}`}>
        {/* Header - Always Visible */}
        <header className="app-header">
          <div className="header-left">
            {currentUser && (
              <button 
                className={`menu-toggle ${sidebarOpen ? 'active' : ''}`}
                onClick={toggleSidebar}
                aria-label="Toggle menu"
              >
                <span className="menu-icon"></span>
                <span className="menu-icon"></span>
                <span className="menu-icon"></span>
              </button>
            )}
            {/* Make NEXUS clickable */}
            <h1 
              className={`gradient-text ${currentUser ? 'clickable' : ''}`} 
              onClick={goToDashboard}
              role={currentUser ? 'button' : 'heading'}
              tabIndex={currentUser ? 0 : -1}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && currentUser) {
                  goToDashboard();
                }
              }}
              style={{ cursor: currentUser ? 'pointer' : 'default' }}
            >
              NEXUS
            </h1>
          </div>
          
          <div className="header-right">
            {currentUser && <UserAvatar size={35} />}
            <button className="theme-toggle-header" onClick={toggleTheme}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </header>

        {/* Zoom indicator (optional) */}
        <div className="zoom-indicator">
          Zoom: {Math.round(zoomLevel * 100)}%
        </div>

        {/* Sidebar */}
        {currentUser && (
          <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'} ${isZoomedIn && !manualOverride ? 'zoom-hidden' : ''}`}>
            <div className="sidebar-header">
              {/* Make NX clickable */}
              <h2 
                className="gradient-text clickable" 
                onClick={goToDashboard}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    goToDashboard();
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                NX
              </h2>
            </div>
            
            {/* User Info */}
            <div className="user-info">
              <UserAvatar size={45} />
              <div className="user-details">
                <p className="user-name">{currentUser.displayName || 'User'}</p>
                <p className="user-email">{currentUser.email}</p>
              </div>
            </div>

            <nav className="sidebar-nav">
              <Link to="/" className="nav-item" onClick={() => setSidebarOpen(false)}>📊 Dashboard</Link>
              <Link to="/todos" className="nav-item" onClick={() => setSidebarOpen(false)}>✓ Todos</Link>
              <Link to="/notes" className="nav-item" onClick={() => setSidebarOpen(false)}>📝 Notes</Link>
              <Link to="/mood" className="nav-item" onClick={() => setSidebarOpen(false)}>😊 Mood</Link>
              <Link to="/chess" className="nav-item" onClick={() => setSidebarOpen(false)}>♟️ Chess</Link>
              <Link to="/memory" className="nav-item" onClick={() => setSidebarOpen(false)}>🎮 Memory</Link>
              <Link to="/study" className="nav-item" onClick={() => setSidebarOpen(false)}>📚 Study</Link>
              <Link to="/news" className="nav-item" onClick={() => setSidebarOpen(false)}>📰 News</Link>
            </nav>
            
            <div className="sidebar-footer">
              <button className="theme-toggle" onClick={toggleTheme}>
                {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </button>
              <button className="logout-btn" onClick={logout}>
                Logout
              </button>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className={`main-content ${!currentUser ? 'no-sidebar' : ''} ${sidebarOpen ? 'sidebar-visible' : 'sidebar-hidden'}`}>
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

        {/* Zoom warning - only show when auto-hidden */}
        {isZoomedIn && !manualOverride && !sidebarOpen && (
          <div className="zoom-warning">
            <span>Zoomed in: Sidebar hidden</span>
            <button onClick={() => {
              setManualOverride(true);
              setSidebarOpen(true);
              setShowIndicator(true);
            }}>Show</button>
          </div>
        )}

        {/* Manual override indicator - only shows for 3 seconds, doesn't reset state */}
        {showIndicator && (
          <div className="manual-override-indicator">
            <span>Manual mode</span>
            <button 
              className="auto-btn"
              onClick={(e) => {
                e.stopPropagation();
                setManualOverride(false);
                setShowIndicator(false);
                if (!isZoomedIn) {
                  setSidebarOpen(true);
                }
              }}
            >
              Auto
            </button>
            <button 
              className="dismiss-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowIndicator(false);
                // DO NOT reset manualOverride - keep sidebar state
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
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