import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, set, get, remove, push } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Real Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyAo0QBZk1tuIa6XIvwB1L2Bv1jlzTGZBzc",
  authDomain: "split-app-60045.firebaseapp.com",
  databaseURL: "https://split-app-60045-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "split-app-60045",
  storageBucket: "split-app-60045.firebasestorage.app",
  messagingSenderId: "594086142199",
  appId: "1:594086142199:web:0734b00e8344a41cd4f3f2"
};

let db = null;
let auth = null;

try {
  const existingApps = getApps();
  const app = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);
  db = getDatabase(app);
  auth = getAuth(app);

  // Automatically authenticate app users securely in the background
  if (auth) {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch((err) => {
          console.warn('Background auth initialization:', err?.message);
        });
      }
    });
  }
} catch (err) {
  console.warn('Firebase init error:', err);
}

export { auth };

/**
 * Sanitize phone number or email for use as a Firebase Realtime Database path key
 */
export const sanitizeKey = (key) => {
  if (!key) return '';
  return String(key)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
};

/**
 * Generate a human-readable 6-char sync code from a group id
 */
export const generateSyncCode = (groupId) => {
  if (!groupId) return 'SPLIT1';
  return groupId.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase().padStart(6, '0');
};

/**
 * Register a user profile in Firebase cloud so other friends can search & add them by phone/email!
 */
export const registerCloudUser = (userProfile) => {
  if (!db || !userProfile) return;
  const payload = {
    id: userProfile.id,
    name: userProfile.name,
    phone: userProfile.phone || '',
    email: userProfile.email || '',
    avatar: userProfile.avatar || '',
    color: userProfile.color || '#9C3925',
    registeredAt: new Date().toISOString(),
  };

  if (userProfile.phone) {
    const sPhone = sanitizeKey(userProfile.phone);
    if (sPhone) {
      set(ref(db, `registered_users/${sPhone}`), payload).catch(e => console.warn('registerUser phone error:', e));
    }
  }
  if (userProfile.email) {
    const sEmail = sanitizeKey(userProfile.email);
    if (sEmail) {
      set(ref(db, `registered_users/${sEmail}`), payload).catch(e => console.warn('registerUser email error:', e));
    }
  }
  if (userProfile.id) {
    set(ref(db, `users/${userProfile.id}`), payload).catch(e => console.warn('registerUser id error:', e));
  }
};

/**
 * Look up a registered user in Firebase cloud by their phone or email.
 * Returns the registered user profile object or null.
 */
