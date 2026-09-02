import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  BellRing, 
  Smile, 
  Trash2, 
  Sparkles, 
  MessageSquare,
  DollarSign,
  Receipt,
  CheckCheck,
  X
} from 'lucide-react';
import { 
  sendGroupChatMessage, 
  subscribeGroupChat, 
  toggleChatMessageReaction, 
  deleteGroupChatMessage,
  triggerNotification
} from '../../utils/firebaseSync';
import { avatarOnError, getAvatarUrl } from '../../utils/avatarHelper';

const QUICK_REACTIONS = ['👍', '❤️', '💸', '🧾', '🔥'];

export const GroupChat = ({ group, currentUser, friends, onOpenSettleUp, onClose, someoneOwesMe }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showReactionPickerFor, setShowReactionPickerFor] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const currentUserId = currentUser?.id || 'anon';
  const syncCode = group?.syncCode || group?.id?.slice(-6)?.toUpperCase();

  // Subscribe to real-time chat updates
  useEffect(() => {
    if (!syncCode) return;
    const unsubscribe = subscribeGroupChat(syncCode, (msgList) => {
      setMessages(msgList);
    });
    return () => unsubscribe();
  }, [syncCode]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending || !syncCode) return;

    setIsSending(true);
    try {
      await sendGroupChatMessage(syncCode, {
        senderId: currentUserId,
        senderName: currentUser?.name || 'You',
        senderAvatar: currentUser?.avatar || null,
        text,
        type: 'text',
      });
      setInputText('');
      if (inputRef.current) inputRef.current.focus();

      // Trigger Firebase push notification to other group members
      const otherMemberIds = (group?.members || []).filter(id => id !== currentUserId);
      if (otherMemberIds.length > 0) {
        triggerNotification({
          action: 'chat_message',
          senderName: currentUser?.name || 'Someone',
          senderId: currentUserId,
          groupName: group?.name || 'Group',
          customTitle: `💬 ${group?.name || 'Group'} • ${currentUser?.name || 'Someone'}`,
          customBody: text.length > 100 ? text.slice(0, 97) + '...' : text,
          memberIds: otherMemberIds,
        });
      }
    } catch (err) {
      console.warn('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendNudge = async () => {
    if (isSending || !syncCode) return;
    setIsSending(true);
    try {
      await sendGroupChatMessage(syncCode, {
        senderId: currentUserId,
        senderName: currentUser?.name || 'You',
        senderAvatar: currentUser?.avatar || null,
        text: `Friendly reminder to check your balances and settle up!`,
        type: 'nudge',
      });

      // Trigger Firebase push notification to other members
      const otherMemberIds = (group?.members || []).filter(id => id !== currentUserId);
      if (otherMemberIds.length > 0) {
        triggerNotification({
          action: 'nudge_settle',
          senderName: currentUser?.name || 'Someone',
          senderId: currentUserId,
          groupName: group?.name || 'Group',
          customTitle: `🔔 Settlement Reminder • ${group?.name || 'Group'}`,
          customBody: `${currentUser?.name || 'Someone'} sent a reminder to check balances and settle up!`,
          memberIds: otherMemberIds,
        });
      }
    } catch (err) {
      console.warn('Failed to send nudge:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleReaction = async (messageId, emoji) => {
    if (!syncCode) return;
    await toggleChatMessageReaction(syncCode, messageId, emoji, currentUserId);
    setShowReactionPickerFor(null);
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    await deleteGroupChatMessage(syncCode, messageId);
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--bg-card)',
      overflow: 'hidden'
    }}>
      {/* Clean Single Header (WhatsApp / Telegram style) */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {group?.coverImage ? (
            <img 
              src={group.coverImage} 
              alt={group.name} 
              style={{ width: '38px', height: '38px', borderRadius: '10px', objectFit: 'cover' }} 
            />
          ) : (
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '1rem'
            }}>
              {group?.name?.charAt(0)?.toUpperCase() || 'G'}
            </div>
          )}
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {group?.name || 'Group'}
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {group?.members?.length || friends?.length || 0} members
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Quick Nudge Button — ONLY shown if someone owes the user money */}
          {someoneOwesMe && (
            <button
              type="button"
              onClick={handleSendNudge}
              disabled={isSending}
              title="Send a polite reminder to settle balances"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: 'var(--accent-amber)',
                padding: '6px 11px',
                borderRadius: '14px',
                fontSize: '0.74rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <BellRing size={13} />
              <span>Nudge to Settle</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="icon-btn"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
              title="Close Chat"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        scrollbarWidth: 'thin'
      }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '20px'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              <MessageSquare size={24} style={{ opacity: 0.5 }} />
            </div>
            <p style={{ fontWeight: '700', margin: '0 0 6px 0', fontSize: '0.95rem' }}>No messages yet</p>
            <p style={{ fontSize: '0.8rem', maxWidth: '280px', margin: 0, lineHeight: 1.4 }}>
              Discuss expenses, ask who paid for what, or tap <strong>"Nudge to Settle"</strong> to send a friendly reminder!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            const senderFriend = friends?.find(f => f.id === msg.senderId);
            const avatarUrl = msg.senderAvatar || (senderFriend ? getAvatarUrl(senderFriend) : null);
            const isNudge = msg.type === 'nudge';

            if (isNudge) {
              return (
                <div 
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '6px 0'
                  }}
                >
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.08) 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '16px',
                    padding: '10px 16px',
                    maxWidth: '85%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)'
                  }}>
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.25)',
                      padding: '8px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-amber)'
                    }}>
                      <BellRing size={16} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--accent-amber)' }}>
                        {isMe ? 'You' : msg.senderName} sent a settlement reminder
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {msg.text}
                      </div>
                    </div>
                    {!isMe && onOpenSettleUp && (
                      <button
                        type="button"
                        onClick={onOpenSettleUp}
                        style={{
                          background: 'var(--accent-amber)',
                          color: '#000',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Settle Up
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  position: 'relative'
                }}
              >
                {/* Sender Info & Avatar (for others) */}
                {!isMe && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', paddingLeft: '4px' }}>
                    <img 
                      src={avatarUrl} 
                      alt={msg.senderName}
                      onError={avatarOnError(msg.senderName)}
                      style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                      {msg.senderName}
                    </span>
                  </div>
                )}

                {/* Message Bubble Container */}
                <div 
                  style={{
                    position: 'relative',
                    maxWidth: '82%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start'
                  }}
                  onMouseEnter={() => setShowReactionPickerFor(msg.id)}
                  onMouseLeave={() => setShowReactionPickerFor(null)}
                >
                  {/* Bubble */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMe 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                        : 'var(--bg-input)',
                      color: isMe ? '#ffffff' : 'var(--text-primary)',
                      border: isMe ? 'none' : '1px solid var(--border-color)',
                      boxShadow: isMe 
                        ? '0 4px 12px rgba(16, 185, 129, 0.25)' 
                        : '0 2px 8px rgba(0,0,0,0.15)',
                      fontSize: '0.88rem',
                      lineHeight: '1.45',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.text}
                    
                    {/* Timestamp & check */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      marginTop: '4px',
                      fontSize: '0.65rem',
                      opacity: 0.75,
                      color: isMe ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)'
                    }}>
                      <span>{formatTime(msg.timestamp)}</span>
                      {isMe && <CheckCheck size={12} />}
                    </div>
                  </div>

                  {/* Hover Reaction Trigger */}
                  {showReactionPickerFor === msg.id && (
                    <div style={{
                      position: 'absolute',
                      top: '-32px',
                      [isMe ? 'right' : 'left']: 0,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '20px',
                      padding: '3px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                      zIndex: 10
                    }}>
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleReaction(msg.id, emoji)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            padding: '2px 4px',
                            transition: 'transform 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.25)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          {emoji}
                        </button>
                      ))}
                      {isMe && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          title="Delete message"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--accent-rose)',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Reaction Badges Below Bubble */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px',
                      marginTop: '4px'
                    }}>
                      {Object.entries(msg.reactions).map(([emoji, usersObj]) => {
                        const userCount = usersObj ? Object.keys(usersObj).length : 0;
                        if (userCount === 0) return null;
                        const iReacted = usersObj && usersObj[currentUserId];

                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleReaction(msg.id, emoji)}
                            style={{
                              background: iReacted ? 'var(--accent-mint-glow)' : 'var(--bg-card)',
                              border: iReacted ? '1px solid var(--accent-mint)' : '1px solid var(--border-color)',
                              borderRadius: '12px',
                              padding: '2px 6px',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              color: 'var(--text-primary)'
                            }}
                          >
                            <span>{emoji}</span>
                            <span style={{ fontWeight: '700', fontSize: '0.68rem' }}>{userCount}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form 
        onSubmit={handleSendMessage}
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-input)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Message ${group?.name || 'group'}...`}
          disabled={isSending}
          style={{
            flex: 1,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            padding: '10px 16px',
            fontSize: '0.88rem',
            color: 'var(--text-primary)',
            outline: 'none'
          }}
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: inputText.trim() 
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
              : 'rgba(255,255,255,0.06)',
            color: inputText.trim() ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: inputText.trim() ? 'pointer' : 'default',
            boxShadow: inputText.trim() ? '0 4px 12px rgba(16, 185, 129, 0.35)' : 'none',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
        >
          <Send size={18} style={{ marginLeft: '2px' }} />
        </button>
      </form>
    </div>
  );
};
