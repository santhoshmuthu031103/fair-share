import React, { useState } from 'react';
import { Smartphone, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { registerCloudUser } from '../../utils/firebaseSync';

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const validateMobile = (mobile) => /^[+]?[\d\s\-().]{7,15}$/.test(mobile.trim());

export const AuthModal = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [mobile, setMobile]     = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
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
      avatar:   `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username.trim())}`,
      color:    '#10b981',
    };

    // Persist so the app never asks again
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
          style={err ? { borderColor: 'var(--accent-coral)', boxShadow: '0 0 0 2px rgba(244,63,94,0.18)' } : {}}
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
        padding: '28px 20px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflowY: 'auto',
      }}
    >
      <div>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginTop: '12px', marginBottom: '28px' }}>
          <div
            style={{
              width: '68px', height: '68px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.2rem',
              margin: '0 auto 14px auto',
              boxShadow: '0 10px 25px var(--accent-mint-glow)',
            }}
          >
            💸
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '6px' }}>
            Create Your Account
          </h1>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
            One-time setup — you'll be logged in automatically after this.
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} noValidate>
          {field('username', 'Username', <User size={13} />, {
            type: 'text',
            placeholder: 'e.g. john_doe',
            value: username,
            onChange: (e) => setUsername(e.target.value),
            autoFocus: true,
            autoComplete: 'username',
          })}

          {field('mobile', 'Mobile Number', <Smartphone size={13} />, {
            type: 'tel',
            placeholder: '+91 98765 43210',
            value: mobile,
            onChange: (e) => setMobile(e.target.value),
            inputMode: 'tel',
            autoComplete: 'tel',
          })}

          {field('email', 'Email Address', <Mail size={13} />, {
            type: 'email',
            placeholder: 'you@example.com',
            value: email,
            onChange: (e) => setEmail(e.target.value),
            autoComplete: 'email',
          })}

          {field('password', 'Password', <Lock size={13} />, {
            type: 'password',
            placeholder: '••••••••  (min 6 chars)',
            value: password,
            onChange: (e) => setPassword(e.target.value),
            autoComplete: 'new-password',
          })}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', height: '52px', fontSize: '1rem', marginTop: '12px', gap: '8px' }}
          >
            <span>Create Account & Get Started</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: '16px' }}>
        Your data is stored locally on this device only.
      </div>
    </div>
  );
};
