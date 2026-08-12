import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, set, get, remove } from 'firebase/database';
import { getAuth } from 'firebase/auth';

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
 * Auto-discover groups for the logged-in user by their phone and email
 */
export const listenForUserGroups = (phone, email, onGroupCodeDiscovered) => {
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
  set(groupRef, { ...groupData, lastUpdated: new Date().toISOString() })
    .catch((err) => console.warn('Publish error:', err));
};

/**
 * Delete group in Firebase cloud so all members' devices delete it in real-time.
 */
export const deleteCloudGroup = (syncCode) => {
  if (!db || !syncCode) return;
  const cleanCode = syncCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const groupRef = ref(db, `groups/${cleanCode}`);
  set(groupRef, { deleted: true, lastUpdated: new Date().toISOString() })
    .catch((err) => console.warn('Delete cloud group error:', err));
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
