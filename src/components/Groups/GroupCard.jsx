import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { Users, ChevronRight, MessageSquare } from 'lucide-react';
import { avatarOnError, getAvatarUrl } from '../../utils/avatarHelper';
import { subscribeGroupChatLastMessage } from '../../utils/firebaseSync';
import { getLastReadTimestamp, markGroupChatAsRead } from '../../utils/chatTracker';

export const GroupCard = ({ group, friends = [], currentUserId, netBalance, balance, currency, onClick, onOpenChat }) => {
  const [hasUnread, setHasUnread] = useState(false);
  const actualBalance = netBalance !== undefined ? netBalance : (balance || 0);
  const syncCode = group?.syncCode || group?.id?.slice(-6)?.toUpperCase();

  const memberObjList = (group.members || [])
    .map(mId => (friends || []).find(f => f.id === mId))
    .filter(Boolean);

  // Listen for real-time chat updates to toggle the unread dot indicator
  useEffect(() => {
    if (!syncCode) return;

    let currentLastMsg = null;

    const evaluateUnread = (lastMsg) => {
      if (!lastMsg || !lastMsg.timestamp) {
        setHasUnread(false);
        return;
      }
      const lastRead = getLastReadTimestamp(syncCode);
      const isFromOther = lastMsg.senderId && lastMsg.senderId !== currentUserId;
      setHasUnread(Boolean(isFromOther && lastMsg.timestamp > lastRead));
    };

    const unsub = subscribeGroupChatLastMessage(syncCode, (lastMsg) => {
      currentLastMsg = lastMsg;
      evaluateUnread(lastMsg);
    });

    const handleReadEvent = (e) => {
      if (e.detail?.syncCode === syncCode?.toUpperCase()) {
        setHasUnread(false);
      }
    };
    window.addEventListener('fairshare_chat_read', handleReadEvent);

    return () => {
      if (unsub) unsub();
      window.removeEventListener('fairshare_chat_read', handleReadEvent);
    };
  }, [syncCode, currentUserId]);

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
                src={getAvatarUrl(member)}
                alt={member.name}
                title={member.name}
                onError={avatarOnError(member.name)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '2px solid var(--bg-card)',
                  marginLeft: idx > 0 ? '-10px' : '0',
                  objectFit: 'cover',
                  background: 'var(--bg-input)'
                }}
              />
            ))}
            {memberObjList.length > 4 && (
              <div 
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--bg-secondary)',
                  border: '2px solid var(--bg-card)',
                  marginLeft: '-10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  color: 'var(--text-muted)'
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
            {getBalanceText()}
          </div>
          {onOpenChat && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                markGroupChatAsRead(syncCode);
                setHasUnread(false);
                onOpenChat(group);
              }}
              style={{
                position: 'relative',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: hasUnread ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent-mint-glow)',
                border: hasUnread ? '1.5px solid #ef4444' : '1px solid rgba(16, 185, 129, 0.4)',
                color: hasUnread ? '#ef4444' : 'var(--accent-mint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                flexShrink: 0
              }}
              title={`Chat in ${group.name}${hasUnread ? ' (New messages)' : ''}`}
            >
              <MessageSquare size={17} />
              {/* WhatsApp / Instagram style unread notification dot */}
              {hasUnread && (
                <span 
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    border: '2px solid var(--bg-card)',
                    boxShadow: '0 0 6px rgba(239, 68, 68, 0.9)',
                    display: 'block'
                  }}
                />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
