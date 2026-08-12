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

  // 3. Reconcile members (deduplicate!)
  const memberMap = new Map();
  
  // Always include myProfile
  if (myProfile && myProfile.id) {
    memberMap.set(myProfile.id, myProfile);
  }

  incomingMembers.forEach(m => {
    const canonicalId = mapId(m.id);
    if (!memberMap.has(canonicalId)) {
      memberMap.set(canonicalId, { ...m, id: canonicalId });
    }
  });

  const reconciledMembers = Array.from(memberMap.values());
  const reconciledGroupMemberIds = [...new Set((incomingGroup.members || []).map(mapId))];

  // Ensure myProfile is in group members if this group belongs to this user
  if (myProfile && myProfile.id && !reconciledGroupMemberIds.includes(myProfile.id)) {
    reconciledGroupMemberIds.push(myProfile.id);
  }

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
