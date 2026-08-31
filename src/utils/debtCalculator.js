/**
 * debtCalculator.js
 * The single canonical ledger engine for FairShare.
 * All balances, debts, and settlements must be derived from this engine.
 */

/**
 * Calculates individual member breakdown for an expense based on split strategy,
 * handling penny rounding by allocating remainder to the last participant.
 */
export const calculateExpenseShares = (expense, groupMembers = []) => {
  const { amount, splitType = 'equal', splits = {}, recipientIds } = expense;
  const totalAmount = Math.round(parseFloat(amount) * 100) / 100 || 0;

  // Sort members deterministically by ID so penny rounding always lands
  // on the same person regardless of caller's array ordering.
  const sortedMembers = [...groupMembers].sort((a, b) =>
    String(a.id).localeCompare(String(b.id))
  );

  const activeMembers = recipientIds && recipientIds.length > 0
    ? sortedMembers.filter(m => recipientIds.includes(m.id))
    : sortedMembers;

  const result = {};
  if (activeMembers.length === 0) return result;
  sortedMembers.forEach(m => { result[m.id] = 0; });

  let distributed = 0;

  if (splitType === 'equal') {
    const exactShare = totalAmount / activeMembers.length;
    activeMembers.forEach((m, idx) => {
      if (idx === activeMembers.length - 1) {
        result[m.id] = Math.round((totalAmount - distributed) * 100) / 100;
      } else {
        const share = Math.round(exactShare * 100) / 100;
        result[m.id] = share;
        distributed += share;
      }
    });
  } else if (splitType === 'exact') {
    activeMembers.forEach(m => {
      result[m.id] = Math.round((parseFloat(splits[m.id]) || 0) * 100) / 100;
    });
  } else if (splitType === 'percentage') {
    activeMembers.forEach((m, idx) => {
      if (idx === activeMembers.length - 1) {
        result[m.id] = Math.round((totalAmount - distributed) * 100) / 100;
      } else {
        const pct = parseFloat(splits[m.id]) || 0;
        const share = Math.round((totalAmount * pct / 100) * 100) / 100;
        result[m.id] = share;
        distributed += share;
      }
    });
  } else if (splitType === 'shares') {
    let totalShares = 0;
    activeMembers.forEach(m => {
      totalShares += (parseFloat(splits[m.id]) || 0);
    });
    if (totalShares > 0) {
      activeMembers.forEach((m, idx) => {
        if (idx === activeMembers.length - 1) {
          result[m.id] = Math.round((totalAmount - distributed) * 100) / 100;
        } else {
          const userShares = parseFloat(splits[m.id]) || 0;
          const share = Math.round((totalAmount * userShares / totalShares) * 100) / 100;
          result[m.id] = share;
          distributed += share;
        }
      });
    }
  }

  return result;
};

/**
 * Min-Cash-Flow Greedy Debt Simplification Algorithm
 * Converts net balances into the minimum number of transactions.
 */
const simplifyDebts = (netBalances = {}, simplify = false) => {
  // When simplify=false, the caller should use getExactPairwiseDebts directly.
  // This path is only used for the simplified min-cash-flow algorithm.
  if (!simplify) return [];

  const debtors = [];
  const creditors = [];

  Object.entries(netBalances).forEach(([userId, balance]) => {
    if (balance < -0.005) {
      debtors.push({ userId, amount: -balance });
    } else if (balance > 0.005) {
      creditors.push({ userId, amount: balance });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settledAmount = Math.min(debtor.amount, creditor.amount);
    const roundedAmt = Math.round(settledAmount * 100) / 100;

    if (roundedAmt > 0) {
      transactions.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: roundedAmt,
      });
    }

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (Math.round(debtor.amount * 100) / 100 <= 0) i++;
    if (Math.round(creditor.amount * 100) / 100 <= 0) j++;
  }

  return transactions;
};

/**
 * Calculates raw, unsimplified 1-to-1 pairwise debts for a specific set of expenses/settlements.
 */
