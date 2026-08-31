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
  Calculator,
  Plus,
  Minus,
  ListOrdered
} from 'lucide-react';
import { avatarOnError, getAvatarUrl } from '../../utils/avatarHelper';

const ICON_MAP = { Utensils, ShoppingBag, Home, Zap, Plane, Film, Tag, Receipt };

export const AddExpenseModal = ({ 
  groups, 
  friends, 
  activeGroupId, 
  currency, 
  currentUser,
  initialPayerId,
  onClose, 
  onAddExpense 
}) => {
  const currentUserId = currentUser?.id || friends[0]?.id;
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [groupId, setGroupId] = useState(activeGroupId || (groups[0]?.id || ''));
  const [category, setCategory] = useState('food');
  const [paidBy, setPaidBy] = useState(initialPayerId || currentUserId);
  const [splitType, setSplitType] = useState('equal'); // equal | exact | percentage | shares | itemized
  const [splits, setSplits] = useState({});
  const [recipientIds, setRecipientIds] = useState([]);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Itemized splitting state
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

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

  // ── Itemized splitting helpers ──
  const handleAddItem = () => {
    const price = parseFloat(newItemPrice);
    if (!newItemName.trim() || !price || price <= 0) return;
    const newItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      price,
      memberIds: groupMembers.map(m => m.id), // default: everyone
    };
    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    setNewItemName('');
    setNewItemPrice('');
    // Auto-update the total amount
    const newTotal = updatedItems.reduce((s, i) => s + i.price, 0);
    setAmount(newTotal.toFixed(2));
  };

  const handleRemoveItem = (itemId) => {
    const updatedItems = items.filter(i => i.id !== itemId);
    setItems(updatedItems);
    const newTotal = updatedItems.reduce((s, i) => s + i.price, 0);
    setAmount(newTotal > 0 ? newTotal.toFixed(2) : '');
  };

  const handleToggleItemMember = (itemId, memberId) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      const has = item.memberIds.includes(memberId);
      if (has && item.memberIds.length <= 1) return item; // keep at least one
      return {
        ...item,
        memberIds: has
          ? item.memberIds.filter(id => id !== memberId)
          : [...item.memberIds, memberId],
      };
    }));
  };

  // Calculate per-member shares from itemized items
  const getItemizedShares = () => {
    const shares = {};
    groupMembers.forEach(m => { shares[m.id] = 0; });
    items.forEach(item => {
      const perPerson = item.price / item.memberIds.length;
      item.memberIds.forEach(mId => {
        shares[mId] = (shares[mId] || 0) + perPerson;
      });
    });
    // Round to 2 decimals
    Object.keys(shares).forEach(k => {
      shares[k] = Math.round(shares[k] * 100) / 100;
    });
    return shares;
  };

  const validateSplits = () => {
    const totalAmt = parseFloat(amount) || 0;
    if (!title.trim()) return 'Please enter an expense title.';

    if (splitType === 'itemized') {
      if (items.length === 0) return 'Add at least one item to split.';
      const itemTotal = items.reduce((s, i) => s + i.price, 0);
      if (itemTotal <= 0) return 'Item total must be greater than zero.';
      return null;
    }

    if (totalAmt <= 0) return 'Please enter a valid amount.';

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
    } else if (splitType === 'shares') {
      let totalShares = 0;
      currentRecipients.forEach(id => {
        totalShares += (parseFloat(splits[id]) || 0);
      });
      if (totalShares <= 0) {
        return 'Enter at least one share to split this expense.';
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

    if (splitType === 'itemized') {
      // Convert itemized to exact splits for the debt engine
      const itemizedShares = getItemizedShares();
      const involvedIds = Object.keys(itemizedShares).filter(id => itemizedShares[id] > 0.005);
      const itemTotal = items.reduce((s, i) => s + i.price, 0);
      
      onAddExpense({
        groupId,
        title: title.trim(),
        amount: Math.round(itemTotal * 100) / 100,
        currency: currency || '$',
        category,
        paidBy,
        splitType: 'exact', // store as exact so debt engine works without changes
        recipientIds: involvedIds,
        splits: itemizedShares,
        notes: `[ITEMIZED] ${items.map(i => `${i.name}: ${currency}${i.price.toFixed(2)}`).join(' | ')}${notes.trim() ? ` | ${notes.trim()}` : ''}`,
        date: new Date().toISOString(),
      });
    } else {
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
    }
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
              <option value="">No Group (Direct Expense)</option>
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
                    <img src={getAvatarUrl(m)} alt={m.name} style={{ width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} onError={avatarOnError(m.name)} />
                    <span>{m.id === currentUserId ? 'You' : m.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Split Mode Tabs */}
          <div className="form-group">
            <label className="form-label">Split Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {[
                { id: 'equal', label: '=' },
                { id: 'exact', label: '1.23' },
                { id: 'percentage', label: '%' },
                { id: 'shares', label: 'Shares' },
                { id: 'itemized', label: '🧾' },
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

          {/* ── Itemized Receipt Builder ── */}
          {splitType === 'itemized' ? (
            <div className="form-group" style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '16px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ListOrdered size={14} /> Receipt Items
              </label>

              {/* Add Item Row */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Item name (e.g. Pizza)"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                  style={{ flex: 2, height: '36px', padding: '4px 10px', fontSize: '0.82rem' }}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  placeholder="Price"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                  style={{ flex: 1, height: '36px', padding: '4px 10px', fontSize: '0.82rem' }}
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    width: '36px', height: '36px', borderRadius: '10px', border: 'none',
                    background: 'var(--accent-mint)', color: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <Plus size={18} />
                </button>
              </div>

              {/* Items List */}
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Add items from the receipt above.<br/>
                  Then tap names to assign who had each item.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.map(item => (
                    <div key={item.id} style={{
                      background: 'var(--bg-card)', borderRadius: '12px', padding: '10px',
                      border: '1px solid var(--border-color)',
                    }}>
                      {/* Item header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{item.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '800', fontSize: '0.88rem', color: 'var(--accent-mint)' }}>
                            {currency}{item.price.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            style={{
                              width: '22px', height: '22px', borderRadius: '6px', border: 'none',
                              background: 'rgba(244,63,94,0.15)', color: 'var(--accent-coral)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Minus size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Member assignment chips */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {groupMembers.map(m => {
                          const isAssigned = item.memberIds.includes(m.id);
                          const perPerson = isAssigned ? (item.price / item.memberIds.length) : 0;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleToggleItemMember(item.id, m.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '4px 8px', borderRadius: '14px',
                                border: isAssigned ? '1.5px solid var(--accent-mint)' : '1px solid var(--border-color)',
                                background: isAssigned ? 'var(--accent-mint-glow)' : 'transparent',
                                color: isAssigned ? 'var(--accent-mint)' : 'var(--text-muted)',
                                fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer',
                              }}
                            >
                              <img src={getAvatarUrl(m)} alt={m.name} style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} onError={avatarOnError(m.name)} />
                              {m.id === currentUserId ? 'You' : m.name.split(' ')[0]}
                              {isAssigned && <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>{currency}{perPerson.toFixed(2)}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Itemized Total Summary */}
                  <div style={{
                    marginTop: '6px', padding: '10px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.1) 100%)',
                    border: '1px solid rgba(16,185,129,0.2)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: '800', marginBottom: '6px' }}>
                      <span>Bill Total</span>
                      <span style={{ color: 'var(--accent-mint)' }}>{currency}{items.reduce((s, i) => s + i.price, 0).toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>Per-person breakdown:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                      {(() => {
                        const shares = getItemizedShares();
                        return groupMembers
                          .filter(m => shares[m.id] > 0.005)
                          .sort((a, b) => shares[b.id] - shares[a.id])
                          .map(m => (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                                {m.id === currentUserId ? 'You' : m.name}
                              </span>
                              <span style={{ fontWeight: '700' }}>{currency}{shares[m.id].toFixed(2)}</span>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Standard Recipient Split Calculations List ── */
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
                      <img src={getAvatarUrl(m)} alt={m.name} style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} onError={avatarOnError(m.name)} />
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
          )}

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