export const lookupCloudUser = async (phoneOrEmail) => {
  if (!db || !phoneOrEmail) return null;
  const sKey = sanitizeKey(phoneOrEmail);
  if (!sKey) return null;

  try {
    const snapshot = await get(ref(db, `registered_users/${sKey}`));
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (err) {
    console.warn('lookupCloudUser error:', err);
    return null;
  }
};

/**
 * Look up a registered user in Firebase cloud by their unique auth UID.
 */
export const fetchCloudUserProfile = async (uid) => {
  if (!db || !uid) return null;
  try {
    const snapshot = await get(ref(db, `users/${uid}`));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (err) {
    console.warn('fetchCloudUserProfile error:', err);
    return null;
  }
};

/**
 * Subscribe to realtime profile updates for a friend (by id, phone, or email).
 * Returns an unsubscribe function.
 */
export const listenForUserProfile = (user, onProfileUpdate) => {
  if (!db || !user) return () => {};
  const unsubs = [];

  const handleSnapshot = (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      if (val && (val.avatar || val.name)) {
        onProfileUpdate(val);
      }
    }
  };

  if (user.id) {
    const uRef = ref(db, `users/${user.id}`);
    unsubs.push(onValue(uRef, handleSnapshot));
  }
  if (user.phone) {
    const sPhone = sanitizeKey(user.phone);
    if (sPhone) {
      const pRef = ref(db, `registered_users/${sPhone}`);
      unsubs.push(onValue(pRef, handleSnapshot));
    }
  }
  if (user.email) {
    const sEmail = sanitizeKey(user.email);
    if (sEmail) {
      const eRef = ref(db, `registered_users/${sEmail}`);
      unsubs.push(onValue(eRef, handleSnapshot));
    }
  }

  return () => {
    unsubs.forEach(unsub => unsub && unsub());
  };
};

/**
 * Link a group to a member's phone and email in Firebase
 * so the group is automatically discovered on their device!
 */
export const linkGroupToUserContact = (contactKey, syncCode) => {
  if (!db || !contactKey || !syncCode) return;
  const sKey = sanitizeKey(contactKey);
  if (!sKey) return;
  const code = syncCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const userGroupRef = ref(db, `user_groups/${sKey}/${code}`);
  set(userGroupRef, true).catch(err => console.warn('linkGroup error:', err));
};

/**
 * Unlink a group from a member's phone/email in Firebase.
 * Call this when a user leaves or is removed from a group so that
 * the auto-discover listener does NOT re-join them automatically.
 */
export const unlinkGroupFromUserContact = (contactKey, syncCode) => {
  if (!db || !contactKey || !syncCode) return;
  const sKey = sanitizeKey(contactKey);
  if (!sKey) return;
  const code = syncCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const userGroupRef = ref(db, `user_groups/${sKey}/${code}`);
  remove(userGroupRef).catch(err => console.warn('unlinkGroup error:', err));
};

/**
 * Auto-discover groups for the logged-in user by their phone, email, or user ID
 */
export const listenForUserGroups = (phone, email, onGroupCodeDiscovered, userId) => {
  if (!db) return () => {};
  const unsubs = [];

  const checkKey = (rawKey) => {
    const sKey = sanitizeKey(rawKey);
    if (!sKey) return;
    const userGroupsRef = ref(db, `user_groups/${sKey}`);
    const unsub = onValue(userGroupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(syncCode => {
          onGroupCodeDiscovered(syncCode);
        });
      }
    });
    unsubs.push(unsub);
  };

  if (phone) checkKey(phone);
  if (email) checkKey(email);
  if (userId) checkKey(userId); // Also discover via user ID

  return () => {
    unsubs.forEach(unsub => unsub && unsub());
  };
};

/**
 * Subscribe to live updates from the cloud for this sync code.
 * Returns an unsubscribe function.
 */
export const subscribeToCloudGroup = (syncCode, onDataUpdate) => {
  if (!db || !syncCode) return () => {};
  const cleanCode = syncCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const groupRef = ref(db, `groups/${cleanCode}`);

  const unsubscribe = onValue(groupRef, (snapshot) => {
    const data = snapshot.val();
    if (data) onDataUpdate(data);
  });

  return unsubscribe;
};

/**
 * Publish group state to Firebase under the sync code key.
 */
export const publishToCloudGroup = (syncCode, groupData) => {
  if (!db || !syncCode) return;
  const cleanCode = syncCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const groupRef = ref(db, `groups/${cleanCode}`);
  set(groupRef, { 
    syncCode: cleanCode,
    ...groupData, 
    lastUpdated: new Date().toISOString() 
  }).catch((err) => console.warn('Publish error:', err));
};

/**
 * Delete group in Firebase cloud so all members' devices delete it in real-time.
 */
export const deleteCloudGroup = (syncCode) => {
  if (!db || !syncCode) return;
  const cleanCode = syncCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const groupRef = ref(db, `groups/${cleanCode}`);
  set(groupRef, { 
    syncCode: cleanCode,
    deleted: true, 
    group: {
      id: cleanCode,
      syncCode: cleanCode,
      name: 'Deleted Group',
      deleted: true
    },
    lastUpdated: new Date().toISOString() 
  }).catch((err) => console.warn('Delete cloud group error:', err));
};

/**
 * Get all possible routing keys for a user (ID, sanitized phone, sanitized email)
 */
