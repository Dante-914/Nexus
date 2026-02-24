import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UserAvatar.css';

export default function UserAvatar({ size = 40, onClick }) {
  const { currentUser } = useAuth();
  const [imageError, setImageError] = useState(false);

  // Get initials from display name or email
  const getInitials = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    
    if (currentUser?.email) {
      return currentUser.email[0].toUpperCase();
    }
    
    return '?';
  };

  // Generate consistent color based on user ID
  const getAvatarColor = () => {
    if (!currentUser?.uid) return '#4a90e2';
    
    const colors = [
      '#4a90e2', '#50c878', '#f39c12', '#e74c3c', '#9b59b6',
      '#3498db', '#1abc9c', '#2ecc71', '#f1c40f', '#e67e22',
      '#e84342', '#6c5ce7', '#00b894', '#00cec9', '#a29bfe'
    ];
    
    // Use user ID to pick a consistent color
    const index = currentUser.uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  if (!currentUser) return null;

  // Show image if available and no error
  if (currentUser.photoURL && !imageError) {
    return (
      <div 
        className="user-avatar"
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <img 
          src={currentUser.photoURL} 
          alt={currentUser.displayName || 'User'}
          onError={() => setImageError(true)}
          style={{ width: size, height: size }}
        />
      </div>
    );
  }

  // Fallback to initials
  return (
    <div 
      className="user-avatar initials"
      onClick={onClick}
      style={{ 
        width: size, 
        height: size,
        backgroundColor: getAvatarColor(),
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      {getInitials()}
    </div>
  );
}