const getExactPairwiseDebts = (expenses = [], settlements = [], members = []) => {
  const activeExpenses = expenses.filter(e => !e.isDeleted);
  const activeSettlements = settlements.filter(s => !s.isDeleted);

  const matrix = {};
  members.forEach(m => {
    matrix[m.id] = {};
    members.forEach(m2 => {
      matrix[m.id][m2.id] = 0;
    });
  });

  activeExpenses.forEach(exp => {
    const shares = calculateExpenseShares(exp, members);
    const payer = exp.paidBy;

    Object.entries(shares).forEach(([userId, shareAmt]) => {
      if (userId !== payer && matrix[userId] && matrix[userId][payer] !== undefined) {
        matrix[userId][payer] += shareAmt;
      }
    });
  });

  settlements.forEach(set => {
    const amt = parseFloat(set.amount) || 0;
    if (matrix[set.payerId] && matrix[set.payerId][set.payeeId] !== undefined) {
      matrix[set.payerId][set.payeeId] -= amt;
    }
  });

  const transactions = [];
  const processed = new Set();

  members.forEach(m1 => {
    members.forEach(m2 => {
      if (m1.id !== m2.id) {
        const pairKey = [m1.id, m2.id].sort().join('-');
        if (!processed.has(pairKey)) {
          processed.add(pairKey);
          let net = matrix[m1.id][m2.id] - matrix[m2.id][m1.id];
          net = Math.round(net * 100) / 100;
          if (net > 0) {
            transactions.push({ from: m1.id, to: m2.id, amount: net });
          } else if (net < 0) {
            transactions.push({ from: m2.id, to: m1.id, amount: -net });
          }
        }
      }
    });
  });

  transactions.sort((a, b) => b.amount - a.amount);
  return transactions;
};


/**
 * THE CANONICAL LEDGER ENGINE
 * Takes all transactions and computes exact balances for global context and per-group contexts.
 */