export const getUserContactKeys = (user) => {
  if (!user) return [];
  const keys = new Set();
  if (user.id) keys.add(`uid_${user.id}`);
  if (user.phone) {
    const sPhone = sanitizeKey(user.phone);
    if (sPhone) keys.add(`phone_${sPhone}`);
  }
  if (user.email) {
    const sEmail = sanitizeKey(user.email);
    if (sEmail) keys.add(`email_${sEmail}`);
  }
  return Array.from(keys);
};

/**
 * Publish a direct (non-group) expense to all involved participants' cloud mailboxes
 */
export const publishDirectExpense = (expense, participants = [], authorProfile = null) => {
  if (!db || !expense || !expense.id) return;

  const payload = {
    expense,
    members: participants,
    authorProfile: authorProfile || null,
    lastUpdated: new Date().toISOString(),
  };

  // Collect all destination routing keys across all participants
  const targetKeys = new Set();
  participants.forEach(user => {
    getUserContactKeys(user).forEach(k => targetKeys.add(k));
  });
  if (authorProfile) {
    getUserContactKeys(authorProfile).forEach(k => targetKeys.add(k));
  }

  targetKeys.forEach(userKey => {
    const expRef = ref(db, `direct_expenses/${userKey}/${expense.id}`);
    set(expRef, payload).catch(err => console.warn('publishDirectExpense error:', err));
  });
};

/**
 * Delete a direct (non-group) expense in Firebase across all participants
 */
export const deleteDirectExpense = (expenseId, participants = []) => {
  if (!db || !expenseId) return;

  const payload = {
    id: expenseId,
    deleted: true,
    lastUpdated: new Date().toISOString(),
  };

  const targetKeys = new Set();
  participants.forEach(user => {
    getUserContactKeys(user).forEach(k => targetKeys.add(k));
  });

  targetKeys.forEach(userKey => {
    const expRef = ref(db, `direct_expenses/${userKey}/${expenseId}`);
    set(expRef, payload).catch(err => console.warn('deleteDirectExpense error:', err));
  });
};

/**
 * Publish a direct (non-group) settlement to all involved participants' cloud mailboxes
 */
export const publishDirectSettlement = (settlement, participants = [], authorProfile = null) => {
  if (!db || !settlement || !settlement.id) return;

  const payload = {
    settlement,
    members: participants,
    authorProfile: authorProfile || null,
    lastUpdated: new Date().toISOString(),
  };

  const targetKeys = new Set();
  participants.forEach(user => {
    getUserContactKeys(user).forEach(k => targetKeys.add(k));
  });
  if (authorProfile) {
    getUserContactKeys(authorProfile).forEach(k => targetKeys.add(k));
  }

  targetKeys.forEach(userKey => {
    const setRef = ref(db, `direct_settlements/${userKey}/${settlement.id}`);
    set(setRef, payload).catch(err => console.warn('publishDirectSettlement error:', err));
  });
};

/**
 * Delete a direct (non-group) settlement in Firebase across all participants
 */
export const deleteDirectSettlement = (settlementId, participants = []) => {
  if (!db || !settlementId) return;

  const payload = {
    id: settlementId,
    deleted: true,
    lastUpdated: new Date().toISOString(),
  };

  const targetKeys = new Set();
  participants.forEach(user => {
    getUserContactKeys(user).forEach(k => targetKeys.add(k));
  });

  targetKeys.forEach(userKey => {
    const setRef = ref(db, `direct_settlements/${userKey}/${settlementId}`);
    set(setRef, payload).catch(err => console.warn('deleteDirectSettlement error:', err));
  });
};

/**
 * Subscribe to realtime direct expenses addressed to the current logged-in user
 */
