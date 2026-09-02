package com.splitwise.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * FairShareFirebaseMessagingService
 * Handles high-priority background and heads-up push notifications for chat messages,
 * nudges, expenses, and settlements like WhatsApp / Instagram.
 */
public class FairShareFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "FairShareFCMService";
    public static final String CHANNEL_ID = "fairshare_messages_channel";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New device FCM Token: " + token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "Push message received: " + remoteMessage.getData());

        String title = null;
        String body = null;

        // 1. Check standard notification payload
        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }

        // 2. Check custom data payload (works when app is closed / in background)
        Map<String, String> data = remoteMessage.getData();
        if (data != null && !data.isEmpty()) {
            if (title == null || title.isEmpty()) {
                title = data.get("title");
            }
            if (title == null || title.isEmpty()) {
                title = data.get("customTitle");
            }
            if (body == null || body.isEmpty()) {
                body = data.get("body");
            }
            if (body == null || body.isEmpty()) {
                body = data.get("customBody");
            }
            if (body == null || body.isEmpty()) {
                body = data.get("message");
            }
        }

        if (title == null || title.isEmpty()) {
            title = "FairShare";
        }
        if (body == null || body.isEmpty()) {
            body = "New message received in your group";
        }

        showNotification(this, title, body, data);
    }

    private void showNotification(Context context, String title, String body, Map<String, String> data) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // High priority notification channel with sound, vibration, and heads-up banner
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Group Chat & Messages",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Direct notifications for FairShare group chat messages and settlement reminders");
            channel.enableVibration(true);
            channel.setShowBadge(true);
            channel.setVibrationPattern(new long[]{0, 250, 150, 250});
            nm.createNotificationChannel(channel);
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra(entry.getKey(), entry.getValue());
            }
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                (int) System.currentTimeMillis(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher_round)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setSound(defaultSoundUri)
                .setVibrate(new long[]{0, 250, 150, 250})
                .setContentIntent(pendingIntent);

        nm.notify((int) System.currentTimeMillis(), builder.build());
    }
}
