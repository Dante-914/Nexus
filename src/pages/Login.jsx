import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError('');
      setLoading(true);
      await signInWithEmail(email, password);
      navigate('/');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (error.code === 'auth/wrong-password') {
        setError('Incorrect password');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Try again later.');
      } else {
        setError('Failed to sign in: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await signInWithGoogle();
      navigate('/');
    } catch (error) {
      setError('Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <h1>NEXUS</h1>
              <p className="auth-subtitle">Welcome Back</p>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="form-input password-input"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="forgot-password-container">
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot Password?
                </button>
              </div>
              
              <button 
                type="submit" 
                disabled={loading} 
                className="auth-button primary"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
            
            <div className="auth-divider">
              <span>or</span>
            </div>
            
            <button 
              onClick={handleGoogleSignIn} 
              className="google-btn" 
              disabled={loading}
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" />
              Sign in with Google
            </button>
            
            <p className="auth-redirect">
              Don't have an account? <Link to="/signup">Sign Up</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal 
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </>
  );
}