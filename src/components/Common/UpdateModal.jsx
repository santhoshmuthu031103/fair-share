import React, { useState } from 'react';
import { Rocket, Download, X, Sparkles, ExternalLink } from 'lucide-react';

export const UpdateModal = ({ updateInfo, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!updateInfo || !updateInfo.hasUpdate) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(`dismissed_update_${updateInfo.latestVersion}`, Date.now().toString());
    } catch (_) {}
    onClose();
  };

  const handleDownload = () => {
    setIsDownloading(true);
    try {
      localStorage.setItem(`dismissed_update_${updateInfo.latestVersion}`, Date.now().toString());
    } catch (_) {}
    if (updateInfo.downloadUrl) {
      window.open(updateInfo.downloadUrl, '_system');
    }
    setTimeout(() => {
      setIsDownloading(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="bottom-sheet" 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(16, 185, 129, 0.05) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div className="sheet-handle" />

        {/* Header with Close */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: 'rgba(16, 185, 129, 0.15)',
              padding: '6px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-mint)'
            }}>
              <Rocket size={20} />
            </span>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0 }}>Update Available!</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                v{updateInfo.currentVersion} ➔ <strong style={{ color: 'var(--accent-mint)' }}>v{updateInfo.latestVersion}</strong>
              </span>
            </div>
          </div>
          <button onClick={handleDismiss} className="icon-btn">
            <X size={18} />
          </button>
        </div>

        {/* Highlight Card */}
        <div style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '14px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent-amber)', fontSize: '0.8rem', fontWeight: '700' }}>
            <Sparkles size={14} /> What's New in {updateInfo.releaseTag || `v${updateInfo.latestVersion}`}
          </div>
          <div style={{ 
            fontSize: '0.82rem', 
            color: 'var(--text-secondary)', 
            lineHeight: '1.45', 
            whiteSpace: 'pre-line',
            maxHeight: '140px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
            {updateInfo.releaseNotes}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={handleDismiss}
            className="btn-secondary"
            style={{ flex: 1, height: '48px', fontWeight: '700' }}
          >
            Later
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="btn-primary"
            disabled={isDownloading}
            style={{ 
              flex: 2, 
              height: '48px', 
              fontSize: '0.95rem',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
            }}
          >
            {isDownloading ? (
              <span>Downloading...</span>
            ) : (
              <>
                <Download size={18} /> Update Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
