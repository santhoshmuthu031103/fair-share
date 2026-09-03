package com.splitwise.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeUpdate")
public class NativeUpdatePlugin extends Plugin {
    private static final String TAG = "NativeUpdatePlugin";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public static JSObject pendingNotification = null;
    private static NativeUpdatePlugin instance = null;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void handleNotificationIntent(Intent intent, com.getcapacitor.Bridge bridge) {
        if (intent == null || intent.getExtras() == null) return;
        android.os.Bundle extras = intent.getExtras();
        if (extras.containsKey("action") || extras.containsKey("groupId") || extras.containsKey("syncCode") || extras.containsKey("latestVersion")) {
            JSObject data = new JSObject();
            for (String key : extras.keySet()) {
                Object val = extras.get(key);
                if (val != null) {
                    data.put(key, val.toString());
                }
            }
            pendingNotification = data;
            Log.d(TAG, "Notification intent captured: " + data.toString());

            if (instance != null) {
                instance.notifyListeners("notificationOpened", data, true);
            }
            if (bridge != null) {
                bridge.triggerWindowJSEvent("fairshare_notification_opened", data.toString());
            }
        }
    }

    @PluginMethod
    public void getPendingNotification(PluginCall call) {
        JSObject ret = new JSObject();
        if (pendingNotification != null) {
            ret.put("notification", pendingNotification);
            pendingNotification = null;
        } else {
            ret.put("notification", null);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void canRequestInstalls(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            boolean canInstall = getContext().getPackageManager().canRequestPackageInstalls();
            ret.put("canInstall", canInstall);
        } else {
            ret.put("canInstall", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String downloadUrl = call.getString("url", "");
        if (downloadUrl == null || downloadUrl.trim().isEmpty()) {
            call.reject("Download URL is empty");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection connection = null;
            InputStream input = null;
            FileOutputStream output = null;

            try {
                Log.d(TAG, "Starting native download from: " + downloadUrl);
                URL url = new URL(downloadUrl.trim());
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestProperty("User-Agent", "FairShare-InApp-Updater");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(true);
                connection.connect();

                // Handle HTTP redirects (GitHub 302/301 redirects)
                int responseCode = connection.getResponseCode();
                if (responseCode == HttpURLConnection.HTTP_MOVED_PERM || 
                    responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
                    responseCode == 307 || responseCode == 308) {
                    String newUrl = connection.getHeaderField("Location");
                    connection.disconnect();
                    url = new URL(newUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestProperty("User-Agent", "FairShare-InApp-Updater");
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(30000);
                    connection.connect();
                    responseCode = connection.getResponseCode();
                }

                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new Exception("Server returned HTTP " + responseCode);
                }

                int fileLength = connection.getContentLength();

                // Store in external cache dir (accessible by FileProvider)
                File cacheDir = getContext().getExternalCacheDir();
                if (cacheDir == null) {
                    cacheDir = getContext().getCacheDir();
                }
                File outputFile = new File(cacheDir, "FairShare-update.apk");
                if (outputFile.exists()) {
                    outputFile.delete();
                }

                input = connection.getInputStream();
                output = new FileOutputStream(outputFile);

                byte[] data = new byte[8192];
                long total = 0;
                int count;
                long lastProgressTime = 0;

                while ((count = input.read(data)) != -1) {
                    total += count;
                    output.write(data, 0, count);

                    long now = System.currentTimeMillis();
                    if (now - lastProgressTime > 200 || total == fileLength) {
                        lastProgressTime = now;
                        int percent = fileLength > 0 ? (int) ((total * 100) / fileLength) : -1;
                        JSObject progressObj = new JSObject();
                        progressObj.put("bytesDownloaded", total);
                        progressObj.put("totalBytes", fileLength);
                        progressObj.put("percent", percent);
                        notifyListeners("downloadProgress", progressObj);
                    }
                }

                output.flush();
                output.close();
                input.close();
                connection.disconnect();

                Log.d(TAG, "Download finished successfully. File size: " + outputFile.length());

                // Notify 100% complete
                JSObject progressObj = new JSObject();
                progressObj.put("percent", 100);
                notifyListeners("downloadProgress", progressObj);

                // Launch Android PackageInstaller via FileProvider
                Context context = getContext();
                Uri apkUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        outputFile
                );

                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                context.startActivity(installIntent);

                JSObject ret = new JSObject();
                ret.put("status", "install_launched");
                call.resolve(ret);

            } catch (Exception e) {
                Log.e(TAG, "Native in-app update failed", e);
                JSObject errorObj = new JSObject();
                errorObj.put("error", e.getMessage());
                notifyListeners("downloadError", errorObj);
                call.reject("Download or install failed: " + e.getMessage());
            } finally {
                try {
                    if (output != null) output.close();
                    if (input != null) input.close();
                    if (connection != null) connection.disconnect();
                } catch (Exception ignored) {}
            }
        });
    }
}
