import React from 'react';
import { avatarOnError, getAvatarUrl } from '../../utils/avatarHelper';

export const Header = ({ 
  currentUser, 
  onOpenProfile 
}) => {
  return (
    <header className="app-header">
      <div 
        className="user-profile-badge" 
        onClick={onOpenProfile}
        title="Tap to view your profile details"
      >
        <img
          src={getAvatarUrl(currentUser)}
          alt={currentUser?.name || 'You'}
          className="avatar-img"
          onError={avatarOnError(currentUser?.name || 'You')}
        />
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: '800', lineHeight: '1.2' }}>
            {currentUser?.name || 'You'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-mint)', fontWeight: '700' }}>
            Tap for Profile
          </div>
        </div>
      </div>

      <div className="header-actions">
        {/* INR Currency Badge */}
        <div
          style={{
            padding: '5px 12px',
            fontSize: '0.8rem',
            borderRadius: '14px',
            background: 'var(--bg-card)',
            fontWeight: '800',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          ₹ INR
        </div>
      </div>
    </header>
  );
};
