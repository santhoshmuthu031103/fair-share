/**
 * Calculates individual member breakdown for an expense based on split strategy
 * @param {Object} expense 
 * @param {Array} groupMembers 
 * @returns {Object} { userId: amountOwed }
 */
export const calculateExpenseShares = (expense, groupMembers = []) => {
  const { amount, paidBy, splitType = 'equal', splits = {}, recipientIds } = expense;
  const totalAmount = parseFloat(amount) || 0;
  
  // Filter active participants for this expense
  const activeMembers = recipientIds && recipientIds.length > 0 
    ? groupMembers.filter(m => recipientIds.includes(m.id))
    : groupMembers;

  const result = {};
  if (activeMembers.length === 0) return result;

  groupMembers.forEach(m => { result[m.id] = 0; });

  if (splitType === 'equal') {
    const share = totalAmount / activeMembers.length;
    activeMembers.forEach(m => {
      result[m.id] = Math.round(share * 100) / 100;
    });
  } else if (splitType === 'exact') {
    activeMembers.forEach(m => {
      result[m.id] = parseFloat(splits[m.id]) || 0;
    });
  } else if (splitType === 'percentage') {
    activeMembers.forEach(m => {
      const pct = parseFloat(splits[m.id]) || 0;
      result[m.id] = Math.round((totalAmount * pct / 100) * 100) / 100;
    });
  } else if (splitType === 'shares') {
    let totalShares = 0;
    activeMembers.forEach(m => {
      totalShares += (parseFloat(splits[m.id]) || 0);
    });
    if (totalShares > 0) {
      activeMembers.forEach(m => {
        const userShares = parseFloat(splits[m.id]) || 0;
        result[m.id] = Math.round((totalAmount * userShares / totalShares) * 100) / 100;
      });
    }
  }

  return result;
};

/**
 * Calculates net balance for every group member (+ owes to them, - owes to others)
 * @param {Array} expenses 
 * @param {Array} settlements 
 * @param {Array} members 
 * @returns {Object} { userId: netBalance }
 */
export const calculateNetBalances = (expenses = [], settlements = [], members = []) => {
  const balances = {};
  members.forEach(m => { balances[m.id] = 0; });

  // 1. Process Expenses
  expenses.forEach(exp => {
    const totalAmount = parseFloat(exp.amount) || 0;
    const paidBy = exp.paidBy;
    const shares = calculateExpenseShares(exp, members);

    // Payer gains the full paid amount
    if (balances[paidBy] !== undefined) {
      balances[paidBy] += totalAmount;
    }

    // Each participant owes their share
    Object.keys(shares).forEach(userId => {
      if (balances[userId] !== undefined) {
        balances[userId] -= shares[userId];
      }
    });
  });

  // 2. Process Settlements
  settlements.forEach(set => {
    const amt = parseFloat(set.amount) || 0;
    // Payer sent money -> net balance increases
    if (balances[set.payerId] !== undefined) {
      balances[set.payerId] += amt;
    }
    // Payee received money -> net balance decreases
    if (balances[set.payeeId] !== undefined) {
      balances[set.payeeId] -= amt;
    }
  });

  // Clean up floating point precision issues
  Object.keys(balances).forEach(id => {
    balances[id] = Math.round(balances[id] * 100) / 100;
    if (Math.abs(balances[id]) < 0.001) balances[id] = 0;
  });

  return balances;
};

/**
 * Min-Cash-Flow Greedy Debt Simplification Algorithm
 * @param {Object} netBalances { userId: netBalance }
 * @returns {Array} List of simplified transactions [{ from, to, amount }]
 */
export const simplifyDebts = (netBalances = {}) => {
  const debtors = [];  // people who owe money (netBalance < 0)
  const creditors = []; // people who are owed money (netBalance > 0)

  Object.entries(netBalances).forEach(([userId, balance]) => {
    if (balance < -0.01) {
      debtors.push({ userId, amount: -balance });
    } else if (balance > 0.01) {
      creditors.push({ userId, amount: balance });
    }
  });

  // Sort descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];

  let i = 0; // debtor index
  let j = 0; // creditor index

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

    if (Math.round(debtor.amount * 100) / 100 <= 0) {
      i++;
    }
    if (Math.round(creditor.amount * 100) / 100 <= 0) {
      j++;
    }
  }

  return transactions;
};

/**
 * Get detailed pairwise balances between current user and all friends
 */
export const getPairwiseBalances = (expenses = [], settlements = [], currentUserId, friends = []) => {
  const matrix = {};
  friends.forEach(f => {
    if (f.id !== currentUserId) {
      matrix[f.id] = 0;
    }
  });

  // For each expense, calculate who owes whom
  expenses.forEach(exp => {
    const shares = calculateExpenseShares(exp, friends);
    const payer = exp.paidBy;
    const totalAmount = parseFloat(exp.amount) || 0;

    if (payer === currentUserId) {
      // Current user paid -> other members owe current user their shares
      Object.entries(shares).forEach(([userId, shareAmt]) => {
        if (userId !== currentUserId && matrix[userId] !== undefined) {
          matrix[userId] += shareAmt;
        }
      });
    } else if (matrix[payer] !== undefined) {
      // Someone else paid -> current user owes payer current user's share
      const currentUserShare = shares[currentUserId] || 0;
      matrix[payer] -= currentUserShare;
    }
  });

  // For settlements
  settlements.forEach(set => {
    const amt = parseFloat(set.amount) || 0;
    if (set.payerId === currentUserId && matrix[set.payeeId] !== undefined) {
      // Current user paid friend -> user owes less to friend / friend owes more
      matrix[set.payeeId] += amt;
    } else if (set.payeeId === currentUserId && matrix[set.payerId] !== undefined) {
      // Friend paid current user -> friend owes less / user owes more
      matrix[set.payerId] -= amt;
    }
  });

  Object.keys(matrix).forEach(id => {
    matrix[id] = Math.round(matrix[id] * 100) / 100;
  });

  return matrix;
};