export const buildLedger = (expenses = [], settlements = [], currentUserId, friends = [], groups = []) => {
  const activeExpenses = expenses.filter(e => !e.isDeleted);
  const activeSettlements = settlements.filter(s => !s.isDeleted);

  const ledger = {
    global: {
      netBalances: {}, // User's absolute net balance (Paid - Consumed)
      pairwiseDebts: {}, // Who owes whom globally
      totalOwes: 0,
      totalIsOwed: 0,
      totalPaid: {},
      totalConsumed: {},
      totalSettledPaid: {},
      totalSettledReceived: {}
    },
    groups: {}
  };

  // Initialize global stats
  friends.forEach(f => {
    ledger.global.netBalances[f.id] = 0;
    ledger.global.pairwiseDebts[f.id] = 0;
    ledger.global.totalPaid[f.id] = 0;
    ledger.global.totalConsumed[f.id] = 0;
    ledger.global.totalSettledPaid[f.id] = 0;
    ledger.global.totalSettledReceived[f.id] = 0;
  });

  // Group transactions by Group ID
  const groupExps = { 'non-group': [] };
  const groupSets = { 'non-group': [] };
  
  groups.forEach(g => {
    groupExps[g.id] = [];
    groupSets[g.id] = [];
    ledger.groups[g.id] = {
      netBalances: {},
      pairwiseDebts: [],
      transactions: [],
      totalOwes: 0,
      totalIsOwed: 0
    };
    (g.members || []).forEach(mId => {
      ledger.groups[g.id].netBalances[mId] = 0;
    });
  });

  activeExpenses.forEach(e => {
    const gId = e.groupId || 'non-group';
    if (!groupExps[gId]) groupExps[gId] = [];
    groupExps[gId].push(e);

    // Global Paid vs Consumed
    const shares = calculateExpenseShares(e, friends);
    const amt = parseFloat(e.amount) || 0;
    if (ledger.global.totalPaid[e.paidBy] !== undefined) {
      ledger.global.totalPaid[e.paidBy] += amt;
    }
    Object.entries(shares).forEach(([uid, share]) => {
      if (ledger.global.totalConsumed[uid] !== undefined) {
        ledger.global.totalConsumed[uid] += share;
      }
    });
  });

  activeSettlements.forEach(s => {
    const gId = s.groupId || 'non-group';
    if (!groupSets[gId]) groupSets[gId] = [];
    groupSets[gId].push(s);

    const amt = parseFloat(s.amount) || 0;
    if (ledger.global.totalSettledPaid[s.payerId] !== undefined) {
      ledger.global.totalSettledPaid[s.payerId] += amt;
    }
    if (ledger.global.totalSettledReceived[s.payeeId] !== undefined) {
      ledger.global.totalSettledReceived[s.payeeId] += amt;
    }
  });

  const globalTransactionsList = [];

  // 1. Process each group context independently
  const allGroupIds = new Set([...Object.keys(groupExps), ...Object.keys(groupSets)]);
  
  allGroupIds.forEach(gId => {
    const gExps = groupExps[gId] || [];
    const gSets = groupSets[gId] || [];
    const group = groups.find(g => g.id === gId);
    
    // Resolve members for this context
    const contextMembers = (group && group.members && group.members.length > 0)
      ? group.members.map(mId => friends.find(f => f.id === mId) || { id: mId }).filter(Boolean)
      : friends;

    // Calculate strict absolute net balances for this context
    const netBalances = {};
    contextMembers.forEach(m => { netBalances[m.id] = 0; });

    gExps.forEach(exp => {
      const amt = parseFloat(exp.amount) || 0;
      const shares = calculateExpenseShares(exp, contextMembers);
      if (netBalances[exp.paidBy] !== undefined) netBalances[exp.paidBy] += amt;
      Object.entries(shares).forEach(([uid, share]) => {
        if (netBalances[uid] !== undefined) netBalances[uid] -= share;
      });
    });

    gSets.forEach(set => {
      const amt = parseFloat(set.amount) || 0;
      if (netBalances[set.payerId] !== undefined) netBalances[set.payerId] += amt;
      if (netBalances[set.payeeId] !== undefined) netBalances[set.payeeId] -= amt;
    });

    // Rounding & applying to group ledger
    Object.keys(netBalances).forEach(id => {
      netBalances[id] = Math.round(netBalances[id] * 100) / 100;
      if (ledger.global.netBalances[id] !== undefined) {
        ledger.global.netBalances[id] += netBalances[id];
      }
    });

    let contextTransactions = [];
    // Always use exact pairwise debts to avoid simplification
    contextTransactions = getExactPairwiseDebts(gExps, gSets, contextMembers);

    globalTransactionsList.push(...contextTransactions);

    if (group) {
      ledger.groups[group.id].netBalances = netBalances;
      ledger.groups[group.id].pairwiseDebts = contextTransactions;
      
      // Calculate current user's totals for this group
      contextTransactions.forEach(tx => {
        if (tx.from === currentUserId) ledger.groups[group.id].totalOwes += tx.amount;
        if (tx.to === currentUserId) ledger.groups[group.id].totalIsOwed += tx.amount;
      });
    }
  });

  // 2. Build Global Pairwise Debts matrix
  globalTransactionsList.forEach(tx => {
    if (tx.from === currentUserId && ledger.global.pairwiseDebts[tx.to] !== undefined) {
      ledger.global.pairwiseDebts[tx.to] -= tx.amount; // You owe them
    } else if (tx.to === currentUserId && ledger.global.pairwiseDebts[tx.from] !== undefined) {
      ledger.global.pairwiseDebts[tx.from] += tx.amount; // They owe you
    }
  });

  Object.keys(ledger.global.pairwiseDebts).forEach(id => {
    const bal = Math.round(ledger.global.pairwiseDebts[id] * 100) / 100;
    ledger.global.pairwiseDebts[id] = bal;
    
    if (bal > 0) ledger.global.totalIsOwed += bal;
    if (bal < 0) ledger.global.totalOwes += Math.abs(bal);
  });

  // Round global net balances
  Object.keys(ledger.global.netBalances).forEach(id => {
    ledger.global.netBalances[id] = Math.round(ledger.global.netBalances[id] * 100) / 100;
  });

  return ledger;
};
