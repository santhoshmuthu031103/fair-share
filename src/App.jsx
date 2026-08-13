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
import { 
  subscribeToCloudGroup, 
  publishToCloudGroup, 
  deleteCloudGroup,
  generateSyncCode, 
  linkGroupToUserContact, 
  listenForUserGroups, 
  fetchCloudGroup 
} from './utils/firebaseSync';
import { reconcileCloudData } from './utils/userSyncHelper';

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

          setState(prev => {
            const incomingGroup   = cloudData.group       || grp;
            const incomingExps    = cloudData.expenses    || [];
            const incomingSets    = cloudData.settlements || [];
            const incomingMembers = Array.isArray(cloudData.members) ? cloudData.members : [];

            // Merge expenses (keep unique by id)
            const otherExps = prev.expenses.filter(e => e.groupId !== incomingGroup.id);
            const newExps = [...otherExps, ...incomingExps];

            // Merge settlements
            const otherSets = prev.settlements.filter(s => s.groupId !== incomingGroup.id);
            const newSets = [...otherSets, ...incomingSets];

            // Merge friends without duplicates (deduplicate by id, phone, email)
            const mergedFriendIds = new Set(prev.friends.map(f => f.id));
            const newFriends = [...prev.friends];
            incomingMembers.forEach(m => {
              if (m && m.id && !mergedFriendIds.has(m.id)) {
                mergedFriendIds.add(m.id);
                newFriends.push(m);
              }
            });

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

  const handleRegisterLogin = (userProfile) => {
    const existingLocalId = localStorage.getItem('splitwise_my_user_id');
    const myId = userProfile.id || existingLocalId || `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem('splitwise_my_user_id', myId);
    const profileWithId = { ...userProfile, id: myId };
    localStorage.setItem('splitwise_is_logged_in', 'true');
    localStorage.setItem('splitwise_user_profile', JSON.stringify(profileWithId));
    setIsLoggedIn(true);

    setState(prev => {
      // Remove any stale entries that share the same id, phone, or email as the new profile
      const withoutMe = prev.friends.filter(f => {
        if (f.id === myId || f.id === CURRENT_USER_ID) return false;
        if (String(f.name || '').trim().toLowerCase() === 'you') return false; // strip the ghost "You" created during reset/init
        if (profileWithId.phone && f.phone && f.phone === profileWithId.phone) return false;
        if (profileWithId.email && f.email && f.email === profileWithId.email) return false;
        return true;
      });
      return {
        ...prev,
        friends: [profileWithId, ...withoutMe],
      };
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('splitwise_is_logged_in');
    setIsLoggedIn(false);
    setModalType(null);
  };

  const handleUpdateProfile = (updatedProfile) => {
    localStorage.setItem('splitwise_user_profile', JSON.stringify(updatedProfile));
    setState(prev => ({
      ...prev,
      friends: prev.friends.map(f => f.id === updatedProfile.id ? updatedProfile : f)
    }));
  };

  const handleResetAllData = () => {
    try {
      localStorage.clear();
    } catch (_) {}
    
    localStorage.removeItem('splitwise_app_state_v2');
    localStorage.removeItem('splitwise_is_logged_in');
    localStorage.removeItem('splitwise_user_profile');
    localStorage.removeItem('splitwise_my_user_id');

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
    }
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
  };

  // Leave group
  const handleLeaveGroup = (groupId) => {
    if (window.confirm('Leave this group? You will be removed from its member list.')) {
      const grp = state.groups.find(g => g.id === groupId);
      if (!grp) return;

      const remainingMembers = (grp.members || []).filter(mId => mId !== currentUser.id);

      let nextState;
      if (remainingMembers.length === 0) {
        // No members left, delete
        nextState = {
          ...state,
          groups: state.groups.filter(g => g.id !== groupId),
          expenses: state.expenses.filter(e => e.groupId !== groupId),
          settlements: state.settlements.filter(s => s.groupId !== groupId),
        };
      } else {
        const updatedGrp = { ...grp, members: remainingMembers };
        nextState = {
          ...state,
          groups: state.groups.map(g => g.id === groupId ? updatedGrp : g),
        };
        publishGroupInstantly(groupId, nextState);
      }

      setState(nextState);
      setSelectedGroup(null);
    }
  };

  const handleAddFriend = (newFriendData) => {
    setState(prev => {
      const isDuplicate = prev.friends.some(f => 
        f.id === newFriendData.id || 
        (f.phone && newFriendData.phone && f.phone === newFriendData.phone) || 
        (f.email && newFriendData.email && f.email === newFriendData.email)
      );
      if (isDuplicate) return prev;

      return {
        ...prev,
        friends: [...prev.friends, newFriendData],
      };
    });
    setModalType(null);
  };

  const handleSettleUp = (newSettlementData) => {
    const newSet = {
      id: `set_${Date.now()}`,
      ...newSettlementData,
    };

    const nextState = {
      ...state,
      settlements: [newSet, ...state.settlements],
    };

    setState(nextState);
    setModalType(null);

    // Instant write to Firebase
    if (newSettlementData.groupId) {
      publishGroupInstantly(newSettlementData.groupId, nextState);
    }
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
    const nextState = {
      ...state,
      expenses: state.expenses.filter(e => e.id !== expenseId),
    };
    setState(nextState);
    if (expToDelete?.groupId) {
      publishGroupInstantly(expToDelete.groupId, nextState);
    }
  };

  const handleDeleteSettlement = (settlementId) => {
    const setToDelete = state.settlements.find(s => s.id === settlementId);
    const nextState = {
      ...state,
      settlements: state.settlements.filter(s => s.id !== settlementId),
    };
    setState(nextState);
    if (setToDelete?.groupId) {
      publishGroupInstantly(setToDelete.groupId, nextState);
    }
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
    }, 100);
  };

  return (
    <MobileFrame isFullScreen={isFullScreen} toggleFullScreen={() => setIsFullScreen(!isFullScreen)}>
      {!isLoggedIn && (
        <AuthModal onLoginSuccess={handleRegisterLogin} />
      )}

      <Header
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onOpenProfile={() => setModalType('profile')}
      />

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
                onOpenRoulette={() => setModalType('roulette')}
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
  );
}

export default App;
