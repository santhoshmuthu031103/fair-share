import React from 'react';
import { CATEGORIES, getCategoryMeta, formatCurrency } from '../../utils/formatters';
import { TrendingUp } from 'lucide-react';

export const AnalyticsView = ({ expenses, groups, friends, currency }) => {
  const totalSpend = expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);

  // Category totals breakdown
  const categoryTotals = {};
  Object.keys(CATEGORIES).forEach(cId => { categoryTotals[cId] = 0; });

  expenses.forEach(e => {
    const cat = e.category || 'general';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(e.amount) || 0);
  });

  const sortedCategories = Object.entries(categoryTotals)
    .filter(([_, amt]) => amt > 0)
    .sort((a, b) => b[1] - a[1]);

  // Payer breakdown
  const payerTotals = {};
  friends.forEach(f => { payerTotals[f.id] = 0; });
  expenses.forEach(e => {
    if (payerTotals[e.paidBy] !== undefined) {
      payerTotals[e.paidBy] += (parseFloat(e.amount) || 0);
    }
  });

  const sortedPayers = Object.entries(payerTotals)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Spending Analytics</h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Breakdown by categories and members</p>
      </div>

      {/* Hero Stat Box */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Total Expenses Processed
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '800', fontFamily: 'var(--font-heading)', margin: '4px 0 10px 0', color: '#fff' }}>
          {formatCurrency(totalSpend, currency)}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <TrendingUp size={14} color="var(--accent-mint)" /> Across {expenses.length} recorded transactions
        </div>
      </div>

      {/* Category Breakdown Progress Bars */}
      <div className="card" style={{ marginBottom: '14px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '14px' }}>
          Category Spending
        </h3>

        {sortedCategories.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No expenses recorded yet.</div>
        ) : (
          sortedCategories.map(([catId, amt]) => {
            const catMeta = getCategoryMeta(catId);
            const pct = totalSpend > 0 ? (amt / totalSpend) * 100 : 0;

            return (
              <div key={catId} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{catMeta.label}</span>
                  <span style={{ fontWeight: '700' }}>
                    {formatCurrency(amt, currency)} ({pct.toFixed(1)}%)
                  </span>
                </div>

                <div 
                  style={{
                    height: '8px',
                    width: '100%',
                    background: 'var(--bg-input)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div 
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: catMeta.color,
                      borderRadius: '4px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Top Spenders Breakdown */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '14px' }}>
          Top Spenders (Total Paid Upfront)
        </h3>

        {sortedPayers.map(([uId, totalPaid], idx) => {
          const friend = friends.find(f => f.id === uId);
          if (!friend) return null;
          const pct = totalSpend > 0 ? (totalPaid / totalSpend) * 100 : 0;

          return (
            <div key={uId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < sortedPayers.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={friend.avatar} alt={friend.name} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '700' }}>
                    {friend.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {pct.toFixed(1)}% of total pool
                  </div>
                </div>
              </div>

              <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>
                {formatCurrency(totalPaid, currency)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
