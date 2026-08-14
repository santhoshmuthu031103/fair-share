import React, { useState, useEffect, useMemo } from 'react';
import { X, Dices, ArrowRight, RefreshCcw, Sparkles } from 'lucide-react';
import { getAvatarUrl, avatarOnError } from '../../utils/avatarHelper';

const FATES = [
  { id: 'f1', name: 'Pay for the food 🍔' },
  { id: 'f2', name: 'Settle up their debts 💸' },
  { id: 'f3', name: 'Buy everyone drinks 🍻' },
  { id: 'f4', name: 'Buy the groceries 🛒' },
  { id: 'f5', name: 'Pick up the coffee order ☕' },
  { id: 'f6', name: 'Buy snacks for everyone 🥨' },
  { id: 'f7', name: 'Wash the dishes 🧽' },
  { id: 'f8', name: 'Take out the trash 🧹' },
  { id: 'f9', name: 'Do the laundry 🧺' },
  { id: 'f10', name: 'Clean the bathroom 🚽' },
  { id: 'f11', name: 'Organize the living room 🛋️' },
  { id: 'f12', name: 'Pick the movie tonight 🎬' },
  { id: 'f13', name: 'Plan the weekend activity 🎢' },
  { id: 'f14', name: 'Plan the next group trip ✈️' },
  { id: 'f15', name: 'Free Pass! (Do nothing) 🎉' },
];

