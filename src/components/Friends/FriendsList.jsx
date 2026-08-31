import React from 'react';
import { buildLedger } from '../../utils/debtCalculator';
import { formatCurrency } from '../../utils/formatters';
import { UserPlus, DollarSign, Trash2, Share2, Phone, Mail, Flame } from 'lucide-react';
import { avatarOnError, getAvatarUrl } from '../../utils/avatarHelper';
import ROASTS from '../../data/roasts';
import { openEmailComposer } from '../../utils/emailHelper';

export const FriendsList = ({ 
  friends, 
  groups = [],
  expenses, 
  settlements, 
  currency, 
  currentUser,
  onOpenAddFriend, 
  onOpenSettleUp,
  onDeleteFriend 
}) => {
  const currentUserId = currentUser?.id || friends[0]?.id;
  const ledger = buildLedger(expenses, settlements, currentUserId, friends, groups);
  const pairwise = ledger.global.pairwiseDebts;
  const friendsExceptYou = friends.filter(f => f.id !== currentUserId);

  const handleRoast = async (friend, amountStr) => {
    const randomRoast = ROASTS[Math.floor(Math.random() * ROASTS.length)];
    const message = randomRoast.replace('{name}', friend.name).replace('{amount}', amountStr);
    
    const senderName = currentUser?.name || 'Your Friend';
    const subject = `💸 Pay up, ${friend.name}! You owe ${amountStr}`;
    const body = `${message}\n\n— Sent with love (and impatience) by ${senderName} via FairShare 🔥`;

    if (friend.email) {
      await openEmailComposer({
        to: friend.email,
        subject,
        body
      });
    } else {
      // If friend doesn't have an email saved, prompt or open composer with prefilled body
      if (confirm(`No email address saved for ${friend.name}. Open Gmail to send with prefilled text?`)) {
        await openEmailComposer({
          to: '',
          subject,
          body
        });
      } else if (navigator.share) {
        navigator.share({
          title: subject,
          text: body,
        }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(body);
        alert('🔥 Roast copied to clipboard! Paste it to your friend.');
      } else {
        alert(body);
      }
    }
  };

  const handleShareInvite = () => {
    const inviteText = [
      "👋 Hey! I'm using Splitwise to split bills and track expenses.",
      "",
      "📲 Install Splitwise-App.apk on your phone!",
      "Register with your mobile & email and we can split expenses seamlessly together."
    ].join('\n');

    if (navigator.share) {
      navigator.share({
        title: 'Join me on Splitwise',
        text: inviteText,
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteText);
      alert('✅ Invite message copied! Share it via WhatsApp or SMS to your friend.');
    }
  };

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Friends & Contacts ({friendsExceptYou.length})</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Track balances with friends</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            onClick={handleShareInvite} 
            className="btn-secondary" 
            style={{ flex: 'none', width: 'auto', height: '36px', padding: '0 12px', fontSize: '0.78rem', gap: '5px' }}
            title="Invite friend via WhatsApp/SMS"
          >
            <Share2 size={14} /> Invite
          </button>
          <button 
            onClick={onOpenAddFriend} 
            className="btn-primary" 
            style={{ flex: 'none', width: 'auto', height: '36px', padding: '0 12px', fontSize: '0.78rem', gap: '5px' }}
          >
            <UserPlus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Empty State */}
      {friendsExceptYou.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <UserPlus size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px auto' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '6px' }}>No friends added yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '14px' }}>
            Add your friends by mobile or email so you can split expenses with them in any group.
          </p>
          <button onClick={onOpenAddFriend} className="btn-primary" style={{ width: 'auto', margin: '0 auto' }}>
            <UserPlus size={16} /> Add Friend Contact
          </button>
        </div>
      ) : (
        friendsExceptYou.map(friend => {
          const netBal = pairwise[friend.id] || 0;

          return (
            <div key={friend.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <img src={getAvatarUrl(friend)} alt={friend.name} className="avatar-img" style={{ flexShrink: 0 }} onError={avatarOnError(friend.name)} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {friend.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {friend.phone && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.phone}</div>}
                    {friend.email && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.email}</div>}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <div>
                  {Math.abs(netBal) < 0.01 ? (
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600' }}>settled up</span>
                  ) : netBal > 0 ? (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-mint)', fontWeight: '600' }}>owes you</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--accent-mint)' }}>
                        {formatCurrency(netBal, currency)}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-coral)', fontWeight: '600' }}>you owe</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--accent-coral)' }}>
                        {formatCurrency(Math.abs(netBal), currency)}
                      </div>
                    </div>
                  )}
                </div>

                {Math.abs(netBal) >= 0.01 && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {netBal > 0 && (
                      <button
                        onClick={() => handleRoast(friend, formatCurrency(netBal, currency))}
                        className="icon-btn"
                        title="Roast & Remind"
                        style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: 'none' }}
                      >
                        <Flame size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => onOpenSettleUp({
                        payerId: netBal < 0 ? currentUserId : friend.id,
                        payeeId: netBal < 0 ? friend.id : currentUserId,
                        amount: Math.abs(netBal)
                      })}
                      className="icon-btn"
                      title="Settle Up"
                      style={{ background: 'var(--accent-mint-glow)', color: 'var(--accent-mint)', border: 'none' }}
                    >
                      <DollarSign size={16} />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => onDeleteFriend && onDeleteFriend(friend.id)}
                  className="icon-btn"
                  title="Delete Contact"
                  style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-coral)', border: 'none' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
