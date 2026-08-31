import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { X, CheckCircle2, ArrowRight } from 'lucide-react';
import { avatarOnError, getAvatarUrl } from '../../utils/avatarHelper';

export const SettleUpModal = ({ 
  friends, 
  groups, 
  currentUser,
  initialData = {}, 
  currency, 
  onClose, 
  onSettleUp 
}) => {
  const currentUserId = currentUser?.id || friends[0]?.id;

  // Deduplicate friends by ID to prevent "You" appearing twice
  const uniqueFriends = friends.reduce((acc, f) => {
    if (!acc.find(x => x.id === f.id)) acc.push(f);
    return acc;
  }, []);

  const defaultPayerId = initialData.payerId || currentUserId;
  const defaultPayeeId = initialData.payeeId || uniqueFriends.find(f => f.id !== defaultPayerId)?.id || '';

  const [payerId, setPayerId] = useState(defaultPayerId);
  const [payeeId, setPayeeId] = useState(defaultPayeeId);
  const [amount, setAmount] = useState(initialData.amount ? String(initialData.amount) : '');
  const [groupId, setGroupId] = useState(initialData.groupId || (groups[0]?.id || ''));
  const [notes, setNotes] = useState('');

  const getUser = (id) => uniqueFriends.find(f => f.id === id);

  const handlePayerChange = (newPayerId) => {
    setPayerId(newPayerId);
    // If new payer matches current payee, auto-pick a different payee
    if (newPayerId === payeeId) {
      const fallback = uniqueFriends.find(f => f.id !== newPayerId);
      setPayeeId(fallback?.id || '');
    }
  };

  const handlePayeeChange = (newPayeeId) => {
    setPayeeId(newPayeeId);
    // If new payee matches current payer, auto-pick a different payer
    if (newPayeeId === payerId) {
      const fallback = uniqueFriends.find(f => f.id !== newPayeeId);
      setPayerId(fallback?.id || '');
    }
  };

  const payer = getUser(payerId);
  const payee = getUser(payeeId);

  const handleSubmit = (e) => {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (!numAmt || numAmt <= 0) return;
    if (payerId === payeeId) return;

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (_) {}

    onSettleUp({
      groupId,
      payerId,
      payeeId,
      amount: numAmt,
      currency: currency || '₹',
      date: new Date().toISOString(),
      notes: notes.trim() || 'Settled balance',
    });
  };

  const payerName = payerId === currentUserId ? 'You' : payer?.name || 'Payer';
  const payeeName = payeeId === currentUserId ? 'You' : payee?.name || 'Recipient';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={22} color="var(--accent-mint)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Record Settlement</h2>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X size={18} />
          </button>
        </div>

        {/* Clean Settlement Transfer Header */}
        <div 
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '18px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            marginBottom: '16px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <img src={getAvatarUrl(payer)} alt="Payer" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--accent-coral)', marginBottom: '4px', flexShrink: 0, objectFit: 'cover' }} onError={avatarOnError(payerName)} />
            <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{payerName}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>paid</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--accent-mint)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800' }}>TO</span>
            <ArrowRight size={22} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <img src={getAvatarUrl(payee)} alt="Payee" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--accent-mint)', marginBottom: '4px', flexShrink: 0, objectFit: 'cover' }} onError={avatarOnError(payeeName)} />
            <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{payeeName}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>received</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Who paid & received */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Who Paid?</label>
              <select 
                value={payerId} 
                onChange={(e) => handlePayerChange(e.target.value)} 
                className="form-select"
              >
                {uniqueFriends.filter(f => f.id !== payeeId).map(f => (
                  <option key={f.id} value={f.id}>{f.id === currentUserId ? 'You' : f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Who Received?</label>
              <select 
                value={payeeId} 
                onChange={(e) => handlePayeeChange(e.target.value)} 
                className="form-select"
              >
                {uniqueFriends.filter(f => f.id !== payerId).map(f => (
                  <option key={f.id} value={f.id}>{f.id === currentUserId ? 'You' : f.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Settlement Amount */}
          <div className="form-group">
            <label className="form-label">Amount to Settle ({currency})</label>
            <input 
              type="number" 
              step="0.01" 
              min="0.01"
              className="form-input"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
              style={{ fontSize: '1.25rem', fontWeight: '800' }}
            />
          </div>

          {/* Group */}
          {groups.length > 0 && (
            <div className="form-group">
              <label className="form-label">Group</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="form-select">
                <option value="">No Group (Direct Settlement)</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Paid in cash / Settled balance" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', height: '50px', fontSize: '1rem', marginTop: '10px' }}
          >
            Settle Balance ({currency}{parseFloat(amount || 0).toFixed(2)})
          </button>
        </form>
      </div>
    </div>
  );
};
