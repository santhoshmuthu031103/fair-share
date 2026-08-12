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
    email: '',
    phone: '',
    avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=You&mouth=smile&eyes=happy&backgroundColor=b6e3f4,c0aede&backgroundType=gradientLinear`,
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
        const otherFriends = (parsed.friends || []).filter(f => f.id !== myProfile.id);
        // Deduplicate by ID; also strip ghost "You" entries with different IDs (stale sync artifacts)
        const seenIds = new Set([myProfile.id]);
        const dedupedFriends = otherFriends.filter(f => {
          if (!f || !f.id || seenIds.has(f.id)) return false;
          // Strip any entry named "You" — only the canonical myProfile should have that label
          if (String(f.name || '').trim().toLowerCase() === 'you') return false;
          seenIds.add(f.id);
          return true;
        });
        return {
          ...parsed,
          groups: (parsed.groups || []).filter(g => g && g.name), // purge ghost/nameless groups
          friends: [myProfile, ...dedupedFriends],
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
