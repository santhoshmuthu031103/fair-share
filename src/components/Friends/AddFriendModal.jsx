import React, { useState, useEffect } from 'react';
import { X, UserPlus, Share2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { lookupCloudUser } from '../../utils/firebaseSync';
import { avatarOnError, getFallbackAvatarUrl } from '../../utils/avatarHelper';
import { APP_DOWNLOAD_URL, APP_RELEASES_URL } from '../../utils/updateChecker';

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const validateMobile = (mobile) => /^[+]?[\d\s\-().]{7,15}$/.test(mobile.trim());

export const AddFriendModal = ({ onClose, onAddFriend }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [searchedKey, setSearchedKey] = useState('');

  // Live lookup in Firebase whenever phone or email changes
  useEffect(() => {
    const query = phone.trim() || email.trim();
    if (!query || query.length < 5) {
      setFoundUser(null);
      setSearchedKey('');
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchedKey(query);
      const user = await lookupCloudUser(query);
      setIsSearching(false);
      if (user) {
        setFoundUser(user);
        if (!name.trim()) {
          setName(user.name || '');
        }
      } else {
        setFoundUser(null);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [phone, email]);

  const validate = () => {
    const e = {};
    if (!name.trim() && !foundUser) e.name = "Friend's name is required";
    if (!phone.trim() && !email.trim()) {
      e.phone = 'Enter mobile number or email to connect';
    } else {
      if (phone.trim() && !validateMobile(phone)) e.phone = 'Enter a valid mobile number';
      if (email.trim() && !validateEmail(email)) e.email = 'Enter a valid email address';
    }
    return e;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    setSubmitted(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (foundUser) {
      // Add exact registered user from Firebase
      onAddFriend({
        id: foundUser.id,
        name: foundUser.name || name.trim(),
        email: foundUser.email || email.trim(),
        phone: foundUser.phone || phone.trim(),
        avatar: foundUser.avatar || getFallbackAvatarUrl(foundUser.name || name),
        color: foundUser.color || '#9C3925',
        isVerified: true,
      });
    } else {
      // Add with entered data
      const seed = name.replace(/\s+/g, '');
      onAddFriend({
        id: `user_${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        avatar: getFallbackAvatarUrl(seed),
        color: '#9C3925',
        isVerified: false,
      });
    }
  };

  const handleInvite = () => {
    const friendPhone = phone.trim();
    const inviteText = [
      '👋 Hey! I use FairShare to split and track our shared expenses — it\'s super easy!',
      '',
      friendPhone
        ? `✨ Download the app, register with your number (${friendPhone}) and we'll link up automatically!`
        : '✨ Download the app and register with your mobile number — we\'ll link up automatically!',
    ].join('\n');

    if (navigator.share) {
      navigator.share({
        title: 'Join me on FairShare! 💸',
        text: inviteText,
        url: APP_RELEASES_URL,
      }).catch(() => {});
    } else {
      const fullMsg = inviteText + '\n\n' + APP_RELEASES_URL;
      navigator.clipboard.writeText(fullMsg)
        .then(() => alert('✅ Invite copied! Send it to your friend on WhatsApp or SMS.'))
        .catch(() => {});
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Add Friend</h2>
          <button onClick={onClose} className="icon-btn">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Mobile Number for Live Lookup */}
          <div className="form-group">
            <label className="form-label">
              Friend's Mobile Number <span style={{ color: 'var(--accent-coral)' }}>*</span>
            </label>
            <input
              type="tel"
              className="form-input"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoFocus
            />
            {submitted && errors.phone && (
              <div style={{ fontSize: '0.74rem', color: 'var(--accent-coral)', marginTop: '4px' }}>
                ⚠ {errors.phone}
              </div>
            )}
          </div>

          {/* Email Address */}
          <div className="form-group">
            <label className="form-label">Email Address (Optional)</label>
            <input
              type="email"
              className="form-input"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {submitted && errors.email && (
              <div style={{ fontSize: '0.74rem', color: 'var(--accent-coral)', marginTop: '4px' }}>
                ⚠ {errors.email}
              </div>
            )}
          </div>

          {/* Live Firebase Registration Lookup Status */}
          {isSearching && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', background: 'var(--bg-input)', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              <Loader2 size={15} className="spin" /> Checking registered FairShare users...
            </div>
          )}

          {foundUser && !isSearching && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '14px', padding: '12px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img 
                src={foundUser.avatar || getFallbackAvatarUrl(foundUser.name)} 
                alt={foundUser.name} 
                style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid #10b981', flexShrink: 0, objectFit: 'cover' }} 
                onError={avatarOnError(foundUser.name)}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', fontSize: '0.92rem', color: '#047857' }}>
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> Verified Registered User
                </div>
                <div style={{ fontWeight: '700', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{foundUser.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{foundUser.phone || foundUser.email}</div>
              </div>
            </div>
          )}

          {!foundUser && !isSearching && searchedKey && (
            <div style={{ background: 'rgba(180, 83, 9, 0.1)', border: '1px solid rgba(180, 83, 9, 0.3)', borderRadius: '14px', padding: '10px 12px', marginBottom: '14px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: 'var(--accent-amber)', marginBottom: '2px' }}>
                <AlertCircle size={14} /> No registered account found with "{searchedKey}"
              </div>
              <div>Your friend can register in FairShare with this number to auto-sync. You can still add them or invite them below.</div>
            </div>
          )}

          {/* Full Name */}
          <div className="form-group">
            <label className="form-label">
              Friend's Full Name <span style={{ color: 'var(--accent-coral)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Jordan Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {submitted && errors.name && (
              <div style={{ fontSize: '0.74rem', color: 'var(--accent-coral)', marginTop: '4px' }}>
                ⚠ {errors.name}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleInvite}
              style={{ flex: '1', height: '46px', gap: '6px', fontSize: '0.88rem' }}
            >
              <Share2 size={15} /> Invite
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: '2', height: '46px', gap: '6px', fontSize: '0.88rem' }}
            >
              <UserPlus size={15} /> {foundUser ? 'Add Verified Friend' : 'Add Friend'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
