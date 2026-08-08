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
import { SettleUpModal } from './components/Debts/SettleUpModal';
import { ActivityFeed } from './components/Activity/ActivityFeed';
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

            // Merge friends without duplicates
            const mergedFriendIds = new Set(prev.friends.map(f => f.id));
            const newFriends = [...prev.friends, ...incomingMembers.filter(m => !mergedFriendIds.has(m.id))];

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
    let myId = localStorage.getItem('splitwise_my_user_id');
    if (!myId) {
      myId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem('splitwise_my_user_id', myId);
    }
    const profileWithId = { ...userProfile, id: myId };
    localStorage.setItem('splitwise_is_logged_in', 'true');
    localStorage.setItem('splitwise_user_profile', JSON.stringify(profileWithId));
    setIsLoggedIn(true);

    setState(prev => {
      const withoutMe = prev.friends.filter(f => f.id !== myId && f.id !== CURRENT_USER_ID);
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

    const updatedMembers = [...new Set([...(grp.members || []), ...memberIds])];
    const updatedGrp = { ...grp, members: updatedMembers };

    const nextState = {
      ...state,
      groups: state.groups.map(g => g.id === groupId ? updatedGrp : g),
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
    setState(prev => ({
      ...prev,
      friends: [...prev.friends, newFriendData],
    }));
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
        g.id === groupId ? { ...g, simplifyDebts: g.simplifyDebts === false } : g
      ),
    };
    setState(nextState);
    publishGroupInstantly(groupId, nextState);
  };

  const handleDeleteExpense = (expenseId) => {
    const expToDelete = state.expenses.find(e => e.id === expenseId);
    if (window.confirm('Delete this expense?')) {
      const nextState = {
        ...state,
        expenses: state.expenses.filter(e => e.id !== expenseId),
      };
      setState(nextState);
      if (expToDelete?.groupId) {
        publishGroupInstantly(expToDelete.groupId, nextState);
      }
    }
  };

  const handleDeleteSettlement = (settlementId) => {
    const setToDelete = state.settlements.find(s => s.id === settlementId);
    if (window.confirm('Delete this settlement record?')) {
      const nextState = {
        ...state,
        settlements: state.settlements.filter(s => s.id !== settlementId),
      };
      setState(nextState);
      if (setToDelete?.groupId) {
        publishGroupInstantly(setToDelete.groupId, nextState);
      }
    }
  };

  const handleDeleteGroup = (groupId) => {
    const grp = state.groups.find(g => g.id === groupId);
    const syncCode = grp?.syncCode || generateSyncCode(groupId);
    
    // Broadcast deletion to Firebase so all friends' devices remove this group in real-time
    deleteCloudGroup(syncCode);

    setState(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.id !== groupId),
      expenses: prev.expenses.filter(e => e.groupId !== groupId),
      settlements: prev.settlements.filter(s => s.groupId !== groupId),
    }));
    setSelectedGroup(null);
  };

  const handleDeleteFriend = (friendId) => {
    if (friendId === currentUser.id) return; // Cannot delete device owner
    if (window.confirm('Remove this friend from contacts?')) {
      setState(prev => ({
        ...prev,
        friends: prev.friends.filter(f => f.id !== friendId),
      }));
    }
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

    // Reconcile and unify user identity
    const cloudData = reconcileCloudData(rawCloudData, currentUser, state.friends);

    const incomingGroup   = cloudData.group       || {};
    const incomingExps    = cloudData.expenses    || [];
    const incomingSets    = cloudData.settlements || [];
    const incomingMembers = Array.isArray(cloudData.members) ? cloudData.members : [];

    let myProfile = currentUser;

    setState(prev => {
      const otherExps = prev.expenses.filter(e => e.groupId !== incomingGroup.id);
      const newExps = [...otherExps, ...incomingExps];

      const otherSets = prev.settlements.filter(s => s.groupId !== incomingGroup.id);
      const newSets = [...otherSets, ...incomingSets];

      const allIncomingMembers = myProfile
        ? [...incomingMembers.filter(m => m.id !== myProfile.id), myProfile]
        : incomingMembers;
      const mergedFriendIds = new Set(prev.friends.map(f => f.id));
      const newFriends = [...prev.friends, ...allIncomingMembers.filter(m => !mergedFriendIds.has(m.id))];

      const myId = myProfile?.id;
      const updatedMemberIds = myId && !incomingGroup.members?.includes(myId)
        ? [...(incomingGroup.members || []), myId]
        : (incomingGroup.members || []);
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
        {selectedGroup ? (
          <GroupDetail
            group={groups.find(g => g.id === selectedGroup.id) || selectedGroup}
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
            {activeTab === 'dashboard' && (
              <DashboardView
                groups={groups}
                expenses={expenses}
                settlements={settlements}
                friends={friends}
                currency={activeCurrency}
                currentUser={currentUser}
                onSelectGroup={handleSelectGroup}
                onCreateGroup={() => setModalType('create_group')}
                onOpenAddExpense={() => setModalType('add_expense')}
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
                expenses={expenses}
                settlements={settlements}
                currency={activeCurrency}
                currentUser={currentUser}
                onOpenAddFriend={() => setModalType('add_friend')}
                onOpenSettleUp={openSettleUpModal}
                onDeleteFriend={handleDeleteFriend}
              />
            )}

            {activeTab === 'activity' && (
              <ActivityFeed
                expenses={expenses}
                settlements={settlements}
                groups={groups}
                friends={friends}
                currency={activeCurrency}
                currentUser={currentUser}
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
        onOpenAddExpense={() => setModalType('add_expense')}
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
          onClose={() => setModalType(null)}
          onAddExpense={handleAddExpense}
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
