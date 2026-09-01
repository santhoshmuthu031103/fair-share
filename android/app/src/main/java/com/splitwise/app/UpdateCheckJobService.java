package com.splitwise.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class UpdateCheckJobService extends JobService {
    private static final String TAG = "FairShareUpdateJob";
    private static final int JOB_ID = 9001;
    private static final String CHANNEL_ID = "fairshare_app_updates";
    private static final String GITHUB_LATEST_RELEASE_URL = "https://api.github.com/repos/santhoshmuthu031103/fair-share/releases/latest";
    private static final String PREFS_NAME = "fairshare_update_prefs";
    private static final String KEY_NOTIFIED_VERSION = "last_notified_version";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public static void schedulePeriodicCheck(Context context) {
        try {
            JobScheduler scheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (scheduler == null) return;

            // Check if job is already scheduled
            if (scheduler.getPendingJob(JOB_ID) != null) {
                Log.d(TAG, "Update check job is already scheduled.");
                return;
            }

            ComponentName component = new ComponentName(context, UpdateCheckJobService.class);
            // Periodic check every 4 hours (Android minimum is 15 minutes)
            JobInfo.Builder builder = new JobInfo.Builder(JOB_ID, component)
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setPeriodic(4 * 60 * 60 * 1000L)
                    .setPersisted(true);

            int result = scheduler.schedule(builder.build());
            if (result == JobScheduler.RESULT_SUCCESS) {
                Log.d(TAG, "Update check job scheduled successfully.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule update check job", e);
        }
    }

    public static void checkNow(Context context) {
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                performCheckAndNotify(context);
            } catch (Exception e) {
                Log.e(TAG, "checkNow error", e);
            }
        });
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        executor.execute(() -> {
            try {
                performCheckAndNotify(this);
            } catch (Exception e) {
                Log.e(TAG, "Error checking for update in background job", e);
            } finally {
                jobFinished(params, false);
            }
        });
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    public static void performCheckAndNotify(Context context) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(GITHUB_LATEST_RELEASE_URL);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/vnd.github.v3+json");
            conn.setRequestProperty("User-Agent", "FairShare-Android-App");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            if (conn.getResponseCode() != 200) {
                Log.d(TAG, "GitHub API returned HTTP " + conn.getResponseCode());
                return;
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();

            JSONObject json = new JSONObject(sb.toString());
            String tagName = json.optString("tag_name", "");
            String latestVer = extractVersion(tagName);
            if (latestVer.isEmpty()) return;

            PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            String currentVer = extractVersion(pInfo.versionName);

            Log.d(TAG, "Update Check: Current = " + currentVer + ", Latest = " + latestVer);

            if (isNewerVersion(latestVer, currentVer)) {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String lastNotified = prefs.getString(KEY_NOTIFIED_VERSION, "");

                if (!latestVer.equals(lastNotified)) {
                    // Find the direct APK download URL from release assets
                    String downloadUrl = "https://github.com/santhoshmuthu031103/fair-share/raw/master/FairShare-latest.apk";
                    try {
                        org.json.JSONArray assets = json.optJSONArray("assets");
                        if (assets != null) {
                            for (int i = 0; i < assets.length(); i++) {
                                org.json.JSONObject asset = assets.getJSONObject(i);
                                String assetName = asset.optString("name", "");
                                if (assetName.toLowerCase().endsWith(".apk")) {
                                    downloadUrl = asset.optString("browser_download_url", downloadUrl);
                                    break;
                                }
                            }
                        }
                    } catch (Exception ignored) {}
                    postNotification(context, latestVer, downloadUrl);
                    prefs.edit().putString(KEY_NOTIFIED_VERSION, latestVer).apply();
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to check update", e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static String extractVersion(String ver) {
        if (ver == null) return "";
        Matcher m = Pattern.compile("(\\d+(?:\\.\\d+)+)").matcher(ver);
        if (m.find()) {
            return m.group(1);
        }
        return ver.replaceAll("^v", "").trim();
    }

    private static boolean isNewerVersion(String newVer, String curVer) {
        if (newVer.equals(curVer)) return false;
        String[] newParts = newVer.split("\\.");
        String[] curParts = curVer.split("\\.");
        int max = Math.max(newParts.length, curParts.length);
        for (int i = 0; i < max; i++) {
            int n = 0;
            int c = 0;
            try {
                if (i < newParts.length) n = Integer.parseInt(newParts[i].replaceAll("\\D", ""));
            } catch (Exception ignored) {}
            try {
                if (i < curParts.length) c = Integer.parseInt(curParts[i].replaceAll("\\D", ""));
            } catch (Exception ignored) {}
            if (n > c) return true;
            if (n < c) return false;
        }
        return false;
    }

    private static void postNotification(Context context, String latestVersion, String downloadUrl) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "App Updates",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications when a new version of FairShare is available");
            channel.enableVibration(true);
            channel.setShowBadge(true);
            nm.createNotificationChannel(channel);
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl));
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher_round)
                .setContentTitle("🚀 FairShare Update Available!")
                .setContentText("Version v" + latestVersion + " is ready. Tap to download & update.")
                .setStyle(new NotificationCompat.BigTextStyle()
                        .bigText("A new version of FairShare (v" + latestVersion + ") is available on GitHub. Tap here to download and install."))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        nm.notify(1002, builder.build());
        Log.d(TAG, "Posted background update notification for v" + latestVersion);
    }
}
