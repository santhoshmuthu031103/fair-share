/**
 * Avatar utility helpers
 * Provides consistent fallback handling for user avatars throughout the app.
 */

/**
 * Returns the best avatar URL for a user object.
 * Falls back to a DiceBear generated avatar using the user's name/id as seed.
 */
export const getAvatarUrl = (user) => {
  if (!user) return getFallbackAvatarUrl('unknown');
  if (user.avatar && user.avatar.trim()) return user.avatar.trim();
  return getFallbackAvatarUrl(user.name || user.id || 'user');
};

/**
 * Generates a deterministic DiceBear avatar URL from a seed string.
 */
export const getFallbackAvatarUrl = (seed) => {
  const safe = encodeURIComponent(String(seed || 'user').trim() || 'user');
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${safe}&mouth=smile&eyes=happy&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&backgroundType=gradientLinear`;
};

/**
 * Handles img onerror — replaces broken image src with a generated fallback.
 * Usage: <img onError={avatarOnError(name)} ... />
 */
export const avatarOnError = (seed) => (e) => {
  const safe = encodeURIComponent(String(seed || 'user').trim() || 'user');
  // Avoid infinite loop if fallback itself fails
  e.target.onerror = null;
  e.target.src = `https://api.dicebear.com/9.x/avataaars/svg?seed=${safe}&mouth=smile&backgroundColor=b6e3f4,c0aede&backgroundType=solid`;
};
