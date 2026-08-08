import React, { useState } from 'react';
import { X, User, Phone, Mail, LogOut, Trash2, Check, Sparkles, AlertTriangle } from 'lucide-react';

export const ProfileModal = ({ currentUser, onClose, onUpdateProfile, onLogout, onResetData }) => {
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [isSaved, setIsSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdateProfile({
      ...currentUser,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={22} color="var(--accent-mint)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>User Profile</h2>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X size={18} />
          </button>
        </div>

        {/* Profile Card Summary Header */}
        <div 
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '16px',
          }}
        >
          <img src={currentUser?.avatar} alt={currentUser?.name} style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid var(--accent-mint)' }} />
          <div>
            <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{currentUser?.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{currentUser?.email || currentUser?.phone}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-mint)', fontWeight: '700', marginTop: '2px' }}>
              ● Registered Active Account
            </div>
          </div>
        </div>

        {isSaved && (
          <div style={{ background: 'var(--accent-mint-glow)', color: 'var(--accent-mint)', padding: '10px', borderRadius: '12px', textAlign: 'center', fontWeight: '700', fontSize: '0.85rem', marginBottom: '14px' }}>
            Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <input 
              type="tel" 
              className="form-input" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button type="submit" className="btn-primary" style={{ flex: 2 }}>
              Save Profile Changes
            </button>
            {onLogout && (
              <button 
                type="button" 
                onClick={onLogout} 
                className="btn-secondary" 
                style={{ flex: 1, color: 'var(--accent-coral)' }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            )}
          </div>

          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
            {showResetConfirm ? (
              <div 
                style={{ 
                  background: 'rgba(185, 28, 28, 0.12)', 
                  border: '1px solid var(--accent-coral)', 
                  padding: '14px', 
                  borderRadius: '16px', 
                  textAlign: 'center' 
                }}
              >
                <div style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--accent-coral)', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} /> Wipe All Data & Start Fresh?
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  This will clear all expenses, groups, and settlements, and return to fresh registration.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowResetConfirm(false)} 
                    className="btn-secondary" 
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (onResetData) onResetData();
                      onClose();
                    }} 
                    className="btn-primary" 
                    style={{ flex: 1, background: 'var(--accent-coral)', color: '#fff' }}
                  >
                    Yes, Wipe Everything
                  </button>
                </div>
              </div>
            ) : (
              <button 
                type="button" 
                onClick={() => setShowResetConfirm(true)} 
                className="btn-secondary" 
                style={{ width: '100%', color: 'var(--accent-coral)', justifyContent: 'center' }}
              >
                <Trash2 size={16} /> Reset All Data / Start Fresh
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
