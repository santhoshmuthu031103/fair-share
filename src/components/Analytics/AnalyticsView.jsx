import React, { useState } from 'react';
import { CATEGORIES, getCategoryMeta, formatCurrency } from '../../utils/formatters';
import { TrendingUp, Award, Crown, Trophy, Star, Scissors, PartyPopper, Landmark } from 'lucide-react';
import { avatarOnError, getAvatarUrl } from '../../utils/avatarHelper';
import { buildLedger } from '../../utils/debtCalculator';

export const AnalyticsView = ({ expenses, groups, friends, settlements, currency, currentUser }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const totalSpend = expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
  const currentUserId = currentUser?.id || friends[0]?.id;

  // ── Category breakdown ──
  const categoryTotals = {};
  Object.keys(CATEGORIES).forEach(cId => { categoryTotals[cId] = 0; });
  expenses.forEach(e => {
    const cat = e.category || 'general';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(e.amount) || 0);
  });
  const sortedCategories = Object.entries(categoryTotals)
    .filter(([_, amt]) => amt > 0)
    .sort((a, b) => b[1] - a[1]);

  // ── Payer breakdown ──
  const payerTotals = {};
  friends.forEach(f => { payerTotals[f.id] = 0; });
  expenses.forEach(e => {
    if (payerTotals[e.paidBy] !== undefined) {
      payerTotals[e.paidBy] += (parseFloat(e.amount) || 0);
    }
  });
  const sortedPayers = Object.entries(payerTotals)
    .filter(([_, amt]) => amt > 0)
    .sort((a, b) => b[1] - a[1]);

  // ── Monthly spending trend ──
  const monthlyTotals = {};
  expenses.forEach(e => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyTotals[key] = (monthlyTotals[key] || 0) + (parseFloat(e.amount) || 0);
  });
  const sortedMonths = Object.entries(monthlyTotals).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  const maxMonthly = Math.max(...sortedMonths.map(([_, v]) => v), 1);

  // ── Group spending comparison ──
  const groupTotals = {};
  groups.forEach(g => { groupTotals[g.id] = { name: g.name, total: 0, count: 0 }; });
  expenses.forEach(e => {
    if (groupTotals[e.groupId]) {
      groupTotals[e.groupId].total += (parseFloat(e.amount) || 0);
      groupTotals[e.groupId].count++;
    }
  });
  const sortedGroups = Object.values(groupTotals)
    .filter(g => g.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxGroupTotal = Math.max(...sortedGroups.map(g => g.total), 1);

  // ── Fun Badges ──
  const ledger = buildLedger(expenses, settlements, friends, groups, currentUserId);
  const badges = [];

  // The Bank — person who is owed the most
  if (friends.length > 1) {
    const netBalances = {};
    friends.forEach(f => {
      const ctx = ledger.global;
      netBalances[f.id] = ctx.netBalances[f.id] || 0;
    });
    const bankPerson = Object.entries(netBalances).sort((a, b) => b[1] - a[1])[0];
    if (bankPerson && bankPerson[1] > 0.01) {
      const f = friends.find(fr => fr.id === bankPerson[0]);
      if (f) badges.push({ emoji: '\u{1F3E6}', title: 'The Bank', desc: `${f.id === currentUserId ? 'You are' : f.name + ' is'} owed the most`, person: f, value: formatCurrency(bankPerson[1], currency) });
    }

    // The Freeloader — person who owes the most
    const freeloader = Object.entries(netBalances).sort((a, b) => a[1] - b[1])[0];
    if (freeloader && freeloader[1] < -0.01) {
      const f = friends.find(fr => fr.id === freeloader[0]);
      if (f) badges.push({ emoji: '\u{1F355}', title: 'The Freeloader', desc: `${f.id === currentUserId ? 'You owe' : f.name + ' owes'} the most`, person: f, value: formatCurrency(Math.abs(freeloader[1]), currency) });
    }
  }

  // Big Spender — highest single expense
  if (expenses.length > 0) {
    const biggest = [...expenses].sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))[0];
    const f = friends.find(fr => fr.id === biggest.paidBy);
    if (f) badges.push({ emoji: '\u{1F4B8}', title: 'Big Spender', desc: `Paid ${formatCurrency(biggest.amount, currency)} for "${biggest.title}"`, person: f });
  }

  // The Splitter — person who added the most expenses
  if (expenses.length > 0) {
    const expCounts = {};
    expenses.forEach(e => { expCounts[e.paidBy] = (expCounts[e.paidBy] || 0) + 1; });
    const splitter = Object.entries(expCounts).sort((a, b) => b[1] - a[1])[0];
    if (splitter) {
      const f = friends.find(fr => fr.id === splitter[0]);
      if (f) badges.push({ emoji: '\u2702\uFE0F', title: 'The Splitter', desc: `Added ${splitter[1]} expenses`, person: f });
    }
  }

  // The Socialite — in the most groups
  if (groups.length > 1) {
    const groupCounts = {};
    friends.forEach(f => { groupCounts[f.id] = 0; });
    groups.forEach(g => {
      (g.members || []).forEach(mId => {
        groupCounts[mId] = (groupCounts[mId] || 0) + 1;
      });
    });
    const socialite = Object.entries(groupCounts).sort((a, b) => b[1] - a[1])[0];
    if (socialite && socialite[1] > 1) {
      const f = friends.find(fr => fr.id === socialite[0]);
      if (f) badges.push({ emoji: '\u{1F389}', title: 'The Socialite', desc: `In ${socialite[1]} groups`, person: f });
    }
  }

  // ── SVG Donut Chart ──
  const DonutChart = ({ data, size = 160 }) => {
    if (data.length === 0) return null;
    const total = data.reduce((s, [_, v]) => s + v, 0);
    const cx = size / 2, cy = size / 2, radius = size * 0.35, strokeWidth = size * 0.18;
    let cumulativeAngle = -90;

    const arcs = data.map(([catId, amt]) => {
      const angle = (amt / total) * 360;
      const startAngle = cumulativeAngle;
      cumulativeAngle += angle;
      const endAngle = cumulativeAngle;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);
      const largeArc = angle > 180 ? 1 : 0;
      const color = getCategoryMeta(catId).color;
      const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
      return <path key={catId} d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" style={{ opacity: 0.9 }} />;
    });

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="1.1rem" fontWeight="800" fontFamily="var(--font-heading)">
          {formatCurrency(total, currency)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="0.6rem" fontWeight="600">
          Total Spent
        </text>
      </svg>
    );
  };

  const monthLabel = (key) => {
    const [y, m] = key.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(m) - 1] || m;
  };

  // Section pills
  const sections = [
    { id: 'overview', label: '\u{1F4CA} Overview' },
    { id: 'badges', label: '\u{1F3C6} Badges' },
    { id: 'groups', label: '\u{1F465} Groups' },
  ];

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Spending Analytics</h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Your financial insights at a glance</p>
      </div>

      {/* Section Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              padding: '8px 16px', borderRadius: '20px', border: 'none',
              background: activeSection === s.id ? 'var(--accent-mint)' : 'var(--bg-input)',
              color: activeSection === s.id ? '#fff' : 'var(--text-secondary)',
              fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'all 0.2s ease',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeSection === 'overview' && (
        <>
          {/* Hero Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <div className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Total Spent</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-mint)', fontFamily: 'var(--font-heading)' }}>
                {formatCurrency(totalSpend, currency)}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Expenses</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', fontFamily: 'var(--font-heading)' }}>{expenses.length}</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Avg/Expense</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', fontFamily: 'var(--font-heading)' }}>
                {expenses.length > 0 ? formatCurrency(totalSpend / expenses.length, currency) : `${currency}0`}
              </div>
            </div>
          </div>

          {/* Donut Chart + Category Legend */}
          <div className="card" style={{ marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '12px' }}>Category Breakdown</h3>
            {sortedCategories.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No expenses recorded yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                <DonutChart data={sortedCategories} size={170} />
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sortedCategories.map(([catId, amt]) => {
                    const catMeta = getCategoryMeta(catId);
                    const pct = totalSpend > 0 ? (amt / totalSpend) * 100 : 0;
                    return (
                      <div key={catId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: catMeta.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: '600', flex: 1 }}>{catMeta.label}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>{pct.toFixed(1)}%</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: '700', minWidth: '60px', textAlign: 'right' }}>{formatCurrency(amt, currency)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Monthly Trend */}
          {sortedMonths.length > 0 && (
            <div className="card" style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '14px' }}>Monthly Trend</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sortedMonths.map(([key, amt]) => {
                  const pct = (amt / maxMonthly) * 100;
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', width: '32px', color: 'var(--text-secondary)' }}>{monthLabel(key)}</span>
                      <div style={{ flex: 1, height: '20px', background: 'var(--bg-input)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`, borderRadius: '6px',
                          background: 'linear-gradient(90deg, var(--accent-mint) 0%, rgba(16,185,129,0.6) 100%)',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', minWidth: '60px', textAlign: 'right' }}>{formatCurrency(amt, currency)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Spenders Podium */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '14px' }}>Top Spenders</h3>
            {sortedPayers.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet.</div>
            ) : (
              <>
                {/* Podium for top 3 */}
                {sortedPayers.length >= 2 && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', marginBottom: '16px', height: '140px' }}>
                    {/* 2nd place */}
                    {sortedPayers[1] && (() => {
                      const f = friends.find(fr => fr.id === sortedPayers[1][0]);
                      if (!f) return null;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
                          <img src={getAvatarUrl(f)} alt={f.name} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #c0c0c0', objectFit: 'cover', marginBottom: '4px' }} onError={avatarOnError(f.name)} />
                          <div style={{ fontSize: '0.7rem', fontWeight: '700', textAlign: 'center', marginBottom: '4px' }}>{f.id === currentUserId ? 'You' : f.name.split(' ')[0]}</div>
                          <div style={{
                            width: '100%', height: '50px', borderRadius: '8px 8px 0 0',
                            background: 'linear-gradient(180deg, #c0c0c0 0%, rgba(192,192,192,0.3) 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem', fontWeight: '800',
                          }}>{'\u{1F948}'}</div>
                          <div style={{ fontSize: '0.68rem', fontWeight: '700', marginTop: '2px' }}>{formatCurrency(sortedPayers[1][1], currency)}</div>
                        </div>
                      );
                    })()}

                    {/* 1st place */}
                    {sortedPayers[0] && (() => {
                      const f = friends.find(fr => fr.id === sortedPayers[0][0]);
                      if (!f) return null;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90px' }}>
                          <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>{'\u{1F451}'}</div>
                          <img src={getAvatarUrl(f)} alt={f.name} style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid #ffd700', objectFit: 'cover', marginBottom: '4px' }} onError={avatarOnError(f.name)} />
                          <div style={{ fontSize: '0.72rem', fontWeight: '800', textAlign: 'center', marginBottom: '4px' }}>{f.id === currentUserId ? 'You' : f.name.split(' ')[0]}</div>
                          <div style={{
                            width: '100%', height: '70px', borderRadius: '8px 8px 0 0',
                            background: 'linear-gradient(180deg, #ffd700 0%, rgba(255,215,0,0.3) 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.4rem', fontWeight: '800',
                          }}>{'\u{1F947}'}</div>
                          <div style={{ fontSize: '0.72rem', fontWeight: '800', marginTop: '2px', color: 'var(--accent-mint)' }}>{formatCurrency(sortedPayers[0][1], currency)}</div>
                        </div>
                      );
                    })()}

                    {/* 3rd place */}
                    {sortedPayers[2] && (() => {
                      const f = friends.find(fr => fr.id === sortedPayers[2][0]);
                      if (!f) return null;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
                          <img src={getAvatarUrl(f)} alt={f.name} style={{ width: '34px', height: '34px', borderRadius: '50%', border: '2px solid #cd7f32', objectFit: 'cover', marginBottom: '4px' }} onError={avatarOnError(f.name)} />
                          <div style={{ fontSize: '0.68rem', fontWeight: '700', textAlign: 'center', marginBottom: '4px' }}>{f.id === currentUserId ? 'You' : f.name.split(' ')[0]}</div>
                          <div style={{
                            width: '100%', height: '35px', borderRadius: '8px 8px 0 0',
                            background: 'linear-gradient(180deg, #cd7f32 0%, rgba(205,127,50,0.3) 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1rem', fontWeight: '800',
                          }}>{'\u{1F949}'}</div>
                          <div style={{ fontSize: '0.68rem', fontWeight: '700', marginTop: '2px' }}>{formatCurrency(sortedPayers[2][1], currency)}</div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Rest of spenders as list */}
                {sortedPayers.slice(sortedPayers.length >= 2 ? 3 : 0).map(([uId, totalPaid], idx) => {
                  const friend = friends.find(f => f.id === uId);
                  if (!friend) return null;
                  const pct = totalSpend > 0 ? (totalPaid / totalSpend) * 100 : 0;
                  return (
                    <div key={uId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', width: '20px' }}>#{(sortedPayers.length >= 2 ? 3 : 0) + idx + 1}</span>
                        <img src={getAvatarUrl(friend)} alt={friend.name} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} onError={avatarOnError(friend.name)} />
                        <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>{friend.id === currentUserId ? 'You' : friend.name}</div>
                      </div>
                      <div style={{ fontWeight: '700', fontSize: '0.88rem' }}>{formatCurrency(totalPaid, currency)}</div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}

      {/* BADGES */}
      {activeSection === 'badges' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {badges.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{'\u{1F3C6}'}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '6px' }}>No Badges Yet</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Add some expenses and friends to unlock fun badges!</div>
            </div>
          ) : (
            badges.map((badge, idx) => (
              <div key={idx} className="card" style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(16,185,129,0.05) 100%)',
                border: '1px solid rgba(16,185,129,0.15)',
              }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '16px',
                  background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.6rem', flexShrink: 0,
                }}>
                  {badge.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '800', fontSize: '0.92rem' }}>{badge.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>{badge.desc}</div>
                  {badge.value && <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--accent-mint)', marginTop: '2px' }}>{badge.value}</div>}
                </div>
                <img src={getAvatarUrl(badge.person)} alt={badge.person.name} style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-mint)', flexShrink: 0 }} onError={avatarOnError(badge.person.name)} />
              </div>
            ))
          )}
        </div>
      )}

      {/* GROUPS */}
      {activeSection === 'groups' && (
        <div>
          {sortedGroups.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{'\u{1F465}'}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '6px' }}>No Group Data</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Create a group and add expenses to see comparisons.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sortedGroups.map((g, idx) => {
                const pct = (g.total / maxGroupTotal) * 100;
                return (
                  <div key={idx} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.92rem' }}>
                          {idx === 0 && '\u{1F3C6} '}{g.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{g.count} expenses</div>
                      </div>
                      <div style={{ fontWeight: '800', fontSize: '0.95rem', color: idx === 0 ? 'var(--accent-mint)' : 'var(--text-primary)' }}>
                        {formatCurrency(g.total, currency)}
                      </div>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, borderRadius: '4px',
                        background: idx === 0
                          ? 'linear-gradient(90deg, var(--accent-mint) 0%, rgba(16,185,129,0.6) 100%)'
                          : 'linear-gradient(90deg, #74b9ff 0%, rgba(116,185,255,0.4) 100%)',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