export const listenForDirectExpenses = (user, onExpenseData) => {
  if (!db || !user) return () => {};

  const keys = getUserContactKeys(user);
  if (keys.length === 0) return () => {};

  const unsubs = [];

  keys.forEach(userKey => {
    const userExpensesRef = ref(db, `direct_expenses/${userKey}`);
    const unsub = onValue(userExpensesRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        Object.values(data).forEach(expensePayload => {
          if (expensePayload) {
            onExpenseData(expensePayload);
          }
        });
      }
    });
    unsubs.push(unsub);
  });

  return () => {
    unsubs.forEach(unsub => unsub && unsub());
  };
};

/**
 * Subscribe to realtime direct settlements addressed to the current logged-in user
 */
export const listenForDirectSettlements = (user, onSettlementData) => {
  if (!db || !user) return () => {};

  const keys = getUserContactKeys(user);
  if (keys.length === 0) return () => {};

  const unsubs = [];

  keys.forEach(userKey => {
    const userSettlementsRef = ref(db, `direct_settlements/${userKey}`);
    const unsub = onValue(userSettlementsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        Object.values(data).forEach(settlementPayload => {
          if (settlementPayload) {
            onSettlementData(settlementPayload);
          }
        });
      }
    });
    unsubs.push(unsub);
  });

  return () => {
    unsubs.forEach(unsub => unsub && unsub());
  };
};

/**
 * One-time fetch to check if a sync code exists in Firebase.
 * Returns the cloud data or null.
 */
export const fetchCloudGroup = async (syncCode) => {
  if (!db || !syncCode) return null;
  const cleanCode = syncCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  try {
    const snapshot = await get(ref(db, `groups/${cleanCode}`));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (err) {
    console.warn('Fetch error:', err);
    return null;
  }
};
/**
 * Save this device's FCM push token to Firebase so Cloud Functions can notify it.
 * Called once on login and whenever the token refreshes.
 */
export const saveFCMToken = (userId, token) => {
  if (!db || !userId || !token) return;
  const tokenRef = ref(db, `fcm_tokens/${userId}`);
  set(tokenRef, {
    token,
    updatedAt: new Date().toISOString(),
  }).catch(err => console.warn('saveFCMToken error:', err));
};

/**
 * Fetch FCM tokens for a list of user IDs.
 * Used as a fallback reference; token lookup is primarily done in the Cloudflare Worker.
 * Returns an array of token strings.
 */
export const getGroupMemberFCMTokens = async (userIds = []) => {
  if (!db || !userIds.length) return [];
  const tokens = [];
  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const snap = await get(ref(db, `fcm_tokens/${uid}`));
        if (snap.exists()) {
          const val = snap.val();
          if (val?.token) tokens.push(val.token);
        }
      } catch (e) {
        console.warn('getGroupMemberFCMTokens error:', e);
      }
    })
  );
  return tokens;
};

/**
 * Send a push notification to group members via the Cloudflare Worker.
 * The Worker reads FCM tokens and calls FCM API server-side.
 *
 * CLOUDFLARE_WORKER_URL and NOTIFY_SECRET are set in src/utils/notifyConfig.js
 * (you fill these in after deploying the Cloudflare Worker)
 *
 * action: 'expense_added' | 'settlement_added' | 'expense_deleted'
 */
