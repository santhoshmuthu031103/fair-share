/**
 * Utilities for cross-device user identity matching and data reconciliation
 */

export const normalizePhone = (phone) => {
  if (!phone) return '';
  // Strip all non-digit characters
  const digits = String(phone).replace(/\D/g, '');
  // Take last 10 digits for matching Indian/US mobile numbers
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

export const normalizeEmail = (email) => {
  if (!email) return '';
  return String(email).trim().toLowerCase();
};

const bHasId = (userB, idA) => {
  return userB.id === idA;
};

export const isSamePerson = (userA, userB) => {
  if (!userA || !userB) return false;
  if (userA.id && bHasId(userB, userA.id)) return true;

  const phoneA = normalizePhone(userA.phone);
  const phoneB = normalizePhone(userB.phone);
  if (phoneA && phoneB && phoneA === phoneB) return true;

  const emailA = normalizeEmail(userA.email);
  const emailB = normalizeEmail(userB.email);
  if (emailA && emailB && emailA === emailB) return true;

  // Name match fallback if normalized phone or email matches partly
  const nameA = String(userA.name || '').trim().toLowerCase();
  const nameB = String(userB.name || '').trim().toLowerCase();
  if (nameA && nameB && nameA === nameB) {
    if (phoneA && phoneB && phoneA === phoneB) return true;
    if (emailA && emailB && emailA === emailB) return true;
  }

  return false;
};

/**
 * Reconciles incoming cloud data against the local phone's user profile (myProfile)
 * Replaces any temporary contact ID created by the other phone with myProfile.id
 * and cleans up duplicate members.
 */
export const reconcileCloudData = (cloudData, myProfile, localFriends = []) => {
  if (!cloudData) return cloudData;

  const incomingGroup = cloudData.group || {};
  const incomingExps = cloudData.expenses || [];
  const incomingSets = cloudData.settlements || [];
  const incomingMembers = Array.isArray(cloudData.members) ? cloudData.members : [];

  // Build ID mapping: map any contact that matches myProfile to myProfile.id
  const idMap = {};
  if (myProfile && myProfile.id) {
    incomingMembers.forEach(m => {
      if (m.id !== myProfile.id && isSamePerson(m, myProfile)) {
        idMap[m.id] = myProfile.id;
      }
    });
  }

  // Also map known local friends
  localFriends.forEach(lf => {
    incomingMembers.forEach(m => {
      if (m.id !== lf.id && isSamePerson(m, lf)) {
        idMap[m.id] = lf.id;
      }
    });
  });

  const mapId = (id) => idMap[id] || id;

  // 1. Reconcile expenses
  const reconciledExps = incomingExps.map(exp => {
    const newPaidBy = mapId(exp.paidBy);
    const newRecipients = (exp.recipientIds || []).map(mapId);
    const newSplits = {};
    if (exp.splits) {
      Object.entries(exp.splits).forEach(([uId, val]) => {
        newSplits[mapId(uId)] = val;
      });
    }
    return {
      ...exp,
      paidBy: newPaidBy,
      recipientIds: [...new Set(newRecipients)],
      splits: newSplits,
    };
  });

  // 2. Reconcile settlements
  const reconciledSets = incomingSets.map(set => ({
    ...set,
    payerId: mapId(set.payerId),
    payeeId: mapId(set.payeeId),
  }));

  // 3. Reconcile members (deduplicate & update latest avatars/names!)
  const memberMap = new Map();
  
  // Always include myProfile as authoritative for local device owner
  if (myProfile && myProfile.id) {
    memberMap.set(myProfile.id, myProfile);
  }

  incomingMembers.forEach(m => {
    if (!m) return;
    const canonicalId = mapId(m.id);
    if (canonicalId === myProfile?.id) {
      // Don't overwrite local device owner with stale data
      return;
    }
    const existing = memberMap.get(canonicalId);
    if (!existing) {
      memberMap.set(canonicalId, { ...m, id: canonicalId });
    } else {
      memberMap.set(canonicalId, {
        ...existing,
        ...m,
        id: canonicalId,
        avatar: m.avatar || existing.avatar,
        name: m.name || existing.name,
        phone: m.phone || existing.phone,
        email: m.email || existing.email,
        color: m.color || existing.color,
      });
    }
  });

  const reconciledMembers = Array.from(memberMap.values());
  const reconciledGroupMemberIds = [...new Set((incomingGroup.members || []).map(mapId))];

  const reconciledGroup = {
    ...incomingGroup,
    members: reconciledGroupMemberIds,
  };

  return {
    group: reconciledGroup,
    expenses: reconciledExps,
    settlements: reconciledSets,
    members: reconciledMembers,
  };
};

/**
 * Reconciles an incoming direct (non-group) expense payload from Firebase against local user profile
 */
export const reconcileDirectExpense = (payload, myProfile, localFriends = []) => {
  if (!payload) return null;
  if (payload.deleted) {
    return { deleted: true, id: payload.id || payload.expense?.id };
  }

  const rawExp = payload.expense || payload;
  if (!rawExp || !rawExp.id) return null;

  const incomingMembers = [
    ...(Array.isArray(payload.members) ? payload.members : []),
    ...(payload.authorProfile ? [payload.authorProfile] : [])
  ].filter(Boolean);

  // Build ID mapping: map any contact that matches myProfile to myProfile.id
  const idMap = {};
  if (myProfile && myProfile.id) {
    incomingMembers.forEach(m => {
      if (m.id !== myProfile.id && isSamePerson(m, myProfile)) {
        idMap[m.id] = myProfile.id;
      }
    });
  }

  // Also map known local friends
  localFriends.forEach(lf => {
    incomingMembers.forEach(m => {
      if (m.id !== lf.id && isSamePerson(m, lf)) {
        idMap[m.id] = lf.id;
      }
    });
  });

  const mapId = (id) => idMap[id] || id;

  const newPaidBy = mapId(rawExp.paidBy);
  const newRecipients = (rawExp.recipientIds || []).map(mapId);
  const newSplits = {};
  if (rawExp.splits) {
    Object.entries(rawExp.splits).forEach(([uId, val]) => {
      newSplits[mapId(uId)] = val;
    });
  }

  const reconciledExpense = {
    ...rawExp,
    paidBy: newPaidBy,
    recipientIds: [...new Set(newRecipients)],
    splits: newSplits,
  };

  // Reconcile new/updated friends from author & participants
  const reconciledFriends = [];
  incomingMembers.forEach(m => {
    if (!m || !m.id) return;
    const canonicalId = mapId(m.id);
    if (canonicalId === myProfile?.id) return;
    reconciledFriends.push({
      ...m,
      id: canonicalId,
    });
  });

  return {
    deleted: false,
    expense: reconciledExpense,
    friends: reconciledFriends,
  };
};

/**
 * Reconciles an incoming direct (non-group) settlement payload from Firebase against local user profile
 */
export const reconcileDirectSettlement = (payload, myProfile, localFriends = []) => {
  if (!payload) return null;
  if (payload.deleted) {
    return { deleted: true, id: payload.id || payload.settlement?.id };
  }

  const rawSet = payload.settlement || payload;
  if (!rawSet || !rawSet.id) return null;

  const incomingMembers = [
    ...(Array.isArray(payload.members) ? payload.members : []),
    ...(payload.authorProfile ? [payload.authorProfile] : [])
  ].filter(Boolean);

  const idMap = {};
  if (myProfile && myProfile.id) {
    incomingMembers.forEach(m => {
      if (m.id !== myProfile.id && isSamePerson(m, myProfile)) {
        idMap[m.id] = myProfile.id;
      }
    });
  }

  localFriends.forEach(lf => {
    incomingMembers.forEach(m => {
      if (m.id !== lf.id && isSamePerson(m, lf)) {
        idMap[m.id] = lf.id;
      }
    });
  });

  const mapId = (id) => idMap[id] || id;

  const reconciledSettlement = {
    ...rawSet,
    payerId: mapId(rawSet.payerId),
    payeeId: mapId(rawSet.payeeId),
  };

  const reconciledFriends = [];
  incomingMembers.forEach(m => {
    if (!m || !m.id) return;
    const canonicalId = mapId(m.id);
    if (canonicalId === myProfile?.id) return;
    reconciledFriends.push({
      ...m,
      id: canonicalId,
    });
  });

  return {
    deleted: false,
    settlement: reconciledSettlement,
    friends: reconciledFriends,
  };
};