export const DebtRouletteModal = ({ onClose, friends, currentUser, onSelectPayer }) => {
  const [stage, setStage] = useState('pick_person'); // 'pick_person', 'spinning_person', 'person_picked', 'spinning_fate', 'result'
  const [personWinner, setPersonWinner] = useState(null);
  const [fateWinner, setFateWinner] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Compute the list of friends
  const participants = useMemo(() => {
    let list = [...friends];
    if (currentUser && !list.find(f => f.id === currentUser.id)) {
      list = [currentUser, ...list];
    }
    return list.filter(Boolean);
  }, [friends, currentUser]);

  const spinPerson = () => {
    if (participants.length < 2) {
      alert(`You need at least 2 friends to spin!`);
      return;
    }
    
    setStage('spinning_person');
    setPersonWinner(null);
    setFateWinner(null);
    
    const spinDuration = 3000; // 3 seconds
    const intervalTime = 100; // Change name every 100ms
    const totalTicks = spinDuration / intervalTime;
    
    let currentTick = 0;
    const intervalId = setInterval(() => {
      currentTick++;
      setCurrentIndex(Math.floor(Math.random() * participants.length));
      
      if (currentTick >= totalTicks) {
        clearInterval(intervalId);
        const finalWinner = participants[Math.floor(Math.random() * participants.length)];
        setPersonWinner(finalWinner);
        setStage('person_picked');
      }
    }, intervalTime);
  };

  const spinFate = () => {
    setStage('spinning_fate');
    setFateWinner(null);
    
    const spinDuration = 3000; // 3 seconds
    const intervalTime = 100;
    const totalTicks = spinDuration / intervalTime;
    
    let currentTick = 0;
    const intervalId = setInterval(() => {
      currentTick++;
      setCurrentIndex(Math.floor(Math.random() * FATES.length));
      
      if (currentTick >= totalTicks) {
        clearInterval(intervalId);
        const finalFate = FATES[Math.floor(Math.random() * FATES.length)];
        setFateWinner(finalFate);
        setStage('result');
      }
    }, intervalTime);
  };

  const renderAvatar = (item, size = 64, isWinner = false, isBlurry = false) => {
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
          filter: isBlurry ? 'blur(1px)' : 'none'
        }} 
        onError={avatarOnError(item.name)}
      />
    );
  };

  const renderFateBlock = (fate, isBlurry = false, isWinner = false) => {
    const colors = ['#f43f5e', '#f97316', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    const color = colors[fate.name.length % colors.length];

    return (
      <div style={{
        width: '100%',
        height: '64px',
        borderRadius: '16px',
        background: color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        fontWeight: '800',
        marginBottom: '8px',
        border: isWinner ? '3px solid #8b5cf6' : '3px solid transparent',
        filter: isBlurry ? 'blur(1px)' : 'none',
        padding: '0 10px'
      }}>
        {fate.name}
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>
            {stage === 'pick_person' || stage === 'spinning_person' ? 'Who is the Victim?' : 
             stage === 'person_picked' || stage === 'spinning_fate' ? 'Decide their Fate!' :
             'The Decision is Made!'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Let fate decide!</p>
        </div>

        {/* The Spinner UI */}
        <div style={{ 
          height: stage === 'result' ? '200px' : '160px', 
          background: 'var(--bg-input)', 
          borderRadius: '16px', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: '24px',
          border: (stage === 'result') ? '2px solid #8b5cf6' : '2px solid transparent',
          transition: 'all 0.3s ease',
          boxShadow: (stage === 'result') ? '0 0 20px rgba(139, 92, 246, 0.3)' : 'none',
          overflow: 'hidden',
          padding: '16px'
        }}>
          {participants.length < 2 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Need at least 2 friends.</p>
          ) : (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              transform: (stage === 'spinning_person' || stage === 'spinning_fate') ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.1s ease',
              width: '100%'
            }}>
              
              {/* Stage 1: Spinning or Picked Person */}
              {(stage === 'pick_person' || stage === 'spinning_person' || stage === 'person_picked') && (
                <>
                  {stage === 'spinning_person' ? (
                    <>
                      {renderAvatar(participants[currentIndex], 64, false, true)}
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', filter: 'blur(1px)' }}>
                        {participants[currentIndex].name}
                      </div>
                    </>
                  ) : (
                    <>
                      {renderAvatar(personWinner || participants[0], 64, !!personWinner)}
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: personWinner ? '#8b5cf6' : 'inherit' }}>
                        {personWinner ? (personWinner.id === currentUser?.id ? 'You' : personWinner.name) : '???'}
                      </div>
                      {personWinner && (
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginTop: '4px' }}>
                          is selected!
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Stage 2: Spinning Fate */}
              {stage === 'spinning_fate' && (
                <>
                  {renderAvatar(personWinner, 48, false)}
                  <div style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '12px' }}>
                    {personWinner.id === currentUser?.id ? 'You' : personWinner.name} must...
                  </div>
                  {renderFateBlock(FATES[currentIndex], true, false)}
                </>
              )}

              {/* Stage 3: Result */}
              {stage === 'result' && (
                <>
                  {renderAvatar(personWinner, 64, true)}
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#8b5cf6', marginBottom: '8px' }}>
                    {personWinner.id === currentUser?.id ? 'You' : personWinner.name} must...
                  </div>
                  {renderFateBlock(fateWinner, false, true)}
                </>
              )}

            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {stage === 'pick_person' && (
            <button 
              onClick={spinPerson} 
              disabled={participants.length < 2}
              className="btn-primary" 
              style={{ background: '#8b5cf6', color: '#fff', fontSize: '1.1rem', height: '54px' }}
            >
              Spin for the Victim!
            </button>
          )}

          {stage === 'spinning_person' && (
            <button disabled className="btn-primary" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '1.1rem', height: '54px' }}>
              Spinning...
            </button>
          )}

          {stage === 'person_picked' && (
            <button 
              onClick={spinFate} 
              className="btn-primary" 
              style={{ background: '#f97316', color: '#fff', fontSize: '1.1rem', height: '54px' }}
            >
              Decide their Fate! <Sparkles size={18} style={{ marginLeft: '6px' }} />
            </button>
          )}

          {stage === 'spinning_fate' && (
            <button disabled className="btn-primary" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '1.1rem', height: '54px' }}>
              Spinning Fate...
            </button>
          )}

          {stage === 'result' && (
            <>
              {fateWinner?.name.includes('Pay') || fateWinner?.name.includes('debt') ? (
                <button 
                  onClick={() => onSelectPayer(personWinner.id)} 
                  className="btn-primary" 
                  style={{ background: '#8b5cf6', color: '#fff', fontSize: '1rem', height: '50px' }}
                >
                  Add Expense for {personWinner.id === currentUser?.id ? 'You' : personWinner.name.split(' ')[0]} <ArrowRight size={18} />
                </button>
              ) : (
                <button 
                  onClick={onClose} 
                  className="btn-primary" 
                  style={{ background: '#8b5cf6', color: '#fff', fontSize: '1rem', height: '50px' }}
                >
                  Awesome! <ArrowRight size={18} />
                </button>
              )}
              <button 
                onClick={() => setStage('pick_person')} 
                className="btn-secondary" 
                style={{ fontSize: '0.9rem', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <RefreshCcw size={16} /> Play Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
