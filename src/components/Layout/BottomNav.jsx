import React from 'react';
import { LayoutDashboard, Users, UserCheck, BarChart3, Plus } from 'lucide-react';

export const BottomNav = ({ activeTab, onTabChange, onOpenAddExpense }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'fab', label: '', icon: null }, // Center Action FAB
    { id: 'friends', label: 'Friends', icon: UserCheck },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        if (item.id === 'fab') {
          return (
            <button 
              key="fab"
              className="fab-add-btn"
              onClick={onOpenAddExpense}
              title="Add New Expense"
            >
              <Plus size={28} strokeWidth={2.5} />
            </button>
          );
        }

        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <div className="nav-icon-wrapper">
              <Icon size={20} />
            </div>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
