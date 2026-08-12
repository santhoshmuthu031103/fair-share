import React, { useState } from 'react';
import { buildLedger, calculateExpenseShares } from '../../utils/debtCalculator';
import { formatCurrency, formatDate, getCategoryMeta, CATEGORIES } from '../../utils/formatters';
import { 
  Users, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Receipt, 
  CreditCard, 
  TrendingUp, 
  PieChart, 
  ChevronRight, 
  X, 
  User,
  Plus,
  Calendar,
  BarChart3
} from 'lucide-react';
import { avatarOnError, getAvatarUrl } from '../../utils/avatarHelper';

export const DashboardView = ({
  groups,
  expenses,
  settlements,
  friends,
  currency,
  currentUser,
  onSelectGroup,
  onCreateGroup,
  onOpenAddExpense
}) => {
  const currentUserId = currentUser?.id || friends[0]?.id;
  const [expandedMemberId, setExpandedMemberId] = useState(null);
  const [selectedChartDay, setSelectedChartDay] = useState(null);

  // 1. Build canonical ledger
  const ledger = buildLedger(expenses, settlements, currentUserId, friends, groups);
  const myNet = ledger.global.netBalances[currentUserId] || 0;

  // Calculate total owed to user and total user owes
  const totalYouAreOwed = ledger.global.totalIsOwed || 0;
  const totalYouOwe = ledger.global.totalOwes || 0;
  let totalGroupSpend = expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);

  // Deduplicate friends by ID to prevent duplicate "You" entries
  const uniqueFriends = friends.reduce((acc, f) => {
    if (!acc.find(x => x.id === f.id)) acc.push(f);
    return acc;
  }, []);

  // Calculate detailed spending statistics per member
  const memberStats = uniqueFriends.map(friend => {
    const totalPaid = ledger.global.totalPaid[friend.id] || 0;
    const totalConsumed = ledger.global.totalConsumed[friend.id] || 0;
    const totalSettledPaid = ledger.global.totalSettledPaid?.[friend.id] || 0;
    const totalSettledReceived = ledger.global.totalSettledReceived?.[friend.id] || 0;
    const netBal = ledger.global.netBalances[friend.id] || 0;
    const totalLent = totalPaid > totalConsumed ? totalPaid - totalConsumed : 0;

    return {
      friend,
      totalPaid,
      totalConsumed,
      totalSettledPaid,
      totalSettledReceived,
      totalLent,
      netBal,
    };
  });

  // Category breakdown
  const categoryTotals = {};
  Object.keys(CATEGORIES).forEach(catKey => { categoryTotals[catKey] = 0; });
  expenses.forEach(e => {
    const cat = e.category || 'other';
    if (categoryTotals[cat] !== undefined) {
      categoryTotals[cat] += (parseFloat(e.amount) || 0);
    } else {
      categoryTotals['other'] = (categoryTotals['other'] || 0) + (parseFloat(e.amount) || 0);
    }
  });

  const activeCategories = Object.entries(categoryTotals)
    .filter(([_, amt]) => amt > 0)
    .sort((a, b) => b[1] - a[1]);

  // -------------------------------------------------------------
  // 📅 Daily Spending Tracker (Past 7 Days)
  // -------------------------------------------------------------
  const now = new Date();
  const past7Days = [];
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Yest' : d.toLocaleDateString('en-US', { weekday: 'short' });
    const formattedShort = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Calculate how much the user personally spent/paid on this day
    const dayExpenses = expenses.filter(e => {
      if (!e.date) return false;
      const expDate = new Date(e.date).toISOString().split('T')[0];
      return expDate === dateStr;
    });

    const totalDaySpend = dayExpenses.reduce((sum, e) => {
      // If user paid
      if (e.paidBy === currentUserId) return sum + (parseFloat(e.amount) || 0);
      // Or user's share if split
      const splitAmt = (parseFloat(e.amount) || 0) / (e.recipientIds?.length || friends.length || 1);
      return sum + splitAmt;
    }, 0);

    past7Days.push({
      dateStr,
      dayName,
      formattedShort,
      amount: totalDaySpend,
      expenses: dayExpenses,
    });
  }

  const maxDayAmount = Math.max(...past7Days.map(d => d.amount), 1);
  const totalWeeklySpend = past7Days.reduce((acc, d) => acc + d.amount, 0);
  const dailyAverage = totalWeeklySpend / 7;
  const todaySpend = past7Days[past7Days.length - 1].amount;

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* 1. Overall Total Hero Widget */}
      <div className="balance-summary-hero">
        <div className="hero-header">Overall Balance</div>
        <div className={`hero-total-amount ${myNet > 0 ? 'positive' : myNet < 0 ? 'negative' : 'neutral'}`}>
          {myNet > 0 ? '+' : ''}{formatCurrency(myNet, currency)}
        </div>

        <div className="hero-split-grid">
          <div className="hero-split-item">
            <div className="hero-split-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowDownLeft size={13} color="var(--accent-mint)" /> You are owed
            </div>
            <div className="hero-split-val owed">
              {formatCurrency(totalYouAreOwed, currency)}
            </div>
          </div>
          <div className="hero-split-item">
            <div className="hero-split-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpRight size={13} color="var(--accent-coral)" /> You owe
            </div>
            <div className="hero-split-val owe">
              {formatCurrency(totalYouOwe, currency)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 📊 Daily Spending Tracker & Interactive Chart */}
      <div style={{ padding: '0 16px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px 14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} color="var(--accent-mint)" />
              <h2 style={{ fontSize: '1rem', fontWeight: '800' }}>Daily Spending Tracker</h2>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Past 7 Days</span>
          </div>

          {/* Quick Metrics Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ background: 'var(--bg-input)', padding: '8px 4px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: '600' }}>Today</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent-mint)' }}>
                {formatCurrency(todaySpend, currency)}
              </div>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: '8px 4px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: '600' }}>Daily Avg</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {formatCurrency(dailyAverage, currency)}
              </div>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: '8px 4px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: '600' }}>7-Day Total</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {formatCurrency(totalWeeklySpend, currency)}
              </div>
            </div>
          </div>

          {/* Visual Daily Bar Chart */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'flex-end', 
              justifyContent: 'space-between', 
              height: '130px', 
              padding: '10px 4px 4px 4px',
              borderBottom: '1px solid var(--border-color)',
              gap: '6px'
            }}
          >
            {past7Days.map((dayItem, idx) => {
              const heightPercent = Math.max(Math.round((dayItem.amount / maxDayAmount) * 100), 8);
              const isSelected = selectedChartDay?.dateStr === dayItem.dateStr;
              const hasSpend = dayItem.amount > 0;

              return (
                <div 
                  key={idx}
                  onClick={() => setSelectedChartDay(isSelected ? null : dayItem)}
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                  title={`${dayItem.formattedShort}: ${formatCurrency(dayItem.amount, currency)}`}
                >
                  {/* Amount label on hover/top */}
                  <div style={{ fontSize: '0.6rem', fontWeight: '700', color: isSelected ? 'var(--accent-mint)' : 'var(--text-muted)', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                    {dayItem.amount > 0 ? `${currency}${Math.round(dayItem.amount)}` : '0'}
                  </div>

                  {/* The Bar */}
                  <div 
                    style={{
                      width: '100%',
                      maxWidth: '28px',
                      height: `${heightPercent}%`,
                      background: isSelected 
                        ? 'var(--accent-mint)' 
                        : hasSpend 
                          ? 'var(--accent-mint-glow)' 
                          : 'var(--bg-input)',
                      borderRadius: '8px 8px 4px 4px',
                      transition: 'all 0.25s ease',
                      boxShadow: isSelected || hasSpend ? '0 2px 8px var(--accent-mint-glow)' : 'none',
                    }}
                  />

                  {/* Day Label */}
                  <div style={{ fontSize: '0.68rem', fontWeight: isSelected ? '800' : '600', color: isSelected ? 'var(--accent-mint)' : 'var(--text-secondary)', marginTop: '6px' }}>
                    {dayItem.dayName}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drilldown on selected chart day */}
          {selectedChartDay && (
            <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg-input)', borderRadius: '12px', animation: 'fadeIn 0.2s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700' }}>
                  📅 {selectedChartDay.formattedShort} Details:
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--accent-mint)' }}>
                  Total: {formatCurrency(selectedChartDay.amount, currency)}
                </span>
              </div>

              {selectedChartDay.expenses.length === 0 ? (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>
                  No individual expenses recorded on this day.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {selectedChartDay.expenses.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{e.title}</span>
                      <span style={{ fontWeight: '700' }}>{formatCurrency(e.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Spender & Member Breakdown Section */}
      <div style={{ padding: '0 16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: '800' }}>Member Spending & Lending</h2>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Tap member for full details</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {memberStats.map(({ friend, totalPaid, totalConsumed, totalSettledPaid, totalSettledReceived, totalLent, netBal }) => {
            const isMe = friend.id === currentUserId;
            const isExpanded = expandedMemberId === friend.id;
            const paidList = expenses.filter(e => e.paidBy === friend.id);
            const pairDebts = ledger.global.pairwiseDebts;
            const amtVsMe = isMe ? null : (pairDebts[friend.id] || 0);

            return (
              <div
                key={friend.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  padding: '0',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Header (always visible) */}
                <div
                  onClick={() => setExpandedMemberId(isExpanded ? null : friend.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <img src={getAvatarUrl(friend)} alt={friend.name} className="avatar-img" style={{ width: '40px', height: '40px' }} onError={avatarOnError(friend.name)} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{isMe ? 'You' : friend.name}</span>
                        {isMe && <span className="badge badge-mint" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>You</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Paid: <strong style={{ color: 'var(--text-secondary)' }}>{formatCurrency(totalPaid, currency)}</strong>
                        {totalLent > 0 && <span> • Lent: <strong style={{ color: 'var(--accent-mint)' }}>{formatCurrency(totalLent, currency)}</strong></span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      {isMe ? (
                        <>
                          <div style={{ 
                            fontWeight: '800', 
                            fontSize: '0.92rem', 
                            color: netBal > 0.01 ? 'var(--accent-mint)' : netBal < -0.01 ? 'var(--accent-coral)' : 'var(--text-muted)' 
                          }}>
                            {netBal > 0.01 ? `+${formatCurrency(netBal, currency)}` : formatCurrency(netBal, currency)}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {netBal > 0.01 ? 'gets back' : netBal < -0.01 ? 'owes group' : 'settled'}
                          </div>
                        </>
                      ) : (
                        <>
                          {Math.abs(amtVsMe) > 0.005 ? (
                            <>
                              <div style={{ 
                                fontWeight: '800', 
                                fontSize: '0.92rem', 
                                color: amtVsMe > 0 ? 'var(--accent-mint)' : 'var(--accent-coral)' 
                              }}>
                                {formatCurrency(Math.abs(amtVsMe), currency)}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {amtVsMe > 0 ? 'owes you' : 'you owe'}
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Settled</div>
                          )}
                        </>
                      )}
                    </div>
                    <ChevronRight size={16} color="var(--text-muted)" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (() => {
                  // Build per-expense share breakdown for this member
                  const involvedExpenses = expenses.filter(e => {
                    const activeMembers = e.recipientIds && e.recipientIds.length > 0
                      ? e.recipientIds
                      : friends.map(f => f.id);
                    return activeMembers.includes(friend.id) || e.paidBy === friend.id;
                  });

                  const expenseBreakdown = involvedExpenses.map(exp => {
                    const grpMembers = exp.groupId
                      ? friends.filter(f => {
                          const grp = groups.find(g => g.id === exp.groupId);
                          return grp ? (grp.members || []).includes(f.id) : true;
                        })
                      : friends;
                    const shares = calculateExpenseShares(exp, grpMembers);
                    const memberShare = shares[friend.id] || 0;
                    const memberPaid = exp.paidBy === friend.id ? parseFloat(exp.amount) || 0 : 0;
                    const grpName = groups.find(g => g.id === exp.groupId)?.name || 'Personal';
                    return { exp, memberShare, memberPaid, grpName };
                  }).filter(r => r.memberShare > 0.005 || r.memberPaid > 0.005);

                  // Pairwise debts involving this member already calculated above

                  return (
                    <div style={{ 
                      padding: '0 14px 14px 14px', 
                      borderTop: '1px dashed var(--border-color)', 
                      background: 'rgba(0,0,0,0.015)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      marginTop: '2px'
                    }}>

                      {/* ── Section 1: Net summary vs current user ── */}
                      {!isMe && Math.abs(amtVsMe) > 0.005 && (
                        <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '12px', background: amtVsMe > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)', border: `1px solid ${amtVsMe > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}` }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: '800', color: amtVsMe > 0 ? 'var(--accent-mint)' : 'var(--accent-coral)' }}>
                            {amtVsMe > 0
                              ? `Owes you ${formatCurrency(amtVsMe, currency)}`
                              : `You owe them ${formatCurrency(Math.abs(amtVsMe), currency)}`
                            }
                          </div>
                        </div>
                      )}

                      {/* ── Section 2: Per-expense + settlement timeline ── */}
                      {(() => {
                        // Build settlement items for this member
                        const memberSettlements = settlements.filter(s =>
                          s.payerId === friend.id || s.payeeId === friend.id
                        ).map(s => {
                          const payerName = (s.payerId === currentUserId && isMe) ? 'You' : (friends.find(f => f.id === s.payerId)?.name || 'Unknown');
                          const payeeName = (s.payeeId === currentUserId && isMe) ? 'You' : (friends.find(f => f.id === s.payeeId)?.name || 'Unknown');
                          return {
                            type: 'settlement',
                            date: s.date || s.createdAt || '',
                            id: s.id,
                            amount: parseFloat(s.amount) || 0,
                            payerName,
                            payeeName,
                            payerId: s.payerId,
                            payeeId: s.payeeId,
                          };
                        });

                        // Build expense items
                        const expenseItems = expenseBreakdown.map(({ exp, memberShare, memberPaid, grpName }) => ({
                          type: 'expense',
                          date: exp.date || '',
                          id: exp.id,
                          exp,
                          memberShare,
                          memberPaid,
                          grpName,
                        }));

                        // Merge and sort by date descending (newest first)
                        const timeline = [...expenseItems, ...memberSettlements].sort((a, b) => {
                          const dA = new Date(a.date || 0).getTime();
                          const dB = new Date(b.date || 0).getTime();
                          return dB - dA;
                        });

                        return (
                          <div style={{ marginTop: isMe ? '12px' : '0' }}>
                            <h4 style={{ fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                              Activity Timeline
                            </h4>
                            {timeline.length === 0 ? (
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Not involved in any activity yet.</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                {timeline.map(item => {
                                  if (item.type === 'settlement') {
                                    const isMePayer = item.payerId === currentUserId;
                                    const isMePayee = item.payeeId === currentUserId;
                                    return (
                                      <div key={item.id} style={{
                                        padding: '8px 10px',
                                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '8px',
                                        background: isMePayer ? 'rgba(244,63,94,0.05)' : isMePayee ? 'rgba(16,185,129,0.05)' : 'rgba(99,102,241,0.05)',
                                        borderLeft: `3px solid ${isMePayer ? 'var(--accent-coral)' : isMePayee ? 'var(--accent-mint)' : 'var(--accent-indigo)'}`,
                                        borderRadius: '0 8px 8px 0',
                                        margin: '2px 0',
                                      }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontWeight: '700', fontSize: '0.84rem', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            💸 Settlement
                                          </div>
                                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            {formatDate(item.date)}
                                          </div>
                                          <div style={{ fontSize: '0.74rem', marginTop: '3px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                            {item.payerName} paid {item.payeeName}
                                          </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                          <div style={{
                                            fontSize: '0.82rem',
                                            fontWeight: '800',
                                            color: isMePayee ? 'var(--accent-mint)' : isMePayer ? 'var(--accent-coral)' : 'var(--text-primary)',
                                          }}>
                                            {isMePayee ? '+' : isMePayer ? '-' : ''}{formatCurrency(item.amount, currency)}
                                          </div>
                                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                            {isMePayee ? 'received' : isMePayer ? 'paid' : 'settled'}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Expense item (same as before)
                                  const { exp, memberShare, memberPaid, grpName } = item;
                                  const didPay = memberPaid > 0.005;
                                  const didOwe = memberShare > 0.005;
                                  const payerFriend = friends.find(f => f.id === exp.paidBy);
                                  const payerName = didPay
                                    ? (isMe ? 'You' : friend.name)
                                    : (exp.paidBy === currentUserId ? 'You' : (payerFriend?.name || '?'));
                                  return (
                                    <div key={exp.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.84rem', marginBottom: '2px' }}>{exp.title}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{grpName} • {formatDate(exp.date)}</div>
                                        <div style={{ fontSize: '0.72rem', marginTop: '3px', color: 'var(--text-secondary)' }}>
                                          Total: {formatCurrency(exp.amount, currency)}
                                          {' • '}
                                          Paid by: <strong>{payerName}</strong>
                                        </div>
                                      </div>
                                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        {didPay && didOwe && exp.paidBy === friend.id && (
                                          <div style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--accent-mint)' }}>
                                            Paid {formatCurrency(memberPaid, currency)}
                                          </div>
                                        )}
                                        <div style={{ fontSize: '0.76rem', fontWeight: '700', color: didPay && !isMe ? 'var(--text-muted)' : 'var(--accent-coral)' }}>
                                          Share: {formatCurrency(memberShare, currency)}
                                        </div>
                                        {didPay && memberPaid > memberShare + 0.005 && (
                                          <div style={{ fontSize: '0.7rem', color: 'var(--accent-mint)', fontWeight: '700' }}>
                                            +{formatCurrency(memberPaid - memberShare, currency)} lent
                                          </div>
                                        )}
                                        {!didPay && didOwe && (
                                          <div style={{ fontSize: '0.7rem', color: 'var(--accent-coral)', fontWeight: '600' }}>
                                            owes {payerName}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* ── Section 3: Balance calculation summary ── */}
                      {isMe && (
                        <div style={{ background: 'var(--bg-input)', borderRadius: '12px', padding: '10px 12px', border: '1px solid var(--border-color)' }}>
                          <h4 style={{ fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>Overall Group Balance</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Total Paid by You</span>
                              <span style={{ fontWeight: '700' }}>{formatCurrency(totalPaid, currency)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderBottom: (totalSettledPaid > 0 || totalSettledReceived > 0) ? '1px dashed var(--border-color)' : 'none', paddingBottom: (totalSettledPaid > 0 || totalSettledReceived > 0) ? '5px' : '0' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Your total share</span>
                              <span style={{ fontWeight: '700', color: 'var(--accent-coral)' }}>-{formatCurrency(totalConsumed, currency)}</span>
                            </div>
                            {totalSettledPaid > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Settlements Paid</span>
                                <span style={{ fontWeight: '700', color: 'var(--accent-mint)' }}>+{formatCurrency(totalSettledPaid, currency)}</span>
                              </div>
                            )}
                            {totalSettledReceived > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '5px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Settlements Received</span>
                                <span style={{ fontWeight: '700', color: 'var(--accent-coral)' }}>-{formatCurrency(totalSettledReceived, currency)}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', paddingTop: '3px', fontWeight: '800' }}>
                              <span>Net (Group)</span>
                              <span style={{ color: netBal > 0.01 ? 'var(--accent-mint)' : netBal < -0.01 ? 'var(--accent-coral)' : 'var(--text-muted)' }}>
                                {netBal > 0.01 ? '+' : ''}{formatCurrency(netBal, currency)}
                                {' '}{netBal > 0.01 ? '← gets back' : netBal < -0.01 ? '← owes' : '✓ settled'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Section 4 (current user only): full pairwise ── */}
                      {isMe && (
                        <div>
                          <h4 style={{ fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>Who Owes You / You Owe</h4>
                          {Object.entries(pairDebts).filter(([, amt]) => Math.abs(amt) > 0.005).length === 0 ? (
                            <div style={{ fontSize: '0.82rem', color: 'var(--accent-mint)', fontWeight: '600' }}>✓ All settled up!</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {Object.entries(pairDebts)
                                .filter(([, amt]) => Math.abs(amt) > 0.005)
                                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                                .map(([fId, amt]) => {
                                  const fName = friends.find(f => f.id === fId)?.name || 'Unknown';
                                  return (
                                    <div key={fId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: '10px', background: amt > 0 ? 'rgba(16,185,129,0.07)' : 'rgba(244,63,94,0.07)' }}>
                                      <span style={{ fontSize: '0.84rem', fontWeight: '700' }}>{fName}</span>
                                      <span style={{ fontWeight: '800', fontSize: '0.84rem', color: amt > 0 ? 'var(--accent-mint)' : 'var(--accent-coral)' }}>
                                        {amt > 0 ? `owes you ${formatCurrency(amt, currency)}` : `you owe ${formatCurrency(Math.abs(amt), currency)}`}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Category Spending Breakdown */}
      <div style={{ padding: '0 16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: '800' }}>Spending by Category</h2>
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-mint)' }}>
            Total: {formatCurrency(totalGroupSpend, currency)}
          </span>
        </div>

        {activeCategories.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            No expenses recorded yet.
          </div>
        ) : (
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeCategories.map(([catKey, amt]) => {
                const meta = getCategoryMeta(catKey);
                const percent = totalGroupSpend > 0 ? Math.round((amt / totalGroupSpend) * 100) : 0;

                return (
                  <div key={catKey}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{meta.label}</span>
                      <span style={{ fontWeight: '700' }}>{formatCurrency(amt, currency)} <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({percent}%)</span></span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: meta.color, borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
