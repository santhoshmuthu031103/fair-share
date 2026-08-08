const STORAGE_KEY = 'splitwise_app_state_v2';
const USER_PROFILE_KEY = 'splitwise_user_profile';
const USER_ID_KEY = 'splitwise_my_user_id';

/**
 * Gets or creates the persistent unique User ID for this phone
 */
export const getMyUserId = () => {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
};

/**
 * Gets the current logged-in user profile from this device
 */
export const getMyUserProfile = () => {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) return parsed;
    }
  } catch (_) {}

  const defaultId = getMyUserId();
  const defaultProfile = {
    id: defaultId,
    name: 'You',
    email: 'you@example.com',
    phone: '+91 9876543210',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=You`,
    color: '#10b981',
  };
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(defaultProfile));
  return defaultProfile;
};

export const CURRENT_USER_ID = getMyUserId();

export const loadInitialState = () => {
  const myProfile = getMyUserProfile();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.groups) && Array.isArray(parsed.expenses)) {
        // Ensure myProfile is in friends list
        const otherFriends = (parsed.friends || []).filter(f => f.id !== myProfile.id);
        return {
          ...parsed,
          friends: [myProfile, ...otherFriends],
          activeCurrency: parsed.activeCurrency || '₹',
          isDarkMode: parsed.isDarkMode !== undefined ? parsed.isDarkMode : false,
        };
      }
    }
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
  }

  // Clean empty state for fresh phone installation
  return {
    friends: [myProfile],
    groups: [],
    expenses: [],
    settlements: [],
    activeCurrency: '₹',
    isDarkMode: false,
  };
};

export const saveStateToStorage = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
};
