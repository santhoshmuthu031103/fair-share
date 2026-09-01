package com.splitwise.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeEmailPlugin.class);
        super.onCreate(savedInstanceState);

        // Schedule native background worker for periodic update checks (runs even when app is closed)
        UpdateCheckJobService.schedulePeriodicCheck(this);
    }
}

