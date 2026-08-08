import React, { useState } from 'react';
import { calculateNetBalances } from '../../utils/debtCalculator';
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
  const [selectedSpender, setSelectedSpender] = useState(null);
  const [selectedChartDay, setSelectedChartDay] = useState(null);

  // 1. Calculate overall balances for everyone
  const overallBalances = calculateNetBalances(expenses, settlements, friends);
  const myNet = overallBalances[currentUserId] || 0;

  // Calculate total owed to user and total user owes
  let totalYouAreOwed = 0;
  let totalYouOwe = 0;
  let totalGroupSpend = expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);

  groups.forEach(g => {
    const groupExps = expenses.filter(e => e.groupId === g.id);
    const groupSets = settlements.filter(s => s.groupId === g.id);
    const groupMembers = (g.members || []).map(mId => friends.find(f => f.id === mId)).filter(Boolean);
    const groupBals = calculateNetBalances(groupExps, groupSets, groupMembers.length > 0 ? groupMembers : friends);
    
    const userBal = groupBals[currentUserId] || 0;
    if (userBal > 0) totalYouAreOwed += userBal;
    if (userBal < 0) totalYouOwe += Math.abs(userBal);
  });

  // Calculate detailed spending statistics per member
  const memberStats = friends.map(friend => {
    const totalPaid = expenses
      .filter(e => e.paidBy === friend.id)
      .reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);

    let totalConsumed = 0;
    expenses.forEach(exp => {
      const activeMembers = (exp.recipientIds && exp.recipientIds.length > 0)
        ? friends.filter(m => exp.recipientIds.includes(m.id))
        : friends;
      
      const isIncluded = activeMembers.some(m => m.id === friend.id);
      if (isIncluded && activeMembers.length > 0) {
        if (exp.splitType === 'equal') {
          totalConsumed += (parseFloat(exp.amount) || 0) / activeMembers.length;
        } else if (exp.splitType === 'exact') {
          totalConsumed += (parseFloat(exp.splits?.[friend.id]) || 0);
        } else if (exp.splitType === 'percentage') {
          totalConsumed += ((parseFloat(exp.amount) || 0) * (parseFloat(exp.splits?.[friend.id]) || 0)) / 100;
        }
      }
    });

    const netBal = overallBalances[friend.id] || 0;
    const totalLent = totalPaid > totalConsumed ? totalPaid - totalConsumed : 0;

    return {
      friend,
      totalPaid,
      totalConsumed,
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
                    {dayItem.amount > 0 ? `₹${Math.round(dayItem.amount)}` : '0'}
                  </div>

                  {/* The Bar */}
                  <div 
                    style={{
                      width: '100%',
                      maxWidth: '28px',
                      height: `${heightPercent}%`,
                      background: isSelected 
                        ? 'linear-gradient(180deg, #1d4ed8, #2563eb)' 
                        : hasSpend 
                          ? 'linear-gradient(180deg, var(--accent-mint), rgba(37, 99, 235, 0.6))' 
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
          {memberStats.map(({ friend, totalPaid, totalLent, netBal }) => {
            const isMe = friend.id === currentUserId;

            return (
              <div
                key={friend.id}
                onClick={() => setSelectedSpender(friend)}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: '12px 14px',
                  border: '1px solid var(--border-color)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <img src={friend.avatar} alt={friend.name} className="avatar-img" style={{ width: '40px', height: '40px' }} />
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
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
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

      {/* 5. Spender Details Drilldown Modal */}
      {selectedSpender && (
        <div className="modal-overlay" onClick={() => setSelectedSpender(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88vh' }}>
            <div className="sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={selectedSpender.avatar} alt={selectedSpender.name} style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid var(--accent-mint)' }} />
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: '800' }}>
                    {selectedSpender.id === currentUserId ? 'Your Expenses & Lending' : `${selectedSpender.name}'s Details`}
                  </h2>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {selectedSpender.email || selectedSpender.phone}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedSpender(null)} className="icon-btn">
                <X size={18} />
              </button>
            </div>

            {(() => {
              const paidList = expenses.filter(e => e.paidBy === selectedSpender.id);
              const totalPaidAmt = paidList.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
              const netBal = overallBalances[selectedSpender.id] || 0;

              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Money Paid</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {formatCurrency(totalPaidAmt, currency)}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Net Balance</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '800', color: netBal >= 0 ? 'var(--accent-mint)' : 'var(--accent-coral)' }}>
                        {netBal >= 0 ? `+${formatCurrency(netBal, currency)}` : formatCurrency(netBal, currency)}
                      </div>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '8px' }}>
                    Expenses Paid by {selectedSpender.id === currentUserId ? 'You' : selectedSpender.name} ({paidList.length})
                  </h3>

                  {paidList.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      No expenses paid by this member yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '40vh', overflowY: 'auto' }}>
                      {paidList.map(exp => {
                        const grpName = groups.find(g => g.id === exp.groupId)?.name || 'Group';
                        return (
                          <div key={exp.id} className="card" style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '0.88rem' }}>{exp.title}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                in <strong style={{ color: 'var(--text-secondary)' }}>{grpName}</strong> • {formatDate(exp.date)}
                              </div>
                            </div>
                            <div style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--accent-mint)' }}>
                              {formatCurrency(exp.amount, currency)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
