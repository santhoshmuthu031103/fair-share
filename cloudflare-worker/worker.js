/**
 * FairShare — Cloudflare Worker for Push Notifications (FCM HTTP v1 API)
 * 100% FREE & modern — uses Firebase Service Account Private Key with Web Crypto.
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }
    if (request.method !== 'POST') {
      return corsResponse({ error: 'Method not allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse({ error: 'Invalid JSON' }, 400);
    }

    if (body.secret !== env.NOTIFY_SECRET) {
      return corsResponse({ error: 'Unauthorized' }, 401);
    }

    const { 
      action, 
      senderName = 'Someone', 
      groupName = 'FairShare', 
      description, 
      amount, 
      payeeName, 
      targetUserName,
      memberIds, 
      currency = '₹',
      customTitle,
      customBody
    } = body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return corsResponse({ ok: true, message: 'No members to notify' });
    }

    // Build notification text
    let title = groupName ? `FairShare • ${groupName}` : 'FairShare';
    let notifBody = '';

    if (customTitle && customBody) {
      title = customTitle;
      notifBody = customBody;
    } else if (action === 'expense_added') {
      title = `🧾 ${groupName}`;
      notifBody = `${senderName} added "${description || 'Expense'}" — ${currency}${Number(amount || 0).toFixed(0)}`;
    } else if (action === 'settlement_added') {
      title = `💸 ${groupName}`;
      notifBody = `${senderName} settled ${currency}${Number(amount || 0).toFixed(0)} with ${payeeName || 'friend'}`;
    } else if (action === 'member_added') {
      title = `👥 ${groupName}`;
      notifBody = targetUserName 
        ? `${senderName} added ${targetUserName} to the group`
        : `${senderName} added you to "${groupName}"!`;
    } else if (action === 'member_removed') {
      title = `🚪 ${groupName}`;
      notifBody = targetUserName
        ? `${senderName} removed ${targetUserName} from the group`
        : `${senderName} removed you from "${groupName}"`;
    } else if (action === 'member_left') {
      title = `👋 ${groupName}`;
      notifBody = `${senderName} left the group`;
    } else if (action === 'group_created') {
      title = `🎉 ${groupName}`;
      notifBody = `${senderName} created the group and added you!`;
    } else if (action === 'group_deleted') {
      title = `⚠️ ${groupName}`;
      notifBody = `${senderName} deleted the group`;
    } else if (action === 'expense_deleted') {
      title = `🗑️ ${groupName}`;
      notifBody = `${senderName} deleted "${description || 'an expense'}"`;
    } else if (action === 'settlement_deleted') {
      title = `🗑️ ${groupName}`;
      notifBody = `${senderName} deleted a settlement`;
    } else if (action === 'chat_message') {
      title = customTitle || `💬 ${groupName}`;
      notifBody = customBody || `${senderName}: sent a message`;
    } else if (action === 'nudge_settle') {
      title = customTitle || `🔔 ${groupName}`;
      notifBody = customBody || `${senderName} reminded everyone to settle balances!`;
    } else {
      title = `🔔 ${groupName}`;
      notifBody = `${senderName} made an update in ${groupName}`;
    }

    // Use tokens directly provided by client if available
    let tokens = Array.isArray(body.tokens) ? body.tokens.filter(Boolean) : [];

    // Otherwise fetch member FCM tokens from Firebase Realtime DB
    if (tokens.length === 0) {
      const dbUrl = env.FIREBASE_DB_URL;
      const tokenFetches = memberIds.map(async (uid) => {
        try {
          const res = await fetch(`${dbUrl}/fcm_tokens/${uid}.json`);
          if (!res.ok) return null;
          const data = await res.json();
          return data?.token || null;
        } catch {
          return null;
        }
      });

      const rawTokens = await Promise.all(tokenFetches);
      tokens = rawTokens.filter(Boolean);
    }

    if (tokens.length === 0) {
      return corsResponse({ ok: true, message: 'No FCM tokens found for members' });
    }

    // Get Google OAuth2 Access Token for FCM v1
    let accessToken;
    try {
      const rawSa = env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT;
      const sa = typeof rawSa === 'object' ? rawSa : JSON.parse(rawSa);
      accessToken = await getGoogleAccessToken(sa);
    } catch (err) {
      return corsResponse({ error: 'Failed to generate OAuth token: ' + err.message }, 500);
    }

    const projectId = env.FIREBASE_PROJECT_ID || 'split-app-60045';
    const fcmV1Url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // Send push notification to each target device
    const sendResults = await Promise.all(
      tokens.map(async (token) => {
        const fcmPayload = {
          message: {
            token,
            notification: {
              title,
              body: notifBody,
            },
            android: {
              priority: 'HIGH',
              notification: {
                sound: 'default',
                channel_id: 'fairshare_messages_channel',
                default_sound: true,
                default_vibrate_timings: true,
              },
            },
            data: {
              action: action || '',
              groupName: groupName || '',
              title: title || '',
              body: notifBody || '',
            },
          },
        };

        try {
          const res = await fetch(fcmV1Url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(fcmPayload),
          });
          return res.ok;
        } catch {
          return false;
        }
      })
    );

    const successCount = sendResults.filter(Boolean).length;
    return corsResponse({ ok: true, sent: successCount, total: tokens.length });
  },
};

// --- Google OAuth2 JWT Generator (Web Crypto) ---
async function getGoogleAccessToken(sa) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  const cryptoKey = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const jwt = `${signatureInput}.${base64UrlEncode(signature)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description || 'OAuth failed');
  }
  return tokenData.access_token;
}

function base64UrlEncode(input) {
  let bytes;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function importPrivateKey(pem) {
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = pem
    .replace(/\\n/g, '\n')
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function corsResponse(data, status = 200) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  return new Response(data ? JSON.stringify(data) : null, { status, headers });
}
