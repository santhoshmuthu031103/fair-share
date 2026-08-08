import React, { useState } from 'react';
import { X, User, Phone, Mail, LogOut, Trash2, Check, Sparkles, AlertTriangle, Upload, Shuffle, Smile } from 'lucide-react';

export const AVATAR_CHARACTERS = [
  {
    id: 'alex_cool',
    name: 'Alex',
    tag: 'Cool & Confident 😎',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&mouth=smile&eyes=happy',
  },
  {
    id: 'maya_joy',
    name: 'Maya',
    tag: 'Joyful & Bright 😊',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya&mouth=smile&eyes=happy',
  },
  {
    id: 'leo_chill',
    name: 'Leo',
    tag: 'Chill Vibe 🕶️',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo&mouth=smile',
  },
  {
    id: 'sophia_chic',
    name: 'Sophia',
    tag: 'Chic & Artistic 🌸',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia&mouth=smile',
  },
  {
    id: 'rohan_smart',
    name: 'Rohan',
    tag: 'Smart & Sharp 💼',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rohan&mouth=smile&eyes=default',
  },
  {
    id: 'zara_hype',
    name: 'Zara',
    tag: 'Energetic & Hyped 🚀',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zara&mouth=smile&eyes=happy',
  },
  {
    id: 'dev_artist',
    name: 'Dev',
    tag: 'Creative Thinker 🎨',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev&mouth=smile',
  },
  {
    id: 'ananya_witty',
    name: 'Ananya',
    tag: 'Witty & Curious 💡',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya&mouth=smile&eyes=happy',
  }
];

export const ProfileModal = ({ currentUser, onClose, onUpdateProfile, onLogout, onResetData }) => {
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || AVATAR_CHARACTERS[0].url);
  const [isSaved, setIsSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdateProfile({
      ...currentUser,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      avatar,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleRollRandom = () => {
    const randomSeed = Math.random().toString(36).substring(2, 8);
    const emotions = ['smile', 'laughing', 'openSmile', 'twinkle'];
    const eyes = ['happy', 'sparkle', 'default'];
    const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
    const randomEye = eyes[Math.floor(Math.random() * eyes.length)];
    const newAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}&mouth=${randomEmotion}&eyes=${randomEye}&style=circle`;
    setAvatar(newAvatarUrl);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={22} color="var(--accent-mint)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>User Profile & Avatar</h2>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X size={18} />
          </button>
        </div>

        {/* Current Avatar & Profile Preview */}
        <div 
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ position: 'relative' }}>
            <img 
              src={avatar} 
              alt={name} 
              style={{ width: '64px', height: '64px', borderRadius: '50%', border: '3px solid var(--accent-mint)', objectFit: 'cover' }} 
            />
            <button
              type="button"
              onClick={handleRollRandom}
              title="Roll Random Character"
              style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--accent-mint)',
                color: '#fff',
                border: '2px solid #fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Shuffle size={12} />
            </button>
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '1.15rem' }}>{name || 'Your Name'}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{email || phone || 'Registered Account'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-mint)', fontWeight: '700', marginTop: '2px' }}>
              ● Tap any character below to change
            </div>
          </div>
        </div>

        {/* Character / Emotion Avatar Selection Grid */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Smile size={14} color="var(--accent-mint)" /> Choose Your Character & Emotion
            </label>
            <label
              style={{
                fontSize: '0.74rem',
                color: 'var(--accent-mint)',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Upload size={12} /> Upload Photo
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {AVATAR_CHARACTERS.map((char) => {
              const isSelected = avatar === char.url;
              return (
                <div
                  key={char.id}
                  onClick={() => setAvatar(char.url)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px 4px',
                    borderRadius: '16px',
                    background: isSelected ? 'var(--accent-mint-glow)' : 'var(--bg-input)',
                    border: isSelected ? '2px solid var(--accent-mint)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  <img 
                    src={char.url} 
                    alt={char.name} 
                    style={{ width: '44px', height: '44px', borderRadius: '50%', marginBottom: '4px' }} 
                  />
                  <span style={{ fontSize: '0.74rem', fontWeight: '800', textAlign: 'center', color: isSelected ? 'var(--accent-mint)' : 'var(--text-primary)' }}>
                    {char.name}
                  </span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.1' }}>
                    {char.tag.split(' ')[0]}
                  </span>
                  {isSelected && (
                    <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--accent-mint)', borderRadius: '50%', padding: '2px', color: '#fff' }}>
                      <Check size={10} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isSaved && (
          <div style={{ background: 'var(--accent-mint-glow)', color: 'var(--accent-mint)', padding: '10px', borderRadius: '12px', textAlign: 'center', fontWeight: '700', fontSize: '0.85rem', marginBottom: '14px' }}>
            Profile & Character Avatar saved successfully!
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <input 
              type="tel" 
              className="form-input" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button type="submit" className="btn-primary" style={{ flex: 2 }}>
              Save Character & Profile
            </button>
            {onLogout && (
              <button 
                type="button" 
                onClick={onLogout} 
                className="btn-secondary" 
                style={{ flex: 1, color: 'var(--accent-coral)' }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            )}
          </div>

          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
            {showResetConfirm ? (
              <div 
                style={{ 
                  background: 'rgba(185, 28, 28, 0.12)', 
                  border: '1px solid var(--accent-coral)', 
                  padding: '14px', 
                  borderRadius: '16px', 
                  textAlign: 'center' 
                }}
              >
                <div style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--accent-coral)', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} /> Wipe All Data & Start Fresh?
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  This will clear all expenses, groups, and settlements, and return to fresh registration.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowResetConfirm(false)} 
                    className="btn-secondary" 
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (onResetData) onResetData();
                      onClose();
                    }} 
                    className="btn-primary" 
                    style={{ flex: 1, background: 'var(--accent-coral)', color: '#fff' }}
                  >
                    Yes, Wipe Everything
                  </button>
                </div>
              </div>
            ) : (
              <button 
                type="button" 
                onClick={() => setShowResetConfirm(true)} 
                className="btn-secondary" 
                style={{ width: '100%', color: 'var(--accent-coral)', justifyContent: 'center' }}
              >
                <Trash2 size={16} /> Reset All Data / Start Fresh
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
