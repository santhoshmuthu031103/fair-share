import React, { useState } from 'react';
import { Smartphone, Mail, Lock, User, ArrowRight, Upload, Shuffle, Smile, Check } from 'lucide-react';
import { registerCloudUser } from '../../utils/firebaseSync';

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const validateMobile = (mobile) => /^[+]?[\d\s\-().]{7,15}$/.test(mobile.trim());

const AVATAR_CHARACTERS = [
  {
    id: 'alex_cool',
    name: 'Alex',
    tag: 'Cool & Confident 😎',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&mouth=smile&eyes=happy&style=circle',
  },
  {
    id: 'maya_joy',
    name: 'Maya',
    tag: 'Joyful & Bright 😊',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya&mouth=laughing&eyes=happy&style=circle',
  },
  {
    id: 'leo_chill',
    name: 'Leo',
    tag: 'Chill Vibe 🕶️',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo&accessories=sunglasses&mouth=smile&style=circle',
  },
  {
    id: 'sophia_chic',
    name: 'Sophia',
    tag: 'Chic & Artistic 🌸',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia&hairColor=auburn&mouth=smile&style=circle',
  },
  {
    id: 'rohan_smart',
    name: 'Rohan',
    tag: 'Smart & Sharp 💼',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rohan&mouth=smile&eyes=default&style=circle',
  },
  {
    id: 'zara_hype',
    name: 'Zara',
    tag: 'Energetic & Hyped 🚀',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zara&mouth=openSmile&eyes=sparkle&style=circle',
  },
  {
    id: 'dev_artist',
    name: 'Dev',
    tag: 'Creative Thinker 🎨',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev&facialHair=magnum&mouth=smile&style=circle',
  },
  {
    id: 'ananya_witty',
    name: 'Ananya',
    tag: 'Witty & Curious 💡',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya&mouth=twinkle&eyes=happy&style=circle',
  }
];

