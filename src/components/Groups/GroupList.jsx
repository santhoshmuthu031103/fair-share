import React from 'react';
import { GroupCard } from './GroupCard';
import { buildLedger } from '../../utils/debtCalculator';
import { Plus, Users, LogIn } from 'lucide-react';

export const GroupList = ({ 
  groups = [], 
  expenses = [], 
  settlements = [], 
  friends = [], 
  currency, 
  currentUser, 
  onSelectGroup, 
  onCreateGroup, 
  onJoinGroup 
}) => {
  const currentUserId = currentUser?.id || friends[0]?.id;
  const ledger = buildLedger(expenses, settlements, currentUserId, friends, groups);

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Header Bar for Groups Section */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '0 16px', 
          marginBottom: '14px', 
          gap: '8px', 
        }}
      >
        <h2 style={{ fontSize: '1.18rem', fontWeight: '800', whiteSpace: 'nowrap', margin: 0 }}>
          Your Groups ({groups.length})
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={onJoinGroup} 
            className="btn-secondary" 
            style={{ flex: 'none', height: '36px', padding: '0 12px', fontSize: '0.8rem', borderRadius: '18px', gap: '5px', width: 'auto' }}
          >
            <LogIn size={14} /> Join
          </button>
          <button 
            onClick={onCreateGroup} 
            className="btn-primary" 
            style={{ flex: 'none', height: '36px', padding: '0 14px', fontSize: '0.8rem', borderRadius: '18px', gap: '5px', width: 'auto' }}
          >
            <Plus size={15} /> New Group
          </button>
        </div>
      </div>

      {/* Group Cards List */}
      <div style={{ padding: '0 16px' }}>
        {groups.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
            <Users size={38} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)' }}>No Groups Yet</h3>
            <p style={{ fontSize: '0.82rem', marginBottom: '16px' }}>Create a group or join your friends using a 6-character code!</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={onCreateGroup} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <Plus size={15} /> Create Group
              </button>
              <button onClick={onJoinGroup} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <LogIn size={14} /> Join Group
              </button>
            </div>
          </div>
        ) : (
          groups.map(group => {
            const netBalances = ledger.groups[group.id]?.netBalances || {};
            const userBalance = netBalances[currentUserId] || 0;

            return (
              <GroupCard
                key={group.id}
                group={group}
                friends={friends}
                netBalance={userBalance}
                currency={currency}
                onClick={() => onSelectGroup(group)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
