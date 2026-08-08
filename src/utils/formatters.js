// Currency formatting helper - Default locked to INR (₹)
export const formatCurrency = (amount, currencySymbol = '₹') => {
  const absAmount = Math.abs(amount || 0).toFixed(2);
  // Add comma separators
  const parts = absAmount.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = `${currencySymbol}${parts.join('.')}`;
  
  if (amount < 0) {
    return `-${formatted}`;
  }
  return formatted;
};

// Date formatting helper
export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday`;
  }
  
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

// Expense Categories Metadata
export const CATEGORIES = {
  food: { id: 'food', label: 'Food & Drinks', color: '#ff7675', iconName: 'Utensils' },
  groceries: { id: 'groceries', label: 'Groceries', color: '#55efc4', iconName: 'ShoppingBag' },
  rent: { id: 'rent', label: 'Rent & Housing', color: '#a29bfe', iconName: 'Home' },
  utilities: { id: 'utilities', label: 'Utilities & Bills', color: '#74b9ff', iconName: 'Zap' },
  travel: { id: 'travel', label: 'Travel & Transport', color: '#ffeaa7', iconName: 'Plane' },
  entertainment: { id: 'entertainment', label: 'Entertainment', color: '#fd79a8', iconName: 'Film' },
  shopping: { id: 'shopping', label: 'Shopping', color: '#e84393', iconName: 'Tag' },
  general: { id: 'general', label: 'General / Other', color: '#b2bec3', iconName: 'Receipt' },
};

export const getCategoryMeta = (catId) => {
  return CATEGORIES[catId] || CATEGORIES.general;
};
