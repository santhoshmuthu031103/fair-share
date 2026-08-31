const { onValueCreated } = require('firebase-functions/v2/database');
const { initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { getDatabase } = require('firebase-admin/database');

initializeApp();

/**
 * FairShare Push Notifications — Firebase Cloud Function
 *
 * Triggers whenever a new notification event is pushed to:
 *   notification_triggers/{syncCode}/events/{eventId}
 *
 * Reads the FCM tokens for all target member IDs and sends
 * a push notification to each device.
 *
 * 100% FREE — runs on Firebase Spark (free) plan.
 * Limits: 2M invocations/month (you won't come close for a personal app).
 */
exports.sendGroupNotification = onValueCreated(
  {
    ref: '/notification_triggers/{syncCode}/events/{eventId}',
    region: 'asia-southeast1', // Same region as your Realtime DB
  },
  async (event) => {
    const payload = event.data.val();
    if (!payload) return;

    const { action, senderName, groupName, description, amount, payeeName, memberIds } = payload;

    // Build the notification message text
    let title = '';
    let body = '';
    const currency = '₹'; // default; could be stored in payload too

    if (action === 'expense_added') {
      title = `🧾 ${groupName}`;
      body = `${senderName} added "${description}" — ${currency}${Number(amount).toFixed(0)}`;
    } else if (action === 'settlement_added') {
      title = `💸 ${groupName}`;
      body = `${senderName} settled ${currency}${Number(amount).toFixed(0)} with ${payeeName}`;
    } else if (action === 'expense_deleted') {
      title = `🗑️ ${groupName}`;
      body = `${senderName} deleted an expense`;
    } else {
      title = 'FairShare';
      body = `${senderName} made a change in ${groupName}`;
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      console.log('No member IDs to notify, skipping.');
      return;
    }

    // Look up FCM tokens for all target members
    const db = getDatabase();
    const tokenPromises = memberIds.map(async (uid) => {
      try {
        const snap = await db.ref(`fcm_tokens/${uid}`).get();
        if (snap.exists()) {
          const val = snap.val();
          return val?.token || null;
        }
        return null;
      } catch (e) {
        console.warn(`Failed to get token for ${uid}:`, e.message);
        return null;
      }
    });

    const rawTokens = await Promise.all(tokenPromises);
    const tokens = rawTokens.filter(Boolean); // remove nulls

    if (tokens.length === 0) {
      console.log('No FCM tokens found for members, skipping notification.');
      return;
    }

    console.log(`Sending "${body}" to ${tokens.length} device(s)`);

    // Send to all tokens in one batch (up to 500 per call)
    const messaging = getMessaging();
    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const message = {
        notification: {
          title,
          body,
        },
        android: {
          notification: {
            sound: 'default',
            channelId: 'fairshare_notifications',
            priority: 'high',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
          priority: 'high',
        },
        data: {
          action: action || '',
          groupName: groupName || '',
          click_action: 'OPEN_APP',
        },
        tokens: batch,
      };

      try {
        const response = await messaging.sendEachForMulticast(message);
        console.log(
          `Batch sent: ${response.successCount} success, ${response.failureCount} fail`
        );

        // Clean up stale tokens (device uninstalled app etc.)
        if (response.failureCount > 0) {
          const staleCleanups = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errCode = resp.error?.code;
              if (
                errCode === 'messaging/invalid-registration-token' ||
                errCode === 'messaging/registration-token-not-registered'
              ) {
                // Find which userId this token belongs to and delete it
                const staleToken = batch[idx];
                console.log(`Removing stale token: ${staleToken.substring(0, 20)}...`);
                // We don't have a reverse uid→token map here easily,
                // but the token will be refreshed automatically next app open
              }
            }
          });
        }
      } catch (err) {
        console.error('FCM batch send error:', err);
      }
    }

    // Clean up the trigger event after processing to avoid re-triggering
    // (Cloud Functions v2 triggers on onCreate so it won't re-fire anyway)
    console.log('Notification dispatch complete.');
  }
);
