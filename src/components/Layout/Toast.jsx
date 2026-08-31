import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`toast ${type}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {type === 'success' ? (
          <CheckCircle2 size={18} color="var(--accent-mint)" />
        ) : (
          <AlertCircle size={18} color="var(--accent-coral)" />
        )}
        <span className="toast-message">{message}</span>
      </div>
    </div>
  );
};
