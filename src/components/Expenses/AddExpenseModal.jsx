import React, { useState } from 'react';
import { CATEGORIES, getCategoryMeta } from '../../utils/formatters';
import { CURRENT_USER_ID } from '../../utils/storage';
import { 
  X, 
  Receipt, 
  DollarSign, 
  Users, 
  Calendar, 
  FileText,
  Utensils,
  ShoppingBag,
  Home,
  Zap,
  Plane,
  Film,
  Tag,
  Check,
  Calculator
} from 'lucide-react';

const ICON_MAP = { Utensils, ShoppingBag, Home, Zap, Plane, Film, Tag, Receipt };

export const AddExpenseModal = ({ 
  groups, 
  friends, 
  activeGroupId, 
  currency, 
  currentUser,
  onClose, 
  onAddExpense 
}) => {
  const currentUserId = currentUser?.id || friends[0]?.id;
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [groupId, setGroupId] = useState(activeGroupId || (groups[0]?.id || ''));
  const [category, setCategory] = useState('food');
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitType, setSplitType] = useState('equal'); // equal | exact | percentage | shares
  const [splits, setSplits] = useState({});
  const [recipientIds, setRecipientIds] = useState([]);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Active members based on selected group
  const activeGroup = groups.find(g => g.id === groupId);
  const groupMembers = activeGroup 
    ? activeGroup.members.map(mId => friends.find(f => f.id === mId)).filter(Boolean)
    : friends;

  // Initialize recipient IDs if empty
  const currentRecipients = recipientIds.length > 0 
    ? recipientIds 
    : groupMembers.map(m => m.id);

  const handleToggleRecipient = (mId) => {
    if (currentRecipients.includes(mId)) {
      if (currentRecipients.length <= 1) return; // Keep at least one
      setRecipientIds(currentRecipients.filter(id => id !== mId));
    } else {
      setRecipientIds([...currentRecipients, mId]);
    }
  };

  const handleSplitValueChange = (userId, val) => {
    setSplits({ ...splits, [userId]: val });
    setErrorMsg('');
  };

  const validateSplits = () => {
    const totalAmt = parseFloat(amount) || 0;
    if (totalAmt <= 0) return 'Please enter a valid amount.';
    if (!title.trim()) return 'Please enter an expense title.';

    const numRecipients = currentRecipients.length;

    if (splitType === 'exact') {
      let sum = 0;
      currentRecipients.forEach(id => {
        sum += (parseFloat(splits[id]) || 0);
      });
      if (Math.abs(sum - totalAmt) > 0.05) {
        return `Exact amounts sum (${sum.toFixed(2)}) must equal total expense amount (${totalAmt.toFixed(2)}).`;
      }
    } else if (splitType === 'percentage') {
      let sum = 0;
      currentRecipients.forEach(id => {
        sum += (parseFloat(splits[id]) || 0);
      });
      if (Math.abs(sum - 100) > 0.1) {
        return `Percentages sum (${sum.toFixed(1)}%) must equal 100%.`;
      }
    }

    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validateSplits();
    if (err) {
      setErrorMsg(err);
      return;
    }

    onAddExpense({
      groupId,
      title: title.trim(),
      amount: parseFloat(amount),
      currency: currency || '$',
      category,
      paidBy,
      splitType,
      recipientIds: currentRecipients,
      splits,
      notes: notes.trim(),
      date: new Date().toISOString(),
    });
  };

  const totalAmountNum = parseFloat(amount) || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={22} color="var(--accent-mint)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Add Expense</h2>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div 
            style={{
              background: 'var(--accent-coral-glow)',
              border: '1px solid var(--accent-coral)',
              color: 'var(--accent-coral)',
              padding: '10px 14px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: '600',
              marginBottom: '14px',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Title & Amount Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Description</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Dinner, Uber, Groceries" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="form-label">Amount ({currency})</label>
              <input 
                type="number" 
                step="0.01"
                min="0.01"
                className="form-input" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Group Selector */}
          <div className="form-group">
            <label className="form-label">Group</label>
            <select 
              value={groupId} 
              onChange={(e) => {
                setGroupId(e.target.value);
                setRecipientIds([]);
              }}
              className="form-select"
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Category Selector Pills */}
          <div className="form-group">
            <label className="form-label">Category</label>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              {Object.values(CATEGORIES).map(cat => {
                const IconComp = ICON_MAP[cat.iconName] || Receipt;
                const isSel = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: '16px',
                      background: isSel ? `${cat.color}33` : 'var(--bg-input)',
                      border: isSel ? `2px solid ${cat.color}` : '1px solid var(--border-color)',
                      color: isSel ? cat.color : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    <IconComp size={15} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payer Selector */}
          <div className="form-group">
            <label className="form-label">Paid By</label>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
              {groupMembers.map(m => {
                const isPayer = paidBy === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaidBy(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      background: isPayer ? 'var(--accent-mint-glow)' : 'var(--bg-input)',
                      border: isPayer ? '2px solid var(--accent-mint)' : '1px solid var(--border-color)',
                      color: isPayer ? 'var(--accent-mint)' : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <img src={m.avatar} alt={m.name} style={{ width: '22px', height: '22px', borderRadius: '50%' }} />
                    <span>{m.id === currentUserId ? 'You' : m.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Split Mode Tabs */}
          <div className="form-group">
            <label className="form-label">Split Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {[
                { id: 'equal', label: '=' },
                { id: 'exact', label: '1.23' },
                { id: 'percentage', label: '%' },
                { id: 'shares', label: 'Shares' },
              ].map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSplitType(mode.id)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '12px',
                    border: splitType === mode.id ? '2px solid var(--accent-mint)' : '1px solid var(--border-color)',
                    background: splitType === mode.id ? 'var(--accent-mint-glow)' : 'var(--bg-input)',
                    color: splitType === mode.id ? 'var(--accent-mint)' : 'var(--text-secondary)',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient Split Calculations List */}
          <div className="form-group" style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '16px' }}>
            <label className="form-label">Splitting Among ({currentRecipients.length} members)</label>

            {groupMembers.map(m => {
              const isIncluded = currentRecipients.includes(m.id);
              const splitVal = splits[m.id] || '';

              let sharePreview = '';
              if (isIncluded && totalAmountNum > 0) {
                if (splitType === 'equal') {
                  sharePreview = currency + (totalAmountNum / currentRecipients.length).toFixed(2);
                } else if (splitType === 'exact') {
                  sharePreview = currency + (parseFloat(splitVal) || 0).toFixed(2);
                } else if (splitType === 'percentage') {
                  sharePreview = currency + ((totalAmountNum * (parseFloat(splitVal) || 0)) / 100).toFixed(2);
                }
              }

              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <div 
                    onClick={() => handleToggleRecipient(m.id)} 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                  >
                    <div 
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        border: isIncluded ? 'none' : '1px solid var(--border-color)',
                        background: isIncluded ? 'var(--accent-mint)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isIncluded && <Check size={14} color="#fff" />}
                    </div>
                    <img src={m.avatar} alt={m.name} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: isIncluded ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {m.id === currentUserId ? 'You' : m.name}
                    </span>
                  </div>

                  {isIncluded && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {splitType === 'exact' && (
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={splitVal}
                          onChange={(e) => handleSplitValueChange(m.id, e.target.value)}
                          className="form-input"
                          style={{ width: '80px', height: '32px', padding: '2px 8px', fontSize: '0.8rem' }}
                        />
                      )}
                      {splitType === 'percentage' && (
                        <input
                          type="number"
                          step="1"
                          placeholder="%"
                          value={splitVal}
                          onChange={(e) => handleSplitValueChange(m.id, e.target.value)}
                          className="form-input"
                          style={{ width: '70px', height: '32px', padding: '2px 8px', fontSize: '0.8rem' }}
                        />
                      )}
                      {splitType === 'shares' && (
                        <input
                          type="number"
                          step="1"
                          placeholder="1"
                          value={splitVal}
                          onChange={(e) => handleSplitValueChange(m.id, e.target.value)}
                          className="form-input"
                          style={{ width: '60px', height: '32px', padding: '2px 8px', fontSize: '0.8rem' }}
                        />
                      )}

                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-mint)', minWidth: '55px', textAlign: 'right' }}>
                        {sharePreview}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Notes Input */}
          <div className="form-group">
            <label className="form-label">Notes / Details (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Add additional notes or receipt link" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
            />
          </div>

          {/* Submit Button */}
          <button type="submit" className="btn-primary" style={{ width: '100%', height: '50px', fontSize: '1rem', marginTop: '10px' }}>
            Save Expense
          </button>
        </form>
      </div>
    </div>
  );
};
