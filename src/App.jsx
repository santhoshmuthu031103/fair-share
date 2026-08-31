import React, { useState, useEffect, useRef } from 'react';
import { loadInitialState, saveStateToStorage, getMyUserProfile, CURRENT_USER_ID } from './utils/storage';
import { MobileFrame } from './components/Layout/MobileFrame';
import { Header } from './components/Layout/Header';
import { BottomNav } from './components/Layout/BottomNav';
import { DashboardView } from './components/Dashboard/DashboardView';
import { GroupList } from './components/Groups/GroupList';
import { GroupDetail } from './components/Groups/GroupDetail';
import { CreateGroupModal } from './components/Groups/CreateGroupModal';
import { JoinGroupModal } from './components/Groups/JoinGroupModal';
import { FriendsList } from './components/Friends/FriendsList';
import { AddFriendModal } from './components/Friends/AddFriendModal';
import { AddExpenseModal } from './components/Expenses/AddExpenseModal';
import { DebtRouletteModal } from './components/Expenses/DebtRouletteModal';
import { SettleUpModal } from './components/Debts/SettleUpModal';
import { ActivityFeed } from './components/Activity/ActivityFeed';
import { AnalyticsView } from './components/Analytics/AnalyticsView';
import { ProfileModal } from './components/User/ProfileModal';
import { AuthModal } from './components/User/AuthModal';
import { Toast } from './components/Layout/Toast';
import { 
  subscribeToCloudGroup, 
  publishToCloudGroup, 
  deleteCloudGroup,
  generateSyncCode, 
  linkGroupToUserContact, 
  unlinkGroupFromUserContact,
  listenForUserGroups, 
  fetchCloudGroup,
  registerCloudUser,
  listenForUserProfile,
  publishDirectExpense,
  deleteDirectExpense,
  publishDirectSettlement,
  deleteDirectSettlement,
  listenForDirectExpenses,
  listenForDirectSettlements,
  saveFCMToken,
  triggerNotification,
} from './utils/firebaseSync';
import { reconcileCloudData, reconcileDirectExpense, reconcileDirectSettlement } from './utils/userSyncHelper';