export const triggerNotification = async (payload) => {
  // Import config lazily to avoid circular deps
  let workerUrl, notifySecret;
  try {
    const cfg = await import('./notifyConfig.js');
    workerUrl = cfg.CLOUDFLARE_WORKER_URL;
    notifySecret = cfg.NOTIFY_SECRET;
  } catch {
    console.warn('notifyConfig.js not found — push notifications disabled');
    return;
  }

  if (!workerUrl || workerUrl === 'PASTE_YOUR_WORKER_URL_HERE') {
    console.info('Cloudflare Worker URL not configured yet. Skipping push notification.');
    return;
  }

  try {
    // 🚀 Directly retrieve member FCM tokens using authenticated Firebase client
    let directTokens = [];
    if (Array.isArray(payload.memberIds) && payload.memberIds.length > 0) {
      directTokens = await getGroupMemberFCMTokens(payload.memberIds);
    }

    await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...payload, 
        tokens: directTokens, 
        secret: notifySecret 
      }),
    });
  } catch (err) {
    // Non-critical — notification failure should never break the main app flow
    console.warn('triggerNotification error:', err.message);
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 * GROUP CHAT REAL-TIME ENGINE
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Send a chat message or nudge to a group in real-time
 */
export const sendGroupChatMessage = async (syncCode, message) => {
  if (!db || !syncCode) return null;
  const cleanCode = syncCode.toUpperCase().trim();
  const messagesRef = ref(db, `group_chats/${cleanCode}/messages`);
  const newMsgRef = push(messagesRef);

  const payload = {
    id: newMsgRef.key,
    senderId: message.senderId || 'anon',
    senderName: message.senderName || 'Anonymous',
    senderAvatar: message.senderAvatar || null,
    text: message.text || '',
    type: message.type || 'text', // 'text' | 'nudge' | 'expense_alert'
    timestamp: Date.now(),
    reactions: {},
    meta: message.meta || null, // e.g. amount, expenseId
  };

  try {
    await set(newMsgRef, payload);

    // Update lightweight lastMessage node for real-time unread dot indicators
    const lastMsgRef = ref(db, `group_chats/${cleanCode}/lastMessage`);
    set(lastMsgRef, {
      id: payload.id,
      senderId: payload.senderId,
      senderName: payload.senderName,
      text: payload.text,
      type: payload.type,
      timestamp: payload.timestamp,
    }).catch(() => {});

    return payload;
  } catch (err) {
    console.error('sendGroupChatMessage error:', err);
    throw err;
  }
};

/**
 * Subscribe to lightweight last message updates for a group (for unread notification dots)
 */
export const subscribeGroupChatLastMessage = (syncCode, onUpdate) => {
  if (!db || !syncCode) return () => {};
  const cleanCode = syncCode.toUpperCase().trim();
  const lastMsgRef = ref(db, `group_chats/${cleanCode}/lastMessage`);

  return onValue(lastMsgRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.val());
    } else {
      onUpdate(null);
    }
  });
};

/**
 * Subscribe to real-time chat messages for a group
 * Returns an unsubscribe function.
 */
export const subscribeGroupChat = (syncCode, onUpdate) => {
  if (!db || !syncCode) return () => {};
  const cleanCode = syncCode.toUpperCase().trim();
  const chatRef = ref(db, `group_chats/${cleanCode}/messages`);

  const unsubscribe = onValue(
    chatRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate([]);
        return;
      }
      const data = snapshot.val();
      const messageList = Object.values(data).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      onUpdate(messageList);
    },
    (err) => {
      console.warn('subscribeGroupChat error:', err);
    }
  );

  return () => {
    try {
      unsubscribe();
    } catch (_) {}
  };
};

/**
 * Toggle an emoji reaction on a message
 */
export const toggleChatMessageReaction = async (syncCode, messageId, emoji, userId) => {
  if (!db || !syncCode || !messageId || !emoji || !userId) return;
  const cleanCode = syncCode.toUpperCase().trim();
  const reactionRef = ref(db, `group_chats/${cleanCode}/messages/${messageId}/reactions/${emoji}/${userId}`);

  try {
    const snap = await get(reactionRef);
    if (snap.exists()) {
      await remove(reactionRef);
    } else {
      await set(reactionRef, true);
    }
  } catch (err) {
    console.warn('toggleChatMessageReaction error:', err);
  }
};

/**
 * Delete a chat message
 */
export const deleteGroupChatMessage = async (syncCode, messageId) => {
  if (!db || !syncCode || !messageId) return;
  const cleanCode = syncCode.toUpperCase().trim();
  const msgRef = ref(db, `group_chats/${cleanCode}/messages/${messageId}`);
  try {
    await remove(msgRef);
  } catch (err) {
    console.warn('deleteGroupChatMessage error:', err);
  }
};


