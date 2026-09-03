/**
 * chatTracker.js
 * Tracks unread chat messages per group using timestamps.
 * Dispatches local events so GroupCard, GroupDetail, and headers update instantly.
 */

const STORAGE_PREFIX = 'fairshare_chat_last_read_';

export const getLastReadTimestamp = (syncCode) => {
  if (!syncCode) return 0;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${syncCode.toUpperCase()}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch (_) {
    return 0;
  }
};

export const markGroupChatAsRead = (syncCode) => {
  if (!syncCode) return;
  const now = Date.now();
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${syncCode.toUpperCase()}`, now.toString());
  } catch (_) {}

  // Notify active components in memory
  try {
    window.dispatchEvent(new CustomEvent('fairshare_chat_read', { detail: { syncCode: syncCode.toUpperCase(), timestamp: now } }));
  } catch (_) {}
};
