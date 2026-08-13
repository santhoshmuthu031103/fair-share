import React, { useState, useEffect, useMemo } from 'react';
import { X, Dices, ArrowRight, Users, Type } from 'lucide-react';
import { getAvatarUrl, avatarOnError } from '../../utils/avatarHelper';

export const DebtRouletteModal = ({ onClose, friends, currentUser, onSelectPayer }) => {
  const [mode, setMode] = useState('friends'); // 'friends' | 'custom'
  const [customText, setCustomText] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Compute the list of options to spin through
  const participants = useMemo(() => {
    if (mode === 'friends') {
      let list = [...friends];
      if (currentUser && !list.find(f => f.id === currentUser.id)) {
        list = [currentUser, ...list];
      }
      return list.filter(Boolean);
    } else {
      // Split by comma or newline and filter out empty strings
      const opts = customText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      return opts.map((text, idx) => ({ id: `custom_${idx}`, name: text, isCustom: true }));
    }
  }, [mode, friends, currentUser, customText]);

  const spinRoulette = () => {
    if (participants.length < 2) {
      alert(`You need at least 2 options to spin! (${participants.length} provided)`);
      return;
    }
    
    setIsSpinning(true);
    setWinner(null);
    
    const spinDuration = 3000; // 3 seconds
    const intervalTime = 100; // Change name every 100ms
    const totalTicks = spinDuration / intervalTime;
    
    let currentTick = 0;
    const intervalId = setInterval(() => {
      currentTick++;
      
      // Randomize index during spin
      setCurrentIndex(Math.floor(Math.random() * participants.length));
      
      if (currentTick >= totalTicks) {
        clearInterval(intervalId);
        setIsSpinning(false);
        // Final winner
        const finalWinner = participants[Math.floor(Math.random() * participants.length)];
        setWinner(finalWinner);
      }
    }, intervalTime);
  };

  const handleProceed = () => {
    if (winner && !winner.isCustom) {
      onSelectPayer(winner.id);
    } else {
      onClose(); // If it's a custom decision, just close
    }
  };

  // Helper to render an avatar or a colorful letter block for custom options
  const renderAvatar = (item, size = 64, isWinner = false) => {
    if (!item.isCustom) {
      return (
        <img 
          src={getAvatarUrl(item)} 
          alt={item.name} 
          style={{ 
            width: `${size}px`, 
            height: `${size}px`, 
            borderRadius: '50%', 
            objectFit: 'cover', 
            border: isWinner ? '3px solid #8b5cf6' : '3px solid var(--text-muted)', 
            marginBottom: '8px',
            filter: isSpinning ? 'blur(1px)' : 'none'
          }} 
          onError={avatarOnError(item.name)}
        />
      );
    }

    // Colorful block for custom options
    const colors = ['#f43f5e', '#f97316', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    const color = colors[item.name.length % colors.length];

    return (
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '16px',
        background: color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        fontWeight: '800',
        marginBottom: '8px',
        border: isWinner ? '3px solid #8b5cf6' : '3px solid transparent',
        filter: isSpinning ? 'blur(1px)' : 'none'
      }}>
        {item.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ textAlign: 'center', position: 'relative' }}>
        <button onClick={onClose} className="icon-btn" style={{ position: 'absolute', right: '16px', top: '16px', zIndex: 10 }}>
          <X size={20} />
        </button>
        
        <div style={{ marginBottom: '16px', marginTop: '10px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', marginBottom: '12px' }}>
            <Dices size={28} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>Decision Wheel</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Let fate decide!</p>
        </div>

        {/* Mode Toggle */}
        {!isSpinning && !winner && (
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '12px', padding: '4px', marginBottom: '16px' }}>
            <button 
              onClick={() => setMode('friends')}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none', 
                background: mode === 'friends' ? '#8b5cf6' : 'transparent',
                color: mode === 'friends' ? '#fff' : 'var(--text-secondary)',
                fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <Users size={16} /> Who Pays?
            </button>
            <button 
              onClick={() => setMode('custom')}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none', 
                background: mode === 'custom' ? '#8b5cf6' : 'transparent',
                color: mode === 'custom' ? '#fff' : 'var(--text-secondary)',
                fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <Type size={16} /> Custom Options
            </button>
          </div>
        )}

        {/* Custom Input Field */}
        {mode === 'custom' && !isSpinning && !winner && (
          <div style={{ marginBottom: '16px', textAlign: 'left' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Enter options (separated by commas)
            </label>
            <textarea 
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="e.g. Pizza, Burgers, Tacos, Salad"
              style={{
                width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)',
                background: 'var(--bg-input)', color: 'var(--text-primary)', minHeight: '60px',
                resize: 'vertical', fontSize: '0.9rem'
              }}
            />
          </div>
        )}

        {/* The Spinner UI */}
        <div style={{ 
          height: '140px', 
          background: 'var(--bg-input)', 
          borderRadius: '16px', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: '24px',
          border: winner ? '2px solid #8b5cf6' : '2px solid transparent',
          transition: 'all 0.3s ease',
          boxShadow: winner ? '0 0 20px rgba(139, 92, 246, 0.3)' : 'none',
          overflow: 'hidden',
          padding: '10px'
        }}>
          {participants.length === 0 && mode === 'custom' ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Type something above to start.</p>
          ) : participants.length < 2 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Need at least 2 options.</p>
          ) : (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              transform: isSpinning ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.1s ease',
              opacity: (isSpinning || winner) ? 1 : 0.5
            }}>
              {winner ? (
                <>
                  {renderAvatar(winner, 64, true)}
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#8b5cf6' }}>
                    {!winner.isCustom && winner.id === currentUser?.id ? 'You' : winner.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
                    {winner.isCustom ? 'The Decision is Made!' : 'Pays the Bill!'}
                  </div>
                </>
              ) : (
                <>
                  {renderAvatar(participants[currentIndex], 64, false)}
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', filter: isSpinning ? 'blur(1px)' : 'none' }}>
                    {!participants[currentIndex].isCustom && participants[currentIndex].id === currentUser?.id ? 'You' : participants[currentIndex].name}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {winner ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!winner.isCustom ? (
              <button 
                onClick={handleProceed} 
                className="btn-primary" 
                style={{ background: '#8b5cf6', color: '#fff', fontSize: '1rem', height: '50px' }}
              >
                Add Expense for {winner.id === currentUser?.id ? 'You' : winner.name.split(' ')[0]} <ArrowRight size={18} />
              </button>
            ) : (
              <button 
                onClick={handleProceed} 
                className="btn-primary" 
                style={{ background: '#8b5cf6', color: '#fff', fontSize: '1rem', height: '50px' }}
              >
                Awesome! <ArrowRight size={18} />
              </button>
            )}
            <button 
              onClick={spinRoulette} 
              className="btn-secondary" 
              style={{ fontSize: '0.9rem', border: 'none', background: 'transparent' }}
            >
              Spin Again (Best 2 out of 3?)
            </button>
          </div>
        ) : (
          <button 
            onClick={spinRoulette} 
            disabled={isSpinning || participants.length < 2}
            className="btn-primary" 
            style={{ 
              background: isSpinning ? 'var(--bg-input)' : '#8b5cf6', 
              color: isSpinning ? 'var(--text-muted)' : '#fff', 
              fontSize: '1.1rem', 
              height: '54px' 
            }}
          >
            {isSpinning ? 'Spinning...' : 'Spin the Wheel!'}
          </button>
        )}
      </div>
    </div>
  );
};
