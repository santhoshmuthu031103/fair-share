import React, { useState } from 'react';
import { buildLedger, calculateExpenseShares } from '../../utils/debtCalculator';
import { formatCurrency, formatDate, getCategoryMeta, CATEGORIES } from '../../utils/formatters';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Download, 
  DollarSign, 
  CheckCircle2, 
  Receipt,
  Utensils,
  ShoppingBag,
  Home,
  Zap,
  Plane,
  Film,
  Tag,
  UserPlus,
  LogOut,
  X,
  Check,
  MessageSquare
} from 'lucide-react';
import { avatarOnError, getAvatarUrl } from '../../utils/avatarHelper';
import { GroupChat } from './GroupChat';

const ICON_MAP = { Utensils, ShoppingBag, Home, Zap, Plane, Film, Tag, Receipt };

export const GroupDetail = ({ 
  group, 
  expenses, 
  settlements, 
  friends, 
  currency, 
  currentUser,
  onBack, 
  onOpenAddExpense, 
  onOpenSettleUp,
  onToggleSimplifyDebts,
  onDeleteGroup,
  onLeaveGroup,
  onAddMembersToGroup,
  onRemoveMemberFromGroup,
  onDeleteExpense 
}) => {
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' | 'chat'
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedNewMemberIds, setSelectedNewMemberIds] = useState([]);

  const currentUserId = currentUser?.id || friends[0]?.id;

  const groupMembers = (group.members || [])
    .map(mId => friends.find(f => f.id === mId))
    .filter(Boolean);

  const groupExps = expenses.filter(e => e.groupId === group.id && !e.isDeleted);
  const groupSets = settlements.filter(s => s.groupId === group.id && !s.isDeleted);

  // Calculate Net Balances using Ledger Engine
  const ledger = buildLedger(expenses, settlements, currentUserId, friends, [group]);
  const netBalances = ledger.groups[group.id]?.netBalances || {};
  const transactionsToDisplay = ledger.groups[group.id]?.pairwiseDebts || [];
  const myDebtsInGroup = transactionsToDisplay.filter(tx => tx.from === currentUserId);

  // Group Total Expense Spend
  const totalGroupSpend = groupExps.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);

  const getUserName = (id) => {
    if (id === currentUserId) return 'You';
    return friends.find(f => f.id === id)?.name || id;
  };

  const getUserAvatar = (id) => {
    return friends.find(f => f.id === id)?.avatar;
  };

  // Friends not yet in this group
  const nonGroupFriends = friends.filter(f => !(group.members || []).includes(f.id));

  const handleAddMembersSubmit = (e) => {
    e.preventDefault();
    if (selectedNewMemberIds.length === 0) return;
    onAddMembersToGroup(group.id, selectedNewMemberIds);
    setSelectedNewMemberIds([]);
    setIsAddMemberModalOpen(false);
  };

  const toggleNewMember = (mId) => {
    if (selectedNewMemberIds.includes(mId)) {
      setSelectedNewMemberIds(selectedNewMemberIds.filter(id => id !== mId));
    } else {
      setSelectedNewMemberIds([...selectedNewMemberIds, mId]);
    }
  };

  return (
    <div style={{ paddingBottom: '30px' }}>
      {/* Header Banner */}
      <div 
        style={{
          height: '140px',
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(18, 24, 38, 1)), url(${group.coverImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={onBack}
            className="icon-btn"
            style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {onLeaveGroup && (
              <button 
                onClick={() => onLeaveGroup(group.id)}
                className="icon-btn"
                title="Leave Group"
                style={{ background: 'rgba(245, 158, 11, 0.4)', border: 'none', color: '#fff' }}
              >
                <LogOut size={16} />
              </button>
            )}
            <button 
              onClick={() => onDeleteGroup && onDeleteGroup(group.id)}
              className="icon-btn"
              title="Delete Group"
              style={{ background: 'rgba(244, 63, 94, 0.4)', border: 'none', color: '#fff' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-mint">
              {group.type}
            </span>
            <span 
              onClick={() => {
                const code = group.syncCode || group.id.slice(-6).toUpperCase();
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(code);
                }
                alert(`Group Sync Code: ${code}\nShare this 6-character code with your friends to connect to this group!`);
              }}
              style={{
                fontSize: '0.72rem',
                background: 'rgba(16, 185, 129, 0.25)',
                color: '#10b981',
                padding: '3px 8px',
                borderRadius: '10px',
                fontWeight: '700',
                cursor: 'pointer',
                border: '1px solid rgba(16, 185, 129, 0.4)',
              }}
            >
              ⚡ Live Sync Code: {group.syncCode || group.id.slice(-6).toUpperCase()}
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: '800' }}>
            {group.name}
          </h1>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Members Pill Bar + Add Member Button */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            overflowX: 'auto', 
            padding: '10px 0',
            scrollbarWidth: 'none'
          }}
        >
          {groupMembers.map(m => (
            <div 
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: '600',
                whiteSpace: 'nowrap',
              }}
            >
              <img src={getAvatarUrl(m)} alt={m.name} style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} onError={avatarOnError(m.name)} />
              <span>{m.id === currentUserId ? 'You' : m.name.split(' ')[0]}</span>
              {m.id !== currentUserId && onRemoveMemberFromGroup && (
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Remove ${m.name} from "${group.name}"?`)) {
                      onRemoveMemberFromGroup(group.id, m.id);
                    }
                  }}
                  style={{ 
                    cursor: 'pointer', 
                    color: 'var(--text-muted)', 
                    marginLeft: '2px', 
                    fontSize: '11px',
                    fontWeight: 'bold',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={`Remove ${m.name}`}
                >
                  ✕
                </span>
              )}
            </div>
          ))}

          {/* Add Member Button */}
          <button
            onClick={() => setIsAddMemberModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--accent-mint-glow)',
              border: '1px solid var(--accent-mint)',
              color: 'var(--accent-mint)',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <UserPlus size={14} /> + Add Member
          </button>
        </div>

        {/* Tab Switcher: Expenses vs Chat */}
        <div 
          style={{ 
            display: 'flex', 
            background: 'var(--bg-input)', 
            padding: '4px', 
            borderRadius: '16px', 
            border: '1px solid var(--border-color)',
            marginBottom: '14px',
            gap: '4px'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '12px',
              border: 'none',
              background: activeTab === 'expenses' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'expenses' ? 'var(--accent-mint)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'expenses' ? '800' : '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'expenses' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Receipt size={15} />
            <span>Expenses & Balances</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '12px',
              border: 'none',
              background: activeTab === 'chat' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'chat' ? 'var(--accent-mint)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'chat' ? '800' : '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'chat' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <MessageSquare size={15} />
            <span>Group Chat</span>
          </button>
        </div>

        {activeTab === 'chat' ? (
          <GroupChat 
            group={group} 
            currentUser={currentUser} 
            friends={friends} 
            onOpenSettleUp={() => onOpenSettleUp(group.id)} 
          />
        ) : (
          <>
            {/* Who Owes Who Card */}
            <div className="card" style={{ marginBottom: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--accent-amber)', fontSize: '1.1rem' }}>⚖️</span>
              <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>Who Owes Who</span>
            </div>
          </div>

          {transactionsToDisplay.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <CheckCircle2 size={24} color="var(--accent-mint)" style={{ margin: '0 auto 6px auto' }} />
              Everyone in this group is all settled up! 🎉
            </div>
          ) : (
            transactionsToDisplay.map((tx, idx) => {
              const isUserPayer = tx.from === currentUserId;
              const isUserPayee = tx.to === currentUserId;

              return (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: idx < transactionsToDisplay.length - 1 ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '-4px' }}>
                      <img src={getUserAvatar(tx.from) || getAvatarUrl({ id: tx.from })} alt="From" style={{ width: '28px', height: '28px', borderRadius: '50%' }} onError={avatarOnError(getUserName(tx.from))} />
                      <img src={getUserAvatar(tx.to) || getAvatarUrl({ id: tx.to })} alt="To" style={{ width: '28px', height: '28px', borderRadius: '50%', marginLeft: '-8px' }} onError={avatarOnError(getUserName(tx.to))} />
                    </div>
                    <div style={{ fontSize: '0.86rem' }}>
                      {isUserPayer ? (
                        <>
                          <span style={{ fontWeight: '800', color: 'var(--accent-coral)' }}>You owe </span>
                          <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{getUserName(tx.to)}</span>
                        </>
                      ) : isUserPayee ? (
                        <>
                          <span style={{ fontWeight: '800', color: 'var(--accent-mint)' }}>{getUserName(tx.from)} </span>
                          <span style={{ color: 'var(--text-muted)' }}>owes </span>
                          <span style={{ fontWeight: '800', color: 'var(--accent-mint)' }}>You</span>
                        </>
                      ) : (
                        <>
                          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{getUserName(tx.from)} </span>
                          <span style={{ color: 'var(--text-muted)' }}>owes </span>
                          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{getUserName(tx.to)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.92rem' }}>
                      {formatCurrency(tx.amount, currency)}
                    </span>
                    {isUserPayer && (
                      <button
                        onClick={() => onOpenSettleUp({
                          groupId: group.id,
                          payerId: tx.from,
                          payeeId: tx.to,
                          amount: tx.amount
                        })}
                        className="btn-primary"
                        style={{
                          height: '28px',
                          padding: '0 10px',
                          fontSize: '0.72rem',
                          borderRadius: '14px',
                        }}
                      >
                        Settle
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Group Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', margin: '14px 0' }}>
          <button onClick={onOpenAddExpense} className="btn-primary" style={{ flex: 1 }}>
            <Plus size={16} /> Add Expense
          </button>
          {myDebtsInGroup.length > 0 && (
            <button 
              onClick={() => onOpenSettleUp({ 
                groupId: group.id,
                payerId: currentUserId,
                payeeId: myDebtsInGroup[0].to,
                amount: myDebtsInGroup[0].amount 
              })}
              className="btn-secondary"
              style={{ flex: 1 }}
            >
              <DollarSign size={16} /> Settle Up
            </button>
          )}
        </div>

        {/* Expenses List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800' }}>
              Expenses ({groupExps.length})
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Total: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalGroupSpend, currency)}</strong>
            </span>
          </div>

          {groupExps.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              <div>No expenses recorded yet in this group. Tap "+ Add Expense" above!</div>
            </div>
          ) : (
            groupExps.map(exp => {
              const catMeta = getCategoryMeta(exp.category);
              const IconComp = ICON_MAP[catMeta.iconName] || Receipt;
              const payerName = getUserName(exp.paidBy);
              const isUserPayer = exp.paidBy === currentUserId;

              return (
                <div 
                  key={exp.id} 
                  className="card" 
                  onClick={() => setSelectedExpense(exp)}
                  style={{ 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div 
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: `${catMeta.color}22`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: catMeta.color,
                      }}
                    >
                      <IconComp size={20} />
                    </div>

                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{exp.title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {isUserPayer ? 'You paid' : `${payerName} paid`} • {formatDate(exp.date)}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', fontSize: '1rem' }}>
                      {formatCurrency(exp.amount, currency)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-mint)' }}>
                      {exp.splitType} split
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </>
        )}
      </div>

      {/* Add Member Bottom Sheet Modal */}
      {isAddMemberModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddMemberModalOpen(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="var(--accent-mint)" />
                <h2 style={{ fontSize: '1.15rem', fontWeight: '800' }}>Add Friends to {group.name}</h2>
              </div>
              <button onClick={() => setIsAddMemberModalOpen(false)} className="icon-btn">
                <X size={18} />
              </button>
            </div>

            {nonGroupFriends.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                All your friends are already in this group! Add more friends in the Friends tab.
              </div>
            ) : (
              <form onSubmit={handleAddMembersSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '50vh', overflowY: 'auto' }}>
                  {nonGroupFriends.map(f => {
                    const isSelected = selectedNewMemberIds.includes(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleNewMember(f.id)}
                        className="card"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--accent-mint-glow)' : 'var(--bg-card)',
                          borderColor: isSelected ? 'var(--accent-mint)' : 'var(--border-color)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <img src={getAvatarUrl(f)} alt={f.name} style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} onError={avatarOnError(f.name)} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.email || f.phone}</div>
                          </div>
                        </div>
                        <div 
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: isSelected ? 'none' : '1px solid var(--border-color)',
                            background: isSelected ? 'var(--accent-mint)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff'
                          }}
                        >
                          {isSelected && <Check size={14} />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={selectedNewMemberIds.length === 0}
                  style={{ width: '100%', height: '48px', opacity: selectedNewMemberIds.length === 0 ? 0.5 : 1 }}
                >
                  Add {selectedNewMemberIds.length} Members to Group
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Expense Breakdown Modal */}
      {selectedExpense && (
        <div className="modal-overlay" onClick={() => setSelectedExpense(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{selectedExpense.title}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => {
                    onDeleteExpense(selectedExpense.id);
                    setSelectedExpense(null);
                  }}
                  className="icon-btn"
                  title="Delete Expense"
                  style={{ background: 'rgba(244, 63, 94, 0.2)', color: 'var(--accent-coral)', border: 'none' }}
                >
                  <Trash2 size={16} />
                </button>
                <button onClick={() => setSelectedExpense(null)} className="icon-btn">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Amount</span>
                <span style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--accent-mint)' }}>
                  {formatCurrency(selectedExpense.amount, currency)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Paid by</span>
                <span style={{ fontWeight: '700' }}>{getUserName(selectedExpense.paidBy)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Category</span>
                <span style={{ fontWeight: '700', textTransform: 'capitalize' }}>{selectedExpense.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Date</span>
                <span>{formatDate(selectedExpense.date)}</span>
              </div>
            </div>

            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '10px' }}>Split Breakdown</h3>
            <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(() => {
                  const shares = calculateExpenseShares(selectedExpense, friends);
                  const recipients = Object.entries(shares)
                    .filter(([uid, amt]) => amt > 0.005)
                    .map(([uid, amt]) => {
                      const member = friends.find(f => f.id === uid) || { id: uid, name: 'Unknown' };
                      return { member, amt };
                    });
                  return recipients.map(({ member, amt }) => (
                    <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>{member.id === currentUserId ? 'You' : member.name}</span>
                      <span style={{ fontWeight: '700' }}>
                        {formatCurrency(amt, currency)}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {selectedExpense.notes && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Notes</div>
                <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '10px', fontSize: '0.85rem' }}>
                  {selectedExpense.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
