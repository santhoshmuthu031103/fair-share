import React, { useState } from 'react';
import { Smartphone, Mail, Lock, User, ArrowRight, Upload, Shuffle, Check, Loader2, MailCheck, LogIn } from 'lucide-react';
import { registerCloudUser, fetchCloudUserProfile, auth } from '../../utils/firebaseSync';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification 
} from 'firebase/auth';
import { avatarOnError, getFallbackAvatarUrl } from '../../utils/avatarHelper';


const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const validateMobile = (mobile) => /^[+]?[\d\s\-().]{7,15}$/.test(mobile.trim());
const LOCAL_AUTH_KEY = 'splitwise_local_auth_account';

const isFirebaseAuthUnavailable = (err) => {
  const code = err?.code || '';
  const message = err?.message || '';
  return code === 'auth/configuration-not-found' ||
    code === 'auth/operation-not-allowed' ||
    code === 'auth/network-request-failed' ||
    message.includes('CONFIGURATION_NOT_FOUND');
};

const AVATAR_CHARACTERS = [
  {
    id: 'alex_cool',
    name: 'Alex',
    tag: 'Male (Cool) 😎',
    url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Alex&mouth=smile&eyes=happy&backgroundColor=b6e3f4',
  },
  {
    id: 'leo_chill',
    name: 'Leo',
    tag: 'Male (Chill) 🕶️',
    url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Leo&mouth=smile&backgroundColor=c0aede',
  },
  {
    id: 'rohan_smart',
    name: 'Rohan',
    tag: 'Male (Smart) 💼',
    url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Rohan&mouth=smile&eyes=default&backgroundColor=d1d4f9',
  },
  {
    id: 'dev_artist',
    name: 'Dev',
    tag: 'Male (Creative) 🎨',
    url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Dev&mouth=smile&backgroundColor=ffd5dc',
  },
  {
    id: 'ryan_active',
    name: 'Ryan',
    tag: 'Male (Sporty) 🚀',
    url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Ryan&mouth=smile&backgroundColor=ffdfbf',
  },
  {
    id: 'kabir_friendly',
    name: 'Kabir',
    tag: 'Male (Warm) 😊',
    url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Kabir&mouth=smile&backgroundColor=b6e3f4',
  },
  {
    id: 'maya_joy',
    name: 'Maya',
    tag: 'Female (Joy) 🌸',
    url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Maya&mouth=smile&eyes=happy&backgroundColor=c0aede',
  },
  {
    id: 'ananya_witty',
    name: 'Ananya',
    tag: 'Female (Witty) 💡',
    url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Ananya&mouth=smile&eyes=happy&backgroundColor=d1d4f9',
  }
];

