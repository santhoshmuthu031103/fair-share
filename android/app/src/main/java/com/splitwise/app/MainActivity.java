package com.splitwise.app;

import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeEmailPlugin.class);
        registerPlugin(NativeUpdatePlugin.class);
        super.onCreate(savedInstanceState);

        // Request Notification permission on Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // Trigger an immediate native check for update
        UpdateCheckJobService.checkNow(this);

        // Schedule native background worker for periodic update checks (runs even when app is closed)
        UpdateCheckJobService.schedulePeriodicCheck(this);

        // Capture notification intent if app was launched from a notification tap
        NativeUpdatePlugin.handleNotificationIntent(getIntent(), getBridge());
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // Capture notification intent when app is resumed/opened from a notification tap
        NativeUpdatePlugin.handleNotificationIntent(intent, getBridge());
    }
}


