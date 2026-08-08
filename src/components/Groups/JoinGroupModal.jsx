import React, { useState } from 'react';
import { X, LogIn, Loader } from 'lucide-react';
import { fetchCloudGroup } from '../../utils/firebaseSync';

export const JoinGroupModal = ({ onClose, onJoinGroup }) => {
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length < 4) {
      setError('Please enter a valid sync code (at least 4 characters)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cloudData = await fetchCloudGroup(clean);
      if (!cloudData) {
        setError(`No group found with code "${clean}". Ask your friend to share the correct code.`);
        setLoading(false);
        return;
      }
      // Pass the cloud data up to App to merge into state
      onJoinGroup(clean, cloudData);
    } catch (err) {
      setError('Could not connect. Check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Join a Group</h2>
          <button onClick={onClose} className="icon-btn"><X size={18} /></button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
          Ask your friend to open their group and share the <strong>⚡ Live Sync Code</strong>. Enter it below to join and sync instantly.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Sync Code (from your friend's group)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. A3B9C1"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
              maxLength={8}
              autoFocus
              style={{
                textAlign: 'center',
                fontSize: '1.4rem',
                fontWeight: '800',
                letterSpacing: '0.2em',
                ...(error ? { borderColor: 'var(--accent-coral)', boxShadow: '0 0 0 2px rgba(244,63,94,0.18)' } : {}),
              }}
            />
            {error && (
              <div style={{ fontSize: '0.76rem', color: 'var(--accent-coral)', marginTop: '6px' }}>
                ⚠ {error}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || code.trim().length < 4}
            style={{ width: '100%', height: '50px', fontSize: '0.95rem', marginTop: '10px', gap: '8px', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</> : <><LogIn size={16} /> Join Group</>}
          </button>
        </form>
      </div>
    </div>
  );
};