export const AuthModal = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState('SIGN_IN'); // default to SIGN_IN
  const [username, setUsername] = useState('');
  const [mobile, setMobile]     = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar]     = useState(AVATAR_CHARACTERS[0].url);
  const [errors, setErrors]     = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [pendingUser]   = useState(null);

  const validate = () => {
    const e = {};
    if (authMode === 'SIGN_UP') {
      if (!username.trim())             e.username = 'Username is required';
      if (!mobile.trim())               e.mobile   = 'Mobile number is required';
      else if (!validateMobile(mobile)) e.mobile   = 'Enter a valid mobile number';
    }
    if (!email.trim())                e.email    = 'Email is required';
    else if (!validateEmail(email))   e.email    = 'Enter a valid email address';
    if (!password.trim())             e.password = 'Password is required';
    else if (password.length < 6)     e.password = 'Password must be at least 6 characters';
    return e;
  };

  const handleRollRandom = () => {
    const randomSeed = Math.random().toString(36).substring(2, 8);
    setAvatar(getFallbackAvatarUrl(randomSeed));
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

  const buildSignupProfile = (id) => ({
    id,
    name: username.trim(),
    email: email.trim().toLowerCase(),
    phone: mobile.trim(),
    avatar: avatar || getFallbackAvatarUrl(username.trim()),
    color: '#9C3925',
  });

  const completeLogin = async (userProfile) => {
    localStorage.setItem('splitwise_is_logged_in', 'true');
    localStorage.setItem('splitwise_user_profile', JSON.stringify(userProfile));
    localStorage.setItem('splitwise_my_user_id', userProfile.id);
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify({ email: userProfile.email, profile: userProfile }));
    await registerCloudUser(userProfile);
    onLoginSuccess(userProfile);
  };

  const createLocalAccount = async () => {
    const existingLocal = localStorage.getItem('splitwise_my_user_id');
    const localId = existingLocal || `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await completeLogin(buildSignupProfile(localId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setGeneralError('');
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      if (authMode === 'SIGN_UP') {
        // Create user in Firebase Auth
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const fbUser = credential.user;

        // Send verification email best-effort. Account creation should not fail if mail delivery is blocked.
        sendEmailVerification(fbUser).catch(err => {
          console.warn('Email verification could not be sent:', err);
        });

        // Construct profile
        const userProfile = {
          id: fbUser.uid,
          name: username.trim(),
          email: email.trim().toLowerCase(),
          phone: mobile.trim(),
          avatar: avatar || getFallbackAvatarUrl(username.trim()),
          color: '#9C3925',
        };

        // Register profile metadata in RTDB
        await registerCloudUser(userProfile);

        localStorage.setItem('splitwise_is_logged_in', 'true');
        localStorage.setItem('splitwise_user_profile', JSON.stringify(userProfile));
        onLoginSuccess(userProfile);
      } else if (authMode === 'SIGN_IN') {
        // Sign in user
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const fbUser = credential.user;

        // Fetch user profile from database
        let userProfile = await fetchCloudUserProfile(fbUser.uid);
        if (!userProfile) {
          userProfile = {
            id: fbUser.uid,
            name: fbUser.displayName || email.split('@')[0],
            email: email.trim().toLowerCase(),
            phone: '',
            avatar: getFallbackAvatarUrl(fbUser.uid),
            color: '#9C3925',
          };
          await registerCloudUser(userProfile);
        }

        if (!fbUser.emailVerified) {
          sendEmailVerification(fbUser).catch(err => {
            console.warn('Email verification could not be sent:', err);
          });
        }

        localStorage.setItem('splitwise_is_logged_in', 'true');
        localStorage.setItem('splitwise_user_profile', JSON.stringify(userProfile));
        onLoginSuccess(userProfile);
      }
    } catch (err) {
      console.error(err);

      if (authMode === 'SIGN_UP' && isFirebaseAuthUnavailable(err)) {
        await createLocalAccount();
        return;
      }

      if (authMode === 'SIGN_IN' && isFirebaseAuthUnavailable(err)) {
        try {
          const localAccount = JSON.parse(localStorage.getItem(LOCAL_AUTH_KEY) || 'null');
          if (localAccount?.profile && localAccount.email === email.trim().toLowerCase()) {
            await completeLogin(localAccount.profile);
            return;
          }
        } catch (localErr) {
          console.warn('Local account lookup failed:', localErr);
        }
      }

      let msg = 'Authentication failed. Please check your credentials.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'This email address is already in use. Try signing in instead.';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = 'Incorrect email or password.';
      } else if (err.code === 'auth/invalid-credential') {
        msg = 'Invalid credentials provided.';
      } else if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/configuration-not-found') {
        msg = 'Firebase email/password sign-in is not configured. You can still create a local FairShare account on this device.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network error while contacting Firebase. Please check your connection.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please wait a minute and try again.';
      } else if (err.code) {
        msg = `Authentication failed: ${err.code}`;
      }
      setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

  const checkVerificationStatus = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setGeneralError('');
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        // Retrieve or use pending user profile
        const userProfile = pendingUser || {
          id: auth.currentUser.uid,
          name: auth.currentUser.displayName || email.split('@')[0],
          email: auth.currentUser.email,
          phone: '',
          avatar: getFallbackAvatarUrl(auth.currentUser.uid),
          color: '#9C3925',
        };
        localStorage.setItem('splitwise_is_logged_in', 'true');
        localStorage.setItem('splitwise_user_profile', JSON.stringify(userProfile));
        onLoginSuccess(userProfile);
      } else {
        setGeneralError('Email is not verified yet. Please check your inbox and click the verification link.');
      }
    } catch (err) {
      setGeneralError('Failed to refresh status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendEmail = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setGeneralError('');
    try {
      await sendEmailVerification(auth.currentUser);
      alert('Verification email resent successfully! Please check your inbox/spam folder.');
    } catch (err) {
      setGeneralError('Too many requests. Please try again later.');
    } finally {
      setLoading(false);
    }
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

  if (authMode === 'VERIFY_EMAIL') {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg-mobile-frame)',
          zIndex: 200,
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          overflowY: 'auto'
        }}
      >
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '24px 20px', width: '100%', maxWidth: '380px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ background: 'var(--accent-mint-glow)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', margin: '0 auto 16px auto', color: 'var(--accent-mint)' }}>
            <MailCheck size={32} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '8px' }}>Verify Your Email</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
            We've sent a verification link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.<br />Please click the link in that email to activate your account.
          </p>

          {generalError && (
            <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--accent-coral)', fontSize: '0.8rem', padding: '10px', borderRadius: '12px', marginBottom: '16px', fontWeight: '600' }}>
              ⚠ {generalError}
            </div>
          )}

          <button
            onClick={checkVerificationStatus}
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', height: '48px', marginBottom: '10px', gap: '8px' }}
          >
            {loading ? <Loader2 className="spin" size={18} /> : 'I have verified my email'}
          </button>

          <button
            onClick={resendEmail}
            disabled={loading}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '12px',
              height: '45px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            Resend Verification Link
          </button>

          <button
            onClick={() => {
              setAuthMode('SIGN_IN');
              setGeneralError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

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

        {generalError && (
          <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--accent-coral)', fontSize: '0.8rem', padding: '10px 14px', borderRadius: '12px', marginBottom: '14px', fontWeight: '600', textAlign: 'center' }}>
            ⚠ {generalError}
          </div>
        )}

        {authMode === 'SIGN_UP' && (
          /* Selected Avatar & Character Selection */
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '14px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img 
                  src={avatar} 
                  alt="Selected Avatar" 
                  style={{ width: '54px', height: '54px', borderRadius: '50%', border: '2px solid var(--accent-mint)', objectFit: 'cover' }} 
                  onError={avatarOnError(username || 'user')}
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '800', fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Choose Your Character Avatar</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pick an emotion or upload your photo</div>
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
                      onError={avatarOnError(char.name)}
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
        )}

        {/* Registration/Login Form */}
        <form onSubmit={handleSubmit} noValidate>
          {authMode === 'SIGN_UP' && (
            <>
              {field('username', 'Full Name / Nickname', <User size={14} color="var(--accent-mint)" />, {
                placeholder: 'e.g. Jordan Smith',
                value: username,
                onChange: (e) => setUsername(e.target.value),
              })}

              {field('mobile', 'Mobile Number (Required for Live Sync)', <Smartphone size={14} color="var(--accent-mint)" />, {
                placeholder: '+91 98765 43210',
                type: 'tel',
                inputMode: 'tel',
                value: mobile,
                onChange: (e) => setMobile(e.target.value),
              })}
            </>
          )}

          {field('email', 'Email Address', <Mail size={14} color="var(--accent-mint)" />, {
            placeholder: 'jordan@example.com',
            type: 'email',
            value: email,
            onChange: (e) => setEmail(e.target.value),
            autoFocus: authMode === 'SIGN_IN',
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
            disabled={loading}
            style={{ width: '100%', height: '50px', fontSize: '1rem', marginTop: '16px', gap: '8px' }}
          >
            {loading ? (
              <Loader2 className="spin" size={18} />
            ) : authMode === 'SIGN_UP' ? (
              <>Create My FairShare Account <ArrowRight size={18} /></>
            ) : (
              <>Sign In to My Account <LogIn size={18} /></>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'SIGN_IN' ? 'SIGN_UP' : 'SIGN_IN');
              setErrors({});
              setSubmitted(false);
              setGeneralError('');
            }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-mint)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {authMode === 'SIGN_IN' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '16px' }}>
        🔒 Local-first encryption • Real-time live sync across devices
      </div>
    </div>
  );
};
