import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export const SplashScreen = ({ onFinish }) => {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Show splash for 1.8 seconds, then trigger fade out
    const timer1 = setTimeout(() => {
      setFade(true);
    }, 1800);

    const timer2 = setTimeout(() => {
      onFinish();
    }, 2200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onFinish]);

  return (
    <div
      onClick={onFinish}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg-primary, #0f172a)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fade ? 0 : 1,
        transform: fade ? 'scale(1.05)' : 'scale(1)',
        transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Subtle background glow circle */}
      <div
        style={{
          position: 'absolute',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.08) 50%, transparent 70%)',
          filter: 'blur(30px)',
          animation: 'pulseGlow 2s ease-in-out infinite alternate',
        }}
      />

      {/* App Logo */}
      <div
        style={{
          width: '96px',
          height: '96px',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          marginBottom: '20px',
          animation: 'logoEntrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src="/app-logo.png"
          alt="FairShare"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      </div>

      {/* Welcome Title */}
      <div style={{ textAlign: 'center', animation: 'textFadeIn 0.9s ease-out forwards' }}>
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: '900',
            letterSpacing: '-0.5px',
            margin: '0 0 6px 0',
            color: 'var(--text-primary, #ffffff)',
          }}
        >
          FairShare
        </h1>
        <p
          style={{
            fontSize: '0.88rem',
            fontWeight: '600',
            color: 'var(--accent-mint, #10b981)',
            margin: '0 0 18px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Sparkles size={14} /> Welcome to FairShare
        </p>
      </div>

      {/* Modern Minimal Progress Dots */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        <span className="splash-dot" style={{ animationDelay: '0s' }} />
        <span className="splash-dot" style={{ animationDelay: '0.2s' }} />
        <span className="splash-dot" style={{ animationDelay: '0.4s' }} />
      </div>

      <style>{`
        @keyframes logoEntrance {
          0% { transform: scale(0.6) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes textFadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0% { transform: scale(0.9); opacity: 0.6; }
          100% { transform: scale(1.1); opacity: 1; }
        }
        .splash-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-mint, #10b981);
          animation: dotBounce 1.2s infinite ease-in-out;
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
