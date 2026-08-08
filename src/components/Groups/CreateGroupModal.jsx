import React, { useState } from 'react';
import { X, Users, Check } from 'lucide-react';
import { linkGroupToUserContact, generateSyncCode } from '../../utils/firebaseSync';

const COVER_PRESETS = [
  'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
];

export const CreateGroupModal = ({ friends, currentUser, currency, onClose, onCreateGroup }) => {
  const currentUserId = currentUser?.id || friends[0]?.id;

  const [name, setName] = useState('');
  const [type, setType] = useState('Trip');
  const [coverImage, setCoverImage] = useState(COVER_PRESETS[0]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([currentUserId]);

  const toggleMember = (id) => {
    if (id === currentUserId) return; // Keep current user
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(selectedMemberIds.filter(m => m !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Ensure current user is in members list
    const finalMembers = selectedMemberIds.includes(currentUserId)
      ? selectedMemberIds
      : [currentUserId, ...selectedMemberIds];

    onCreateGroup({
      name: name.trim(),
      type,
      currency: currency || '₹',
      coverImage,
      members: finalMembers,
      simplifyDebts: true,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Create New Group</h2>
          <button onClick={onClose} className="icon-btn">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Group Name */}
          <div className="form-group">
            <label className="form-label">Group Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Goa Trip 🌴, Apartment 4B 🏠" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Group Type */}
          <div className="form-group">
            <label className="form-label">Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {['Trip', 'Home', 'Couple', 'Other'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  style={{
                    padding: '8px',
                    borderRadius: '12px',
                    border: type === t ? '2px solid var(--accent-mint)' : '1px solid var(--border-color)',
                    background: type === t ? 'var(--accent-mint-glow)' : 'var(--bg-input)',
                    color: type === t ? 'var(--accent-mint)' : 'var(--text-primary)',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Select Members */}
          <div className="form-group">
            <label className="form-label">Include Friends in Group ({selectedMemberIds.length})</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
              {friends.map(f => {
                const isSelected = selectedMemberIds.includes(f.id);
                return (
                  <div
                    key={f.id}
                    onClick={() => toggleMember(f.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      background: isSelected ? 'var(--accent-mint-glow)' : 'var(--bg-input)',
                      border: isSelected ? '1px solid var(--accent-mint)' : '1px solid var(--border-color)',
                      color: isSelected ? 'var(--accent-mint)' : 'var(--text-secondary)',
                      cursor: f.id === currentUserId ? 'default' : 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                    }}
                  >
                    <img src={f.avatar} alt={f.name} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                    <span>{f.id === currentUserId ? 'You' : f.name}</span>
                    {isSelected && <Check size={14} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            <Users size={18} /> Create Group
          </button>
        </form>
      </div>
    </div>
  );
};