export const AuthModal = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [mobile, setMobile]     = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar]     = useState(AVATAR_CHARACTERS[0].url);
  const [errors, setErrors]     = useState({});
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const e = {};
    if (!username.trim())             e.username = 'Username is required';
    if (!mobile.trim())               e.mobile   = 'Mobile number is required';
    else if (!validateMobile(mobile)) e.mobile   = 'Enter a valid mobile number';
    if (!email.trim())                e.email    = 'Email is required';
    else if (!validateEmail(email))   e.email    = 'Enter a valid email address';
    if (!password.trim())             e.password = 'Password is required';
    else if (password.length < 6)     e.password = 'Password must be at least 6 characters';
    return e;
  };

  const handleRollRandom = () => {
    const randomSeed = Math.random().toString(36).substring(2, 8);
    const emotions = ['smile', 'laughing', 'openSmile', 'twinkle'];
    const eyes = ['happy', 'sparkle', 'default'];
    const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
    const randomEye = eyes[Math.floor(Math.random() * eyes.length)];
    setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}&mouth=${randomEmotion}&eyes=${randomEye}&style=circle`);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const userProfile = {
      id:       `user_${Date.now()}`,
      name:     username.trim(),
      email:    email.trim(),
      phone:    mobile.trim(),
      avatar:   avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username.trim())}`,
      color:    '#9C3925',
    };

    // Persist locally
    localStorage.setItem('splitwise_is_logged_in', 'true');
    localStorage.setItem('splitwise_user_profile', JSON.stringify(userProfile));
    
    // Register in Firebase cloud for friend lookups and live group invites
    try {
      registerCloudUser(userProfile);
    } catch (_) {}

    onLoginSuccess(userProfile);
  };

  const field = (key, label, icon, props) => {
    const err = submitted && errors[key];
    return (
      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {icon} {label}
        </label>
        <input
          className="form-input"
          style={err ? { borderColor: 'var(--accent-coral)', boxShadow: '0 0 0 2px rgba(185,28,28,0.18)' } : {}}
          {...props}
        />
        {err && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-coral)', marginTop: '4px' }}>
            ⚠ {err}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'var(--bg-mobile-frame)',
        zIndex: 200,
        padding: '24px 20px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflowY: 'auto',
      }}
    >
      <div>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginTop: '8px', marginBottom: '20px' }}>
          <img 
            src="/favicon.svg" 
            alt="FairShare Logo" 
            style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '20px', 
              margin: '0 auto 12px auto', 
              display: 'block', 
              boxShadow: '0 10px 25px var(--accent-mint-glow)' 
            }} 
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '4px' }}>
            FairShare
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Smart expense splitting with instant live sync
          </p>
        </div>

        {/* Selected Avatar & Character Selection */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ position: 'relative' }}>
              <img 
                src={avatar} 
                alt="Selected Avatar" 
                style={{ width: '54px', height: '54px', borderRadius: '50%', border: '2px solid var(--accent-mint)', objectFit: 'cover' }} 
              />
              <button
                type="button"
                onClick={handleRollRandom}
                title="Roll Random Character"
                style={{
                  position: 'absolute',
                  bottom: '-3px',
                  right: '-3px',
                  width: '22px',
                  height: '22px',
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
                <Shuffle size={11} />
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '800', fontSize: '0.92rem' }}>Choose Your Character Avatar</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Pick an emotion or upload your photo</div>
            </div>
            <label
              style={{
                fontSize: '0.72rem',
                color: 'var(--accent-mint)',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '5px 8px',
                borderRadius: '8px',
                background: 'var(--accent-mint-glow)',
              }}
            >
              <Upload size={12} /> Upload
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
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
                    padding: '6px 2px',
                    borderRadius: '12px',
                    background: isSelected ? 'var(--accent-mint-glow)' : 'var(--bg-input)',
                    border: isSelected ? '2px solid var(--accent-mint)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <img 
                    src={char.url} 
                    alt={char.name} 
                    style={{ width: '38px', height: '38px', borderRadius: '50%', marginBottom: '2px' }} 
                  />
                  <span style={{ fontSize: '0.68rem', fontWeight: '800', textAlign: 'center', color: isSelected ? 'var(--accent-mint)' : 'var(--text-primary)' }}>
                    {char.name}
                  </span>
                  {isSelected && (
                    <div style={{ position: 'absolute', top: '2px', right: '2px', background: 'var(--accent-mint)', borderRadius: '50%', padding: '1px', color: '#fff' }}>
                      <Check size={8} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} noValidate>
          {field('username', 'Full Name / Nickname', <User size={14} color="var(--accent-mint)" />, {
            placeholder: 'e.g. Jordan Smith',
            value: username,
            onChange: (e) => setUsername(e.target.value),
            autoFocus: true,
          })}

          {field('mobile', 'Mobile Number (Required for Live Sync)', <Smartphone size={14} color="var(--accent-mint)" />, {
            placeholder: '+91 98765 43210',
            type: 'tel',
            inputMode: 'tel',
            value: mobile,
            onChange: (e) => setMobile(e.target.value),
          })}

          {field('email', 'Email Address', <Mail size={14} color="var(--accent-mint)" />, {
            placeholder: 'jordan@example.com',
            type: 'email',
            value: email,
            onChange: (e) => setEmail(e.target.value),
          })}

          {field('password', 'Security Password (min 6 chars)', <Lock size={14} color="var(--accent-mint)" />, {
            placeholder: '••••••••',
            type: 'password',
            value: password,
            onChange: (e) => setPassword(e.target.value),
          })}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', height: '50px', fontSize: '1rem', marginTop: '16px', gap: '8px' }}
          >
            Create My FairShare Account <ArrowRight size={18} />
          </button>
        </form>
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '16px' }}>
        🔒 Local-first encryption • Real-time live sync across devices
      </div>
    </div>
  );
};
