import { getCategoryMeta, formatDate } from './formatters';

export const exportExpensesToCSV = (expenses, groups, friends, filename = 'splitwise_expenses.csv') => {
  const getGroupName = (id) => groups.find(g => g.id === id)?.name || 'Non-group';
  const getUserName = (id) => friends.find(f => f.id === id)?.name || id;

  const headers = ['ID', 'Date', 'Group', 'Title', 'Category', 'Amount', 'Currency', 'Paid By', 'Notes'];

  const rows = expenses.map(exp => [
    exp.id,
    formatDate(exp.date),
    `"${getGroupName(exp.groupId)}"`,
    `"${(exp.title || '').replace(/"/g, '""')}"`,
    getCategoryMeta(exp.category).label,
    exp.amount,
    exp.currency || '$',
    `"${getUserName(exp.paidBy)}"`,
    `"${(exp.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
