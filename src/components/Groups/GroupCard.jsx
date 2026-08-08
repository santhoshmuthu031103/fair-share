import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { Users, ChevronRight } from 'lucide-react';

export const GroupCard = ({ group, friends = [], netBalance, balance, currency, onClick }) => {
  const actualBalance = netBalance !== undefined ? netBalance : (balance || 0);
  const memberObjList = (group.members || [])
    .map(mId => (friends || []).find(f => f.id === mId))
    .filter(Boolean);

  const getBalanceText = () => {
    if (Math.abs(actualBalance) < 0.01) {
      return <span style={{ color: 'var(--text-muted)' }}>settled up</span>;
    }
    if (actualBalance > 0) {
      return (
        <span style={{ color: 'var(--accent-mint)', fontWeight: '700' }}>
          you are owed {formatCurrency(actualBalance, currency)}
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--accent-coral)', fontWeight: '700' }}>
        you owe {formatCurrency(Math.abs(actualBalance), currency)}
      </span>
    );
  };

  return (
    <div 
      className="card" 
      onClick={onClick} 
      style={{ cursor: 'pointer', padding: '0', overflow: 'hidden', marginBottom: '14px' }}
    >
      {/* Group Cover Photo Header */}
      <div 
        style={{
          height: '110px',
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(18, 24, 38, 0.95)), url(${group.coverImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="badge badge-blue">{group.type || 'Group'}</span>
          <ChevronRight size={18} color="#ffffff" style={{ opacity: 0.8 }} />
        </div>

        <h3 style={{ color: '#ffffff', fontSize: '1.25rem', margin: 0 }}>
          {group.name}
        </h3>
      </div>

      {/* Card Details Body */}
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '-8px' }}>
          {/* Avatar stack */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {memberObjList.slice(0, 4).map((member, idx) => (
              <img
                key={member.id}
                src={member.avatar}
                alt={member.name}
                title={member.name}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '2px solid var(--bg-card)',
                  marginLeft: idx > 0 ? '-8px' : '0',
                  objectFit: 'cover',
                }}
              />
            ))}
            {memberObjList.length > 4 && (
              <div 
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--bg-input)',
                  border: '2px solid var(--bg-card)',
                  marginLeft: '-8px',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)'
                }}
              >
                +{memberObjList.length - 4}
              </div>
            )}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
            {memberObjList.length || group.members?.length || 0} members
          </span>
        </div>

        <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
          {getBalanceText()}
        </div>
      </div>
    </div>
  );
};
