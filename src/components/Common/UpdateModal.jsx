import React, { useState } from 'react';
import { Rocket, Download, X, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { downloadAndInstallUpdate } from '../../utils/nativeUpdater';

export const UpdateModal = ({ updateInfo, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!updateInfo || !updateInfo.hasUpdate) return null;

  const handleDismiss = () => {
    if (isDownloading) return; // Prevent dismissing while actively downloading
    try {
      localStorage.setItem(`dismissed_update_${updateInfo.latestVersion}`, Date.now().toString());
    } catch (_) {}
    onClose();
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadPercent(0);
    setStatusText('Starting download...');
    setErrorMessage('');

    try {
      localStorage.setItem(`dismissed_update_${updateInfo.latestVersion}`, Date.now().toString());
    } catch (_) {}

    try {
      // 🚀 Native In-App Updater: Downloads directly in background and triggers PackageInstaller
      await downloadAndInstallUpdate(updateInfo.downloadUrl, (progress) => {
        if (progress.percent >= 0) {
          setDownloadPercent(progress.percent);
          if (progress.percent >= 100) {
            setStatusText('Download complete! Opening installer...');
          } else {
            setStatusText(`Downloading... ${progress.percent}%`);
          }
        } else {
          setStatusText('Downloading update...');
        }
      });

      setStatusText('Installer launched! Follow the prompt on your screen.');
      setTimeout(() => {
        setIsDownloading(false);
        onClose();
      }, 4000);

    } catch (err) {
      console.warn('Native update failed, trying fallback:', err);
      setErrorMessage('Direct install failed. Opening download in browser...');
      
      // Fallback if running outside native Android
      setTimeout(() => {
        window.open(updateInfo.downloadUrl, '_blank');
        setIsDownloading(false);
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleDismiss}>
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
          {!isDownloading && (
            <button onClick={handleDismiss} className="icon-btn">
              <X size={18} />
            </button>
          )}
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
            maxHeight: '130px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
            {updateInfo.releaseNotes}
          </div>
        </div>

        {/* In-App Download Progress Indicator */}
        {isDownloading && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--accent-mint)' }}>
                {statusText || 'Downloading update...'}
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {downloadPercent > 0 ? `${downloadPercent}%` : ''}
              </span>
            </div>
            
            {/* Progress Track */}
            <div style={{
              width: '100%',
              height: '8px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.max(5, downloadPercent)}%`,
                background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                borderRadius: '6px',
                transition: 'width 0.2s ease'
              }} />
            </div>
            
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '6px 0 0 0', textAlign: 'center' }}>
              Downloading inside app. Android installer will open automatically!
            </p>
          </div>
        )}

        {errorMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-coral)', fontSize: '0.75rem', marginBottom: '12px' }}>
            <AlertCircle size={14} /> {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          {!isDownloading && (
            <button
              type="button"
              onClick={handleDismiss}
              className="btn-secondary"
              style={{ flex: 1, height: '48px', fontWeight: '700' }}
            >
              Later
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            className="btn-primary"
            disabled={isDownloading}
            style={{ 
              flex: isDownloading ? 1 : 2, 
              height: '48px', 
              fontSize: '0.95rem',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
            }}
          >
            {isDownloading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="spinner-border spinner-border-sm" /> Installing...
              </span>
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
