import React, { useState, useEffect } from 'react';
import { X, Dices, ArrowRight } from 'lucide-react';
import { getAvatarUrl, avatarOnError } from '../../utils/avatarHelper';

export const DebtRouletteModal = ({ onClose, friends, currentUser, onSelectPayer }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // We only want to spin among friends (including current user if available)
  // Ensure we have a valid array of members to pick from
  const participants = React.useMemo(() => {
    let list = [...friends];
    if (currentUser && !list.find(f => f.id === currentUser.id)) {
      list = [currentUser, ...list];
    }
    return list.filter(Boolean);
  }, [friends, currentUser]);

  const spinRoulette = () => {
    if (participants.length < 2) {
      alert("You need at least 2 people to play Debt Roulette!");
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
    if (winner) {
      onSelectPayer(winner.id);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ textAlign: 'center', position: 'relative' }}>
        <button onClick={onClose} className="icon-btn" style={{ position: 'absolute', right: '16px', top: '16px' }}>
          <X size={20} />
        </button>
        
        <div style={{ marginBottom: '24px', marginTop: '10px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', marginBottom: '16px' }}>
            <Dices size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>Debt Roulette</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Let fate decide who pays the bill tonight.</p>
        </div>

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
          overflow: 'hidden'
        }}>
          {participants.length < 2 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Not enough friends to play.</p>
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
                  <img 
                    src={getAvatarUrl(winner)} 
                    alt={winner.name} 
                    style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #8b5cf6', marginBottom: '8px' }} 
                    onError={avatarOnError(winner.name)}
                  />
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#8b5cf6' }}>
                    {winner.id === currentUser?.id ? 'You' : winner.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Pays the Bill!</div>
                </>
              ) : (
                <>
                  <img 
                    src={getAvatarUrl(participants[currentIndex])} 
                    alt={participants[currentIndex].name} 
                    style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--text-muted)', marginBottom: '8px', filter: isSpinning ? 'blur(1px)' : 'none' }} 
                    onError={avatarOnError(participants[currentIndex].name)}
                  />
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', filter: isSpinning ? 'blur(1px)' : 'none' }}>
                    {participants[currentIndex].id === currentUser?.id ? 'You' : participants[currentIndex].name}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {winner ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={handleProceed} 
              className="btn-primary" 
              style={{ background: '#8b5cf6', color: '#fff', fontSize: '1rem', height: '50px' }}
            >
              Add Expense for {winner.id === currentUser?.id ? 'You' : winner.name.split(' ')[0]} <ArrowRight size={18} />
            </button>
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
