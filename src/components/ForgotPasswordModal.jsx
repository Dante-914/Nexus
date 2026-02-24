import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ForgotPasswordModal.css';

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    try {
      setMessage('');
      setError('');
      setLoading(true);
      
      await resetPassword(email);
      
      setMessage('Password reset email sent! Check your inbox.');
      setEmail('');
      
      // Close modal after 3 seconds on success
      setTimeout(() => {
        onClose();
        setMessage('');
      }, 3000);
      
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setMessage('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>×</button>
        
        <div className="modal-header">
          <h2>Reset Password</h2>
          <p>Enter your email address and we'll send you a link to reset your password.</p>
        </div>

        {message && (
          <div className="success-message">
            {message}
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="reset-email">Email Address</label>
            <input
              type="email"
              id="reset-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              className="form-input"
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              onClick={handleClose} 
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Email'}
            </button>
          </div>
        </form>

        <div className="modal-footer">
          <p>Remember your password? <a href="#" onClick={(e) => { e.preventDefault(); handleClose(); }}>Sign In</a></p>
        </div>
      </div>
    </div>
  );
}