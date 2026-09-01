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
        background: 'linear-gradient(145deg, #0b1329 0%, #1e3a8a 50%, #2563eb 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fade ? 0 : 1,
        transform: fade ? 'scale(1.04)' : 'scale(1)',
        transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Ambient background glow circle */}
      <div
        style={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.15) 50%, transparent 70%)',
          filter: 'blur(35px)',
          animation: 'pulseGlow 2.5s ease-in-out infinite alternate',
        }}
      />

      {/* App Logo Card */}
      <div
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '26px',
          overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35), 0 0 0 2px rgba(255, 255, 255, 0.2)',
          marginBottom: '22px',
          animation: 'logoEntrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
        }}
      >
        <img
          src="/app-logo.png"
          alt="FairShare Logo"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      </div>

      {/* Tagline only — logo already has the FairShare name */}
      <div style={{ textAlign: 'center', animation: 'textFadeIn 0.9s ease-out forwards', zIndex: 1 }}>
        <p
          style={{
            fontSize: '0.92rem',
            fontWeight: '600',
            color: '#93c5fd',
            margin: '0 0 20px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          <Sparkles size={15} color="#60a5fa" /> Split expenses, fairly.
        </p>
      </div>

      {/* Modern Minimal White Progress Dots */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', zIndex: 1 }}>
        <span className="splash-dot" style={{ animationDelay: '0s' }} />
        <span className="splash-dot" style={{ animationDelay: '0.2s' }} />
        <span className="splash-dot" style={{ animationDelay: '0.4s' }} />
      </div>

      <style>{`
        @keyframes logoEntrance {
          0% { transform: scale(0.5) translateY(25px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes textFadeIn {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0% { transform: scale(0.85); opacity: 0.5; }
          100% { transform: scale(1.15); opacity: 0.9; }
        }
        .splash-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
          animation: dotBounce 1.2s infinite ease-in-out;
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
          40% { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
