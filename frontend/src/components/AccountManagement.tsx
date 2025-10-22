import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AccountManagement.css';

interface AccountManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountManagement: React.FC<AccountManagementProps> = ({ isOpen, onClose }) => {
  const { user, signOut } = useAuth();

  if (!isOpen || !user) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const getUserInitials = () => {
    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email?.[0].toUpperCase() || 'U';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content account-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        
        <div className="account-header">
          <div className="account-avatar">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Profile" />
            ) : (
              <span>{getUserInitials()}</span>
            )}
          </div>
          <h2>Account Settings</h2>
        </div>

        <div className="account-info">
          <div className="info-section">
            <label>Name</label>
            <div className="info-value">
              {user.user_metadata?.full_name || 'Not provided'}
            </div>
          </div>

          <div className="info-section">
            <label>Email</label>
            <div className="info-value">{user.email}</div>
          </div>

          <div className="info-section">
            <label>Account Created</label>
            <div className="info-value">
              {new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>

          <div className="info-section">
            <label>Authentication Provider</label>
            <div className="info-value provider">
              <svg className="provider-icon" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </div>
          </div>
        </div>

        <div className="account-actions">
          <button className="sign-out-button" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

