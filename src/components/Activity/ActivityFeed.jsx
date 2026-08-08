import React from 'react';
import { formatCurrency, formatDate, getCategoryMeta } from '../../utils/formatters';
import { Activity, CheckCircle2, Receipt, Trash2 } from 'lucide-react';

export const ActivityFeed = ({ 
  expenses, 
  settlements, 
  groups, 
  friends, 
  currency, 
  currentUser,
  onDeleteExpense,
  onDeleteSettlement 
}) => {
  const currentUserId = currentUser?.id || friends[0]?.id;

  // Combine expenses & settlements into single timeline sorted descending by date
  const combined = [
    ...expenses.map(e => ({ ...e, itemType: 'expense' })),
    ...settlements.map(s => ({ ...s, itemType: 'settlement' })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const getUserName = (id) => {
    if (id === currentUserId) return 'You';
    return friends.find(f => f.id === id)?.name || id;
  };

  const getGroupName = (id) => {
    return groups.find(g => g.id === id)?.name || 'General';
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Recent Activity ({combined.length})</h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Chronological stream of expenses and settlements</p>
      </div>

      {combined.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
          <Activity size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>No activity recorded yet</h3>
          <p style={{ fontSize: '0.82rem' }}>Add an expense or record a settlement to start tracking!</p>
        </div>
      ) : (
        combined.map(item => {
          if (item.itemType === 'expense') {
            const catMeta = getCategoryMeta(item.category);
            const payerName = getUserName(item.paidBy);
            const groupName = getGroupName(item.groupId);

            return (
              <div key={`exp_${item.id}`} className="card" style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div 
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '12px',
                        background: `${catMeta.color}22`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: catMeta.color,
                        flexShrink: 0,
                      }}
                    >
                      <Receipt size={18} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{payerName}</span> added in {groupName}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>
                        {formatCurrency(item.amount, currency)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {formatDate(item.date)}
                      </div>
                    </div>

                    {onDeleteExpense && (
                      <button
                        onClick={() => onDeleteExpense(item.id)}
                        className="icon-btn"
                        title="Delete Expense"
                        style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-coral)', border: 'none', width: '30px', height: '30px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          } else {
            // Settlement item
            const payerName = getUserName(item.payerId);
            const payeeName = getUserName(item.payeeId);

            return (
              <div key={`set_${item.id}`} className="card" style={{ marginBottom: '10px', background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div 
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '12px',
                        background: 'var(--accent-mint-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-mint)',
                        flexShrink: 0,
                      }}
                    >
                      <CheckCircle2 size={18} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--accent-mint)' }}>
                        Payment Settlement
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                        {payerName} paid {payeeName}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--accent-mint)' }}>
                        {formatCurrency(item.amount, currency)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {formatDate(item.date)}
                      </div>
                    </div>

                    {onDeleteSettlement && (
                      <button
                        onClick={() => onDeleteSettlement(item.id)}
                        className="icon-btn"
                        title="Delete Settlement"
                        style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-coral)', border: 'none', width: '30px', height: '30px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }
        })
      )}
    </div>
  );
};