export function App() {
  const [state, setState] = useState(() => loadInitialState());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [rouletteWinnerId, setRouletteWinnerId] = useState(null);
  const [settleUpData, setSettleUpData] = useState({});
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('splitwise_is_logged_in') === 'true';
  });
  const [toast, setToast] = useState(null);
  const fcmInitialized = useRef(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const isSyncingRef = useRef(false);
  const activeUnsubsRef = useRef({}); // syncCode -> unsub

  const { friends, groups, expenses, settlements, activeCurrency, isDarkMode } = state;

  // Get active device owner profile
  const storedProfile = getMyUserProfile();
  const currentUser = friends.find(f => f.id === storedProfile.id) || storedProfile;

  // Save state to local storage on every change
  useEffect(() => {
    saveStateToStorage(state);
  }, [state]);

  // Sync dark mode HTML attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // ─── FCM Push Notification Setup ────────────────────────────────────────────
  // Runs once after login to register device token and listen for foreground messages
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.id || fcmInitialized.current) return;

    const initFCM = async () => {
      try {
        // Dynamically import so it doesn't crash in browser/dev mode
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

        // Request permission (Android 13+ requires explicit prompt)
        const { receive } = await FirebaseMessaging.requestPermissions();
        if (receive !== 'granted') {
          console.warn('Push notification permission denied');
          return;
        }

        // Get the FCM token for this device
        const { token } = await FirebaseMessaging.getToken();
        if (token) {
          saveFCMToken(currentUser.id, token);
          localStorage.setItem('fcm_token', token);
        }

        // Listen for token refresh
        FirebaseMessaging.addListener('tokenReceived', ({ token: newToken }) => {
          if (newToken) {
            saveFCMToken(currentUser.id, newToken);
            localStorage.setItem('fcm_token', newToken);
          }
        });

        // Show a toast when a push arrives while app is in foreground
        FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
          const body = notification?.body || notification?.title || 'New activity in your group';
          showToast(`🔔 ${body}`, 'info');
        });

        fcmInitialized.current = true;
      } catch (err) {
        // Plugin not available in browser dev mode — silently ignore
        console.info('FCM not available (running in browser?):', err.message);
      }
    };

    initFCM();
  }, [isLoggedIn, currentUser?.id]);
  // ────────────────────────────────────────────────────────────────────────────

  // Handle Android back button & swipe gestures
  useEffect(() => {
    const handlePopState = () => {
      if (modalType) {
        setModalType(null);
      } else if (selectedGroup) {
        setSelectedGroup(null);
      } else if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [modalType, selectedGroup, activeTab]);

  // Helper: Publish a specific group's latest state instantly to Firebase
  const publishGroupInstantly = (targetGroupId, currentState = state) => {
    const grp = currentState.groups.find(g => g.id === targetGroupId);
    if (!grp) return;
    const syncCode = grp.syncCode || generateSyncCode(grp.id);
    const groupExps = currentState.expenses.filter(e => e.groupId === grp.id);
    const groupSets = currentState.settlements.filter(s => s.groupId === grp.id);
    const groupMembers = currentState.friends.filter(f => grp.members?.includes(f.id));

    publishToCloudGroup(syncCode, {
      group: grp,
      expenses: groupExps,
      settlements: groupSets,
      members: groupMembers,
    });
  };

  // Continuous background WebSocket listeners for ALL groups
  // Guarantees instant (<100ms) sync even when on main dashboard
  useEffect(() => {
    const currentUnsubs = activeUnsubsRef.current;

    groups.forEach(grp => {
      const syncCode = grp.syncCode || generateSyncCode(grp.id);
      if (!currentUnsubs[syncCode]) {
        currentUnsubs[syncCode] = subscribeToCloudGroup(syncCode, (rawCloudData) => {
          if (!rawCloudData) return;
          isSyncingRef.current = true;

          if (rawCloudData.deleted || (rawCloudData.group && rawCloudData.group.deleted)) {
            setState(prev => ({
              ...prev,
              groups: prev.groups.filter(g => (g.syncCode || generateSyncCode(g.id)) !== syncCode),
              expenses: prev.expenses.filter(e => {
                const group = prev.groups.find(g => (g.syncCode || generateSyncCode(g.id)) === syncCode);
                return group ? e.groupId !== group.id : true;
              }),
              settlements: prev.settlements.filter(s => {
                const group = prev.groups.find(g => (g.syncCode || generateSyncCode(g.id)) === syncCode);
                return group ? s.groupId !== group.id : true;
              })
            }));
            setTimeout(() => { isSyncingRef.current = false; }, 100);
            return;
          }

          const cloudData = reconcileCloudData(rawCloudData, currentUser, friends);
          const incomingGroup   = cloudData.group       || grp;
          const incomingMemberIds = incomingGroup.members || [];

          // If current user is no longer a member of this group (removed or left):
          if (currentUser?.id && incomingMemberIds.length > 0 && !incomingMemberIds.includes(currentUser.id)) {
            setState(prev => ({
              ...prev,
              groups: prev.groups.filter(g => (g.syncCode || generateSyncCode(g.id)) !== syncCode && g.id !== incomingGroup.id),
              expenses: prev.expenses.filter(e => e.groupId !== incomingGroup.id),
              settlements: prev.settlements.filter(s => s.groupId !== incomingGroup.id),
            }));
            if (activeUnsubsRef.current[syncCode]) {
              activeUnsubsRef.current[syncCode]();
              delete activeUnsubsRef.current[syncCode];
            }
            setTimeout(() => { isSyncingRef.current = false; }, 100);
            return;
          }

          setState(prev => {
            const incomingExps    = cloudData.expenses    || [];
            const incomingSets    = cloudData.settlements || [];
            const incomingMembers = Array.isArray(cloudData.members) ? cloudData.members : [];

            // Merge expenses (keep unique by id)
            const otherExps = prev.expenses.filter(e => e.groupId !== incomingGroup.id);
            const newExps = [...otherExps, ...incomingExps];

            // Merge settlements
            const otherSets = prev.settlements.filter(s => s.groupId !== incomingGroup.id);
            const newSets = [...otherSets, ...incomingSets];

            // Merge friends updating latest profile info (name, avatar, phone, email, color)
            const friendMap = new Map();
            prev.friends.forEach(f => friendMap.set(f.id, f));

            incomingMembers.forEach(m => {
              if (m && m.id) {
                if (m.id === currentUser.id) return; // Keep local currentUser profile authoritative
                const existing = friendMap.get(m.id);
                if (existing) {
                  friendMap.set(m.id, {
                    ...existing,
                    ...m,
                    id: m.id,
                    name: m.name || existing.name,
                    avatar: m.avatar || existing.avatar,
                    phone: m.phone || existing.phone,
                    email: m.email || existing.email,
                    color: m.color || existing.color,
                  });
                } else {
                  friendMap.set(m.id, m);
                }
              }
            });

            const newFriends = Array.from(friendMap.values());

            // Update groups
            const newGroups = prev.groups.some(g => g.id === incomingGroup.id)
              ? prev.groups.map(g => g.id === incomingGroup.id ? { ...g, ...incomingGroup } : g)
              : [...prev.groups, incomingGroup];

            return {
              ...prev,
              groups: newGroups,
              expenses: newExps,
              settlements: newSets,
              friends: newFriends,
            };
          });

          setTimeout(() => { isSyncingRef.current = false; }, 100);
        });
      }
    });

    return () => {
      const currentCodes = new Set(groups.map(g => g.syncCode || generateSyncCode(g.id)));
      Object.keys(currentUnsubs).forEach(code => {
        if (!currentCodes.has(code)) {
          if (currentUnsubs[code]) currentUnsubs[code]();
          delete currentUnsubs[code];
        }
      });
    };
  }, [groups, currentUser, friends]);

  // Realtime listener for friends' cloud profile updates (avatar, name, etc.)
  useEffect(() => {
    const friendsToWatch = friends.filter(f => f.id !== currentUser.id && (f.id || f.phone || f.email));
    const unsubs = friendsToWatch.map(friend => {
      return listenForUserProfile(friend, (cloudProfile) => {
        if (!cloudProfile || (!cloudProfile.avatar && !cloudProfile.name)) return;
        setState(prev => {
          let hasChange = false;
          const updatedFriends = prev.friends.map(f => {
            if (f.id === friend.id || (friend.phone && f.phone === friend.phone) || (friend.email && f.email === friend.email)) {
              if (cloudProfile.avatar && f.avatar !== cloudProfile.avatar) hasChange = true;
              if (cloudProfile.name && f.name !== cloudProfile.name) hasChange = true;
              return {
                ...f,
                name: cloudProfile.name || f.name,
                avatar: cloudProfile.avatar || f.avatar,
                phone: cloudProfile.phone || f.phone,
                email: cloudProfile.email || f.email,
                color: cloudProfile.color || f.color,
              };
            }
            return f;
          });
          return hasChange ? { ...prev, friends: updatedFriends } : prev;
        });
      });
    });

    return () => {
      unsubs.forEach(unsub => unsub && unsub());
    };
  }, [friends.map(f => f.id).join(','), currentUser.id]);

  // Auto-discover groups linked to user's phone or email
  useEffect(() => {
    if (!currentUser?.phone && !currentUser?.email) return;

    const unsub = listenForUserGroups(currentUser.phone, currentUser.email, async (syncCode) => {
      if (!syncCode) return;
      const alreadyHas = state.groups.some(g => (g.syncCode || generateSyncCode(g.id)) === syncCode);
      if (alreadyHas) return;

      const cloudData = await fetchCloudGroup(syncCode);
      if (cloudData && cloudData.group) {
        handleJoinGroup(syncCode, cloudData);
      }
    });

    return () => unsub && unsub();
  }, [currentUser?.phone, currentUser?.email, state.groups]);

  // Realtime listener for direct non-group expenses (friend-to-friend)
  useEffect(() => {
    if (!currentUser?.id && !currentUser?.phone && !currentUser?.email) return;

    const unsub = listenForDirectExpenses(currentUser, (rawPayload) => {
      if (!rawPayload) return;

      const reconciled = reconcileDirectExpense(rawPayload, currentUser, state.friends);
      if (!reconciled) return;

      setState(prev => {
        if (reconciled.deleted) {
          const updatedExps = prev.expenses.map(e => e.id === reconciled.id ? { ...e, isDeleted: true } : e);
          return { ...prev, expenses: updatedExps };
        }

        const incomingExp = reconciled.expense;
        const exists = prev.expenses.some(e => e.id === incomingExp.id);
        const nextExps = exists
          ? prev.expenses.map(e => e.id === incomingExp.id ? incomingExp : e)
          : [incomingExp, ...prev.expenses];

        // Auto-add or update any friend discovered through this transaction
        const friendMap = new Map();
        prev.friends.forEach(f => friendMap.set(f.id, f));
        (reconciled.friends || []).forEach(rf => {
          if (rf && rf.id && rf.id !== currentUser.id) {
            if (!friendMap.has(rf.id)) {
              friendMap.set(rf.id, rf);
            }
          }
        });

        return {
          ...prev,
          expenses: nextExps,
          friends: Array.from(friendMap.values()),
        };
      });
    });

    return () => unsub && unsub();
  }, [currentUser?.id, currentUser?.phone, currentUser?.email]);

  // Realtime listener for direct non-group settlements (friend-to-friend)
  useEffect(() => {
    if (!currentUser?.id && !currentUser?.phone && !currentUser?.email) return;

    const unsub = listenForDirectSettlements(currentUser, (rawPayload) => {
      if (!rawPayload) return;

      const reconciled = reconcileDirectSettlement(rawPayload, currentUser, state.friends);
      if (!reconciled) return;

      setState(prev => {
        if (reconciled.deleted) {
          const updatedSets = prev.settlements.map(s => s.id === reconciled.id ? { ...s, isDeleted: true } : s);
          return { ...prev, settlements: updatedSets };
        }

        const incomingSet = reconciled.settlement;
        const exists = prev.settlements.some(s => s.id === incomingSet.id);
        const nextSets = exists
          ? prev.settlements.map(s => s.id === incomingSet.id ? incomingSet : s)
          : [incomingSet, ...prev.settlements];

        const friendMap = new Map();
        prev.friends.forEach(f => friendMap.set(f.id, f));
        (reconciled.friends || []).forEach(rf => {
          if (rf && rf.id && rf.id !== currentUser.id) {
            if (!friendMap.has(rf.id)) {
              friendMap.set(rf.id, rf);
            }
          }
        });

        return {
          ...prev,
          settlements: nextSets,
          friends: Array.from(friendMap.values()),
        };
      });
    });

    return () => unsub && unsub();
  }, [currentUser?.id, currentUser?.phone, currentUser?.email]);

  const handleRegisterLogin = (userProfile) => {
    const myId = userProfile.id || `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem('splitwise_my_user_id', myId);
    const profileWithId = { ...userProfile, id: myId };
    localStorage.setItem('splitwise_is_logged_in', 'true');
    localStorage.setItem('splitwise_user_profile', JSON.stringify(profileWithId));
    setIsLoggedIn(true);

    // Initialize clean state for the logged-in user (cloud listeners will pull any relevant groups/expenses)
    setState({
      friends: [profileWithId],
      groups: [],
      expenses: [],
      settlements: [],
      activeCurrency: '₹',
      isDarkMode: false,
    });
  };

  const handleLogout = () => {
    try {
      localStorage.clear();
      localStorage.setItem('splitwise_app_version', 'v5');
    } catch (_) {}
    setIsLoggedIn(false);
    setSelectedGroup(null);
    setModalType(null);
    const freshUserId = `user_${Date.now()}`;
    const defaultProfile = {
      id: freshUserId,
      name: 'You',
      email: '',
      phone: '',
      avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=You&mouth=smile&eyes=happy&backgroundColor=b6e3f4,c0aede&backgroundType=gradientLinear`,
      color: '#10b981',
    };
    setState({
      friends: [defaultProfile],
      groups: [],
      expenses: [],
      settlements: [],
      activeCurrency: '₹',
      isDarkMode: false,
    });
  };

  const handleUpdateProfile = (updatedProfile) => {
    localStorage.setItem('splitwise_user_profile', JSON.stringify(updatedProfile));
    
    // Register in Firebase cloud immediately so friends can see new avatar & details
    registerCloudUser(updatedProfile);

    const nextFriends = state.friends.map(f => f.id === updatedProfile.id ? updatedProfile : f);
    const nextState = {
      ...state,
      friends: nextFriends,
    };
    setState(nextState);

    // Re-publish all groups currentUser belongs to with the new avatar/profile
    state.groups.forEach(grp => {
      if (grp.members?.includes(updatedProfile.id)) {
        publishGroupInstantly(grp.id, nextState);
      }
    });
  };

  const handleResetAllData = () => {
    try {
      localStorage.clear();
    } catch (_) {}

    const freshUserId = `user_${Date.now()}`;
    const freshProfile = {
      id: freshUserId,
      name: 'You',
      email: '',
      phone: '',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${freshUserId}`,
      color: '#9C3925',
    };

    setIsLoggedIn(false);
    setSelectedGroup(null);
    setModalType(null);
    setState({
      friends: [freshProfile],
      groups: [],
      expenses: [],
      settlements: [],
      activeCurrency: '₹',
      isDarkMode: false,
    });
  };

  const handleCurrencyChange = (newCurrency) => {
    setState(prev => ({ ...prev, activeCurrency: newCurrency }));
  };

  const handleToggleTheme = () => {
    setState(prev => ({ ...prev, isDarkMode: !prev.isDarkMode }));
  };

  const handleAddExpense = (newExpenseData) => {
    const newExp = {
      id: `exp_${Date.now()}`,
      ...newExpenseData,
    };

    const nextState = {
      ...state,
      expenses: [newExp, ...state.expenses],
    };

    setState(nextState);
    setModalType(null);

    // Instant write to Firebase in <10ms
    if (newExpenseData.groupId) {
      publishGroupInstantly(newExpenseData.groupId, nextState);

      // Trigger FCM push to all OTHER group members
      const grp = state.groups.find(g => g.id === newExpenseData.groupId);
      if (grp) {
        const otherMemberIds = (grp.members || []).filter(id => id !== currentUser.id);
        triggerNotification({
          action: 'expense_added',
          senderName: currentUser.name || 'Someone',
          senderId: currentUser.id,
          groupName: grp.name,
          description: newExp.title || newExp.description || 'an expense',
          amount: newExp.amount,
          memberIds: otherMemberIds,
        });
      }
    } else {
      // Direct non-group expense: publish to all participants
      const involvedIds = new Set([
        newExp.paidBy,
        ...(newExp.recipientIds || []),
        ...Object.keys(newExp.splits || {})
      ]);
      const participants = state.friends.filter(f => involvedIds.has(f.id));
      publishDirectExpense(newExp, participants, currentUser);

      // Trigger notification for direct friend
      const otherParticipantIds = Array.from(involvedIds).filter(id => id !== currentUser.id);
      if (otherParticipantIds.length > 0) {
        triggerNotification({
          action: 'expense_added',
          customTitle: '🧾 Direct Expense',
          customBody: `${currentUser.name || 'Someone'} added "${newExp.title || 'an expense'}" — ${activeCurrency}${Number(newExp.amount || 0).toFixed(0)}`,
          memberIds: otherParticipantIds,
        });
      }
    }
    showToast('Expense added successfully');
  };

  const handleCreateGroup = (newGroupData) => {
    const myId = currentUser.id;
    const membersWithMe = (newGroupData.members || []).includes(myId)
      ? newGroupData.members
      : [myId, ...(newGroupData.members || [])];

    const newGrp = {
      id: `group_${Date.now()}`,
      ...newGroupData,
      members: membersWithMe,
      createdAt: new Date().toISOString(),
    };

    const syncCode = generateSyncCode(newGrp.id);
    const grpWithCode = { ...newGrp, syncCode };

    // Link all included friends' phones & emails in Firebase for zero-code auto-join
    membersWithMe.forEach(mId => {
      const friend = state.friends.find(f => f.id === mId);
      if (friend) {
        if (friend.phone) linkGroupToUserContact(friend.phone, syncCode);
        if (friend.email) linkGroupToUserContact(friend.email, syncCode);
      }
    });

    const nextState = {
      ...state,
      groups: [grpWithCode, ...state.groups],
    };

    setState(nextState);
    setModalType(null);
    setSelectedGroup(grpWithCode);
    window.history.pushState({ inGroup: true }, '');

    // Instant publish to Firebase
    publishGroupInstantly(grpWithCode.id, nextState);

    // Notify other group members about group creation
    const otherMemberIds = (membersWithMe || []).filter(id => id !== myId);
    if (otherMemberIds.length > 0) {
      triggerNotification({
        action: 'group_created',
        senderName: currentUser.name || 'Someone',
        senderId: currentUser.id,
        groupName: grpWithCode.name,
        memberIds: otherMemberIds,
      });
    }

    showToast(`Group "${grpWithCode.name}" created! 🎉`);
  };

  // Add members to an existing group after creation
  const handleAddMembersToGroup = (groupId, memberIds) => {
    const grp = state.groups.find(g => g.id === groupId);
    if (!grp) return;

    const oldMembers = grp.members || [];
    const updatedMembers = [...new Set([...oldMembers, ...memberIds])];
    const updatedGrp = { ...grp, members: updatedMembers };

    // Freeze recipientIds for old expenses so new members aren't retroactively charged
    const updatedExpenses = state.expenses.map(e => {
      if (e.groupId === groupId && (!e.recipientIds || e.recipientIds.length === 0)) {
        return { ...e, recipientIds: oldMembers };
      }
      return e;
    });

    const nextState = {
      ...state,
      groups: state.groups.map(g => g.id === groupId ? updatedGrp : g),
      expenses: updatedExpenses,
    };

    setState(nextState);

    // Link newly added friends' contacts in Firebase
    const syncCode = grp.syncCode || generateSyncCode(grp.id);
    memberIds.forEach(mId => {
      const friend = state.friends.find(f => f.id === mId);
      if (friend) {
        if (friend.phone) linkGroupToUserContact(friend.phone, syncCode);
        if (friend.email) linkGroupToUserContact(friend.email, syncCode);
      }
    });

    publishGroupInstantly(groupId, nextState);
    const addedNames = memberIds.map(mId => state.friends.find(f => f.id === mId)?.name).filter(Boolean).join(', ');

    // 1. Notify newly added members ("You were added to group")
    triggerNotification({
      action: 'member_added',
      senderName: currentUser.name || 'Someone',
      senderId: currentUser.id,
      groupName: grp.name,
      targetUserName: '',
      memberIds: memberIds,
    });

    // 2. Notify other existing group members ("X added Y to the group")
    const otherExistingMembers = oldMembers.filter(id => id !== currentUser.id && !memberIds.includes(id));
    if (otherExistingMembers.length > 0) {
      triggerNotification({
        action: 'member_added',
        senderName: currentUser.name || 'Someone',
        senderId: currentUser.id,
        groupName: grp.name,
        targetUserName: addedNames,
        memberIds: otherExistingMembers,
      });
    }

    showToast(`Added ${addedNames || 'member(s)'} to "${grp.name}" 👥`);
  };

  // Remove a member from group
  const handleRemoveMemberFromGroup = (groupId, memberIdToRemove) => {
    const grp = state.groups.find(g => g.id === groupId);
    if (!grp) return;

    const syncCode = grp.syncCode || generateSyncCode(grp.id);
    const memberToRemove = state.friends.find(f => f.id === memberIdToRemove);
    const removedName = memberToRemove?.name || 'A member';
    const oldMembers = grp.members || [];
    const updatedMembers = oldMembers.filter(mId => mId !== memberIdToRemove);
    const updatedGrp = { ...grp, members: updatedMembers };

    // Remove the expelled member's Firebase auto-discover entry so they are
    // not immediately re-joined by their own listenForUserGroups listener.
    if (memberToRemove?.phone) unlinkGroupFromUserContact(memberToRemove.phone, syncCode);
    if (memberToRemove?.email) unlinkGroupFromUserContact(memberToRemove.email, syncCode);

    const groupExps = state.expenses.filter(e => e.groupId === grp.id);
    const groupSets = state.settlements.filter(s => s.groupId === grp.id);
    const remainingFriends = state.friends.filter(f => updatedMembers.includes(f.id));

    // Update local state
    setState(prev => ({
      ...prev,
      groups: prev.groups.map(g => g.id === groupId ? updatedGrp : g),
    }));

    // Publish to cloud group immediately
    publishToCloudGroup(syncCode, {
      group: updatedGrp,
      expenses: groupExps,
      settlements: groupSets,
      members: remainingFriends,
    });

    // 1. Notify removed member
    triggerNotification({
      action: 'member_removed',
      senderName: currentUser.name || 'Someone',
      senderId: currentUser.id,
      groupName: grp.name,
      targetUserName: '',
      memberIds: [memberIdToRemove],
    });

    // 2. Notify remaining members
    const remainingOther = updatedMembers.filter(id => id !== currentUser.id);
    if (remainingOther.length > 0) {
      triggerNotification({
        action: 'member_removed',
        senderName: currentUser.name || 'Someone',
        senderId: currentUser.id,
        groupName: grp.name,
        targetUserName: removedName,
        memberIds: remainingOther,
      });
    }

    showToast(`Removed ${removedName} from "${grp.name}" 🚪`);
  };

  // Leave group
  const handleLeaveGroup = (groupId) => {
    if (window.confirm('Leave this group? You will be removed from its member list.')) {
      const grp = state.groups.find(g => g.id === groupId);
      if (!grp) return;

      const syncCode = grp.syncCode || generateSyncCode(grp.id);
      const remainingMembers = (grp.members || []).filter(mId => mId !== currentUser.id);

      // ── CRITICAL FIX ──────────────────────────────────────────────────────────
      // Remove the Firebase auto-discover entry (user_groups/{phone}/{code}).
      // Without this, listenForUserGroups fires again after we delete the local
      // group and immediately re-joins the user via handleJoinGroup!
      if (currentUser.phone) unlinkGroupFromUserContact(currentUser.phone, syncCode);
      if (currentUser.email) unlinkGroupFromUserContact(currentUser.email, syncCode);
      // ─────────────────────────────────────────────────────────────────────────

      // Unsubscribe WebSocket listener for this group on leaving device
      if (activeUnsubsRef.current[syncCode]) {
        activeUnsubsRef.current[syncCode]();
        delete activeUnsubsRef.current[syncCode];
      }

      if (remainingMembers.length === 0) {
        // No members left, delete
        try {
          deleteCloudGroup(syncCode);
        } catch (e) {
          console.error('Failed to delete cloud group', e);
        }
      } else {
        const updatedGrp = { ...grp, members: remainingMembers };
        const groupExps = state.expenses.filter(e => e.groupId === grp.id);
        const groupSets = state.settlements.filter(s => s.groupId === grp.id);
        const remainingFriends = state.friends.filter(f => remainingMembers.includes(f.id));

        // Publish to Firebase with leaving member removed from cloud group
        publishToCloudGroup(syncCode, {
          group: updatedGrp,
          expenses: groupExps,
          settlements: groupSets,
          members: remainingFriends,
        });

        // Notify remaining members that user left
        triggerNotification({
          action: 'member_left',
          senderName: currentUser.name || 'Someone',
          senderId: currentUser.id,
          groupName: grp.name,
          memberIds: remainingMembers,
        });
      }

      // Remove the group completely from the leaving user's local state
      setState(prev => ({
        ...prev,
        groups: prev.groups.filter(g => g.id !== groupId),
        expenses: prev.expenses.filter(e => e.groupId !== groupId),
        settlements: prev.settlements.filter(s => s.groupId !== groupId),
      }));
      setSelectedGroup(null);
      showToast(`You left "${grp.name}"`);
    }
  };

  const handleAddFriend = (newFriendData) => {
    let isDup = false;
    setState(prev => {
      isDup = prev.friends.some(f => 
        f.id === newFriendData.id || 
        (f.phone && newFriendData.phone && f.phone === newFriendData.phone) || 
        (f.email && newFriendData.email && f.email === newFriendData.email)
      );
      if (isDup) return prev;

      return {
        ...prev,
        friends: [...prev.friends, newFriendData],
      };
    });
    setModalType(null);
    if (!isDup) showToast(`${newFriendData.name} added as a friend! 🤝`);
  };

  const handleSettleUp = (newSettlementData) => {
    const newSet = {
      id: `set_${Date.now()}`,
      date: new Date().toISOString(),
      ...newSettlementData,
    };

    const nextState = {
      ...state,
      settlements: [newSet, ...state.settlements],
    };

    setState(nextState);
    setModalType(null);

    const payeeName = state.friends.find(f => f.id === newSet.payeeId)?.name || 'friend';

    // Instant write to Firebase
    if (newSettlementData.groupId) {
      publishGroupInstantly(newSettlementData.groupId, nextState);

      // Trigger FCM push to all OTHER group members
      const grp = state.groups.find(g => g.id === newSettlementData.groupId);
      if (grp) {
        const otherMemberIds = (grp.members || []).filter(id => id !== currentUser.id);
        triggerNotification({
          action: 'settlement_added',
          senderName: currentUser.name || 'Someone',
          senderId: currentUser.id,
          groupName: grp.name,
          payeeName,
          amount: newSet.amount,
          memberIds: otherMemberIds,
        });
      }
    } else {
      const involvedIds = new Set([newSet.payerId, newSet.payeeId]);
      const participants = state.friends.filter(f => involvedIds.has(f.id));
      publishDirectSettlement(newSet, participants, currentUser);

      // Trigger notification for direct settlement payee
      const otherParticipantIds = Array.from(involvedIds).filter(id => id !== currentUser.id);
      if (otherParticipantIds.length > 0) {
        triggerNotification({
          action: 'settlement_added',
          customTitle: '💸 Settlement Recorded',
          customBody: `${currentUser.name || 'Someone'} settled ${activeCurrency}${Number(newSet.amount || 0).toFixed(0)} with you`,
          memberIds: otherParticipantIds,
        });
      }
    }
    showToast(`Settlement recorded with ${payeeName} 💸`);
  };

  const handleToggleSimplifyDebts = (groupId) => {
    const nextState = {
      ...state,
      groups: state.groups.map(g => 
        g.id === groupId ? { ...g, simplifyDebts: !g.simplifyDebts } : g
      ),
    };
    setState(nextState);
    publishGroupInstantly(groupId, nextState);
  };

  const handleDeleteExpense = (expenseId) => {
    const expToDelete = state.expenses.find(e => e.id === expenseId);
    if (!expToDelete) return;

    const updatedExp = {
      ...expToDelete,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser?.id,
    };

    const nextState = {
      ...state,
      expenses: state.expenses.map(e => e.id === expenseId ? updatedExp : e),
    };
    setState(nextState);

    if (expToDelete.groupId) {
      publishGroupInstantly(expToDelete.groupId, nextState);

      // Notify other group members
      const grp = state.groups.find(g => g.id === expToDelete.groupId);
      if (grp) {
        const otherMemberIds = (grp.members || []).filter(id => id !== currentUser.id);
        if (otherMemberIds.length > 0) {
          triggerNotification({
            action: 'expense_deleted',
            senderName: currentUser.name || 'Someone',
            senderId: currentUser.id,
            groupName: grp.name,
            description: expToDelete.title || expToDelete.description || 'an expense',
            memberIds: otherMemberIds,
          });
        }
      }
    } else {
      const involvedIds = new Set([
        expToDelete.paidBy,
        ...(expToDelete.recipientIds || []),
        ...Object.keys(expToDelete.splits || {})
      ]);
      const participants = state.friends.filter(f => involvedIds.has(f.id));
      deleteDirectExpense(expenseId, participants);

      const otherParticipantIds = Array.from(involvedIds).filter(id => id !== currentUser.id);
      if (otherParticipantIds.length > 0) {
        triggerNotification({
          action: 'expense_deleted',
          customTitle: '🗑️ Expense Deleted',
          customBody: `${currentUser.name || 'Someone'} deleted "${expToDelete.title || 'an expense'}"`,
          memberIds: otherParticipantIds,
        });
      }
    }
    showToast(`Expense "${expToDelete.title || expToDelete.description || 'expense'}" deleted`, 'error');
  };

  const handleDeleteSettlement = (settlementId) => {
    const setToDelete = state.settlements.find(s => s.id === settlementId);
    if (!setToDelete) return;

    const updatedSet = {
      ...setToDelete,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser?.id,
    };

    const nextState = {
      ...state,
      settlements: state.settlements.map(s => s.id === settlementId ? updatedSet : s),
    };
    setState(nextState);

    if (setToDelete.groupId) {
      publishGroupInstantly(setToDelete.groupId, nextState);

      const grp = state.groups.find(g => g.id === setToDelete.groupId);
      if (grp) {
        const otherMemberIds = (grp.members || []).filter(id => id !== currentUser.id);
        if (otherMemberIds.length > 0) {
          triggerNotification({
            action: 'settlement_deleted',
            senderName: currentUser.name || 'Someone',
            senderId: currentUser.id,
            groupName: grp.name,
            memberIds: otherMemberIds,
          });
        }
      }
    } else {
      const involvedIds = new Set([setToDelete.payerId, setToDelete.payeeId]);
      const participants = state.friends.filter(f => involvedIds.has(f.id));
      deleteDirectSettlement(settlementId, participants);

      const otherParticipantIds = Array.from(involvedIds).filter(id => id !== currentUser.id);
      if (otherParticipantIds.length > 0) {
        triggerNotification({
          action: 'settlement_deleted',
          customTitle: '🗑️ Settlement Deleted',
          customBody: `${currentUser.name || 'Someone'} deleted a settlement`,
          memberIds: otherParticipantIds,
        });
      }
    }
    showToast('Settlement deleted', 'error');
  };

  const handleDeleteGroup = (groupId) => {
    const grp = state.groups.find(g => g.id === groupId);
    const syncCode = grp?.syncCode || generateSyncCode(groupId);
    
    // Broadcast deletion to Firebase so all friends' devices remove this group in real-time
    try {
      deleteCloudGroup(syncCode);
    } catch (e) {
      console.error('Failed to delete cloud group', e);
    }

    // Notify other members
    if (grp) {
      const otherMembers = (grp.members || []).filter(id => id !== currentUser.id);
      if (otherMembers.length > 0) {
        triggerNotification({
          action: 'group_deleted',
          senderName: currentUser.name || 'Someone',
          senderId: currentUser.id,
          groupName: grp.name,
          memberIds: otherMembers,
        });
      }
    }

    setState(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.id !== groupId && g.name), // also purge nameless ghost groups
      expenses: prev.expenses.filter(e => e.groupId !== groupId),
      settlements: prev.settlements.filter(s => s.groupId !== groupId),
    }));
    setSelectedGroup(null);
  };

  const handleDeleteFriend = (friendId) => {
    if (friendId === currentUser.id) return; // Cannot delete device owner
    setState(prev => ({
      ...prev,
      friends: prev.friends.filter(f => f.id !== friendId),
    }));
  };

  const openSettleUpModal = (initialData = {}) => {
    setSettleUpData(initialData);
    setModalType('settle_up');
  };

  // Group selection with history push for back button
  const handleSelectGroup = (grp) => {
    setSelectedGroup(grp);
    window.history.pushState({ inGroup: true }, '');
  };

  // Handle friend joining a group via sync code or automatic discovery
  const handleJoinGroup = (syncCode, rawCloudData) => {
    isSyncingRef.current = true;

    if (rawCloudData.deleted || (rawCloudData.group && rawCloudData.group.deleted)) {
      alert("This group no longer exists.");
      isSyncingRef.current = false;
      return;
    }

    // Reconcile and unify user identity
    const cloudData = reconcileCloudData(rawCloudData, currentUser, state.friends);

    const incomingGroup   = cloudData.group       || {};
    const incomingExps    = cloudData.expenses    || [];
    const incomingSets    = cloudData.settlements || [];
    const incomingMembers = Array.isArray(cloudData.members) ? cloudData.members : [];

    let myProfile = currentUser;

    setState(prev => {
      const oldGroupMembers = incomingGroup.members || [];

      const otherExps = prev.expenses.filter(e => e.groupId !== incomingGroup.id);
      const newExps = [...otherExps, ...incomingExps.map(e => {
        if (!e.recipientIds || e.recipientIds.length === 0) {
          return { ...e, recipientIds: oldGroupMembers };
        }
        return e;
      })];

      const otherSets = prev.settlements.filter(s => s.groupId !== incomingGroup.id);
      const newSets = [...otherSets, ...incomingSets];

      const allIncomingMembers = myProfile
        ? [...incomingMembers.filter(m => m.id !== myProfile.id), myProfile]
        : incomingMembers;
      const mergedFriendIds = new Set(prev.friends.map(f => f.id));
      const rawNewFriends = [...prev.friends, ...allIncomingMembers.filter(m => !mergedFriendIds.has(m.id))];
      // Deduplicate by ID in case any ghost entries slipped through
      const seenIds = new Set();
      const newFriends = rawNewFriends.filter(f => {
        if (!f || !f.id || seenIds.has(f.id)) return false;
        seenIds.add(f.id);
        return true;
      });

      const myId = myProfile?.id;
      const updatedMemberIds = myId && !oldGroupMembers.includes(myId)
        ? [...oldGroupMembers, myId]
        : oldGroupMembers;
      const grpWithCode = { ...incomingGroup, syncCode, members: updatedMemberIds };

      const newGroups = prev.groups.some(g => g.id === grpWithCode.id)
        ? prev.groups.map(g => g.id === grpWithCode.id ? { ...g, ...grpWithCode } : g)
        : [...prev.groups, grpWithCode];

      // Instant publish with joiner added
      publishToCloudGroup(syncCode, {
        group: grpWithCode,
        expenses: newExps.filter(e => e.groupId === grpWithCode.id),
        settlements: newSets.filter(s => s.groupId === grpWithCode.id),
        members: newFriends.filter(f => grpWithCode.members?.includes(f.id)),
      });

      return { ...prev, groups: newGroups, expenses: newExps, settlements: newSets, friends: newFriends };
    });

    setModalType(null);
    setTimeout(() => {
      isSyncingRef.current = false;
      const joinedGrp = { ...incomingGroup, syncCode };
      handleSelectGroup(joinedGrp);
      showToast(`Joined group "${incomingGroup.name || 'group'}" successfully! 🎊`);
    }, 100);
  };

  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      <MobileFrame isFullScreen={isFullScreen || !isLoggedIn} toggleFullScreen={() => setIsFullScreen(!isFullScreen)}>
        {!isLoggedIn && (
          <AuthModal onLoginSuccess={handleRegisterLogin} />
        )}

        {!isFullScreen && isLoggedIn && (
          <Header
            currentUser={currentUser}
            isDarkMode={isDarkMode}
            onToggleTheme={handleToggleTheme}
            onOpenProfile={() => setModalType('profile')}
            onAddFriend={() => setModalType('add_friend')}
            activeCurrency={activeCurrency}
          />
        )}
        
        {toast && (
          <div className="toast-container">
            <Toast 
              message={toast.message} 
              type={toast.type} 
              onClose={() => setToast(null)} 
            />
          </div>
        )}

      <main className="mobile-screen-content">
        {selectedGroup && groups.find(g => g.id === selectedGroup.id) ? (
          <GroupDetail
            group={groups.find(g => g.id === selectedGroup.id)}
            expenses={expenses}
            settlements={settlements}
            friends={friends}
            currency={activeCurrency}
            currentUser={currentUser}
            onBack={() => setSelectedGroup(null)}
            onOpenAddExpense={() => setModalType('add_expense')}
            onOpenSettleUp={openSettleUpModal}
            onToggleSimplifyDebts={handleToggleSimplifyDebts}
            onDeleteGroup={handleDeleteGroup}
            onLeaveGroup={handleLeaveGroup}
            onAddMembersToGroup={handleAddMembersToGroup}
            onRemoveMemberFromGroup={handleRemoveMemberFromGroup}
            onDeleteExpense={handleDeleteExpense}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && !selectedGroup && (
              <DashboardView
                groups={groups}
                expenses={expenses}
                settlements={settlements}
                friends={friends}
                currency={activeCurrency}
                currentUser={currentUser}
                onSelectGroup={setSelectedGroup}
                onCreateGroup={() => setModalType('create_group')}
                onOpenAddExpense={() => {
                  setRouletteWinnerId(null);
                  setModalType('add_expense');
                }}
              />
            )}

            {activeTab === 'groups' && (
              <GroupList
                groups={groups}
                expenses={expenses}
                settlements={settlements}
                friends={friends}
                currency={activeCurrency}
                currentUser={currentUser}
                onSelectGroup={handleSelectGroup}
                onCreateGroup={() => setModalType('create_group')}
                onJoinGroup={() => setModalType('join_group')}
              />
            )}

            {activeTab === 'friends' && (
              <FriendsList
                friends={friends}
                groups={groups}
                expenses={expenses}
                settlements={settlements}
                currency={activeCurrency}
                currentUser={currentUser}
                onOpenAddFriend={() => setModalType('add_friend')}
                onOpenSettleUp={openSettleUpModal}
                onDeleteFriend={handleDeleteFriend}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView
                expenses={expenses}
                settlements={settlements}
                groups={groups}
                friends={friends}
                currency={activeCurrency}
                currentUser={currentUser}
                onOpenRoulette={() => setModalType('roulette')}
                onDeleteExpense={handleDeleteExpense}
                onDeleteSettlement={handleDeleteSettlement}
              />
            )}
          </>
        )}
      </main>

      <BottomNav
        activeTab={selectedGroup ? '' : activeTab}
        onTabChange={(tab) => {
          setSelectedGroup(null);
          setActiveTab(tab);
        }}
        onOpenAddExpense={() => {
          setRouletteWinnerId(null);
          setModalType('add_expense');
        }}
      />

      {/* Modal Overlays */}
      {modalType === 'profile' && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setModalType(null)}
          onUpdateProfile={handleUpdateProfile}
          onLogout={handleLogout}
          onResetData={handleResetAllData}
        />
      )}

      {modalType === 'add_expense' && (
        <AddExpenseModal
          groups={groups}
          friends={friends}
          activeGroupId={selectedGroup?.id}
          currency={activeCurrency}
          currentUser={currentUser}
          initialPayerId={rouletteWinnerId}
          onClose={() => setModalType(null)}
          onAddExpense={handleAddExpense}
        />
      )}

      {modalType === 'roulette' && (
        <DebtRouletteModal
          friends={friends}
          currentUser={currentUser}
          onClose={() => setModalType(null)}
          onSelectPayer={(winnerId) => {
            setRouletteWinnerId(winnerId);
            setModalType('add_expense');
          }}
        />
      )}

      {modalType === 'create_group' && (
        <CreateGroupModal
          friends={friends}
          currentUser={currentUser}
          currency={activeCurrency}
          onClose={() => setModalType(null)}
          onCreateGroup={handleCreateGroup}
        />
      )}

      {modalType === 'add_friend' && (
        <AddFriendModal
          onClose={() => setModalType(null)}
          onAddFriend={handleAddFriend}
        />
      )}

      {modalType === 'join_group' && (
        <JoinGroupModal
          onClose={() => setModalType(null)}
          onJoinGroup={handleJoinGroup}
        />
      )}

      {modalType === 'settle_up' && (
        <SettleUpModal
          friends={friends}
          groups={groups}
          currentUser={currentUser}
          initialData={settleUpData}
          currency={activeCurrency}
          onClose={() => setModalType(null)}
          onSettleUp={handleSettleUp}
        />
      )}
    </MobileFrame>
    </div>
  );
}

export default App;
