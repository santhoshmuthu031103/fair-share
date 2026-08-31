package com.splitwise.app;

import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeEmail")
public class NativeEmailPlugin extends Plugin {
    private static final String TAG = "NativeEmailPlugin";

    @PluginMethod
    public void openGmail(PluginCall call) {
        String to = call.getString("to", "");
        String subject = call.getString("subject", "");
        String body = call.getString("body", "");

        try {
            // Build proper mailto: URI with subject and body encoded in the URI string
            // This is required because Gmail's ACTION_SENDTO reads query parameters from the URI
            StringBuilder uriBuilder = new StringBuilder("mailto:");
            if (to != null && !to.trim().isEmpty()) {
                uriBuilder.append(Uri.encode(to.trim()));
            }
            
            boolean hasParam = false;
            if (subject != null && !subject.isEmpty()) {
                uriBuilder.append("?subject=").append(Uri.encode(subject));
                hasParam = true;
            }
            if (body != null && !body.isEmpty()) {
                uriBuilder.append(hasParam ? "&body=" : "?body=").append(Uri.encode(body));
            }

            Uri mailtoUri = Uri.parse(uriBuilder.toString());

            // Priority 1: Target Gmail app specifically with ACTION_SENDTO and URI + Extras
            Intent gmailIntent = new Intent(Intent.ACTION_SENDTO, mailtoUri);
            if (to != null && !to.trim().isEmpty()) {
                gmailIntent.putExtra(Intent.EXTRA_EMAIL, new String[]{to.trim()});
            }
            if (subject != null) {
                gmailIntent.putExtra(Intent.EXTRA_SUBJECT, subject);
            }
            if (body != null) {
                gmailIntent.putExtra(Intent.EXTRA_TEXT, body);
            }
            gmailIntent.setPackage("com.google.android.gm");
            gmailIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (gmailIntent.resolveActivity(getContext().getPackageManager()) != null) {
                getContext().startActivity(gmailIntent);
                JSObject ret = new JSObject();
                ret.put("status", "opened_gmail");
                call.resolve(ret);
                return;
            }

            // Priority 2: Standard ACTION_SENDTO without package restriction (default mail client)
            Intent defaultEmailIntent = new Intent(Intent.ACTION_SENDTO, mailtoUri);
            if (to != null && !to.trim().isEmpty()) {
                defaultEmailIntent.putExtra(Intent.EXTRA_EMAIL, new String[]{to.trim()});
            }
            if (subject != null) {
                defaultEmailIntent.putExtra(Intent.EXTRA_SUBJECT, subject);
            }
            if (body != null) {
                defaultEmailIntent.putExtra(Intent.EXTRA_TEXT, body);
            }
            defaultEmailIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (defaultEmailIntent.resolveActivity(getContext().getPackageManager()) != null) {
                getContext().startActivity(defaultEmailIntent);
                JSObject ret = new JSObject();
                ret.put("status", "opened_email_app");
                call.resolve(ret);
                return;
            }

            // Priority 3: Fallback using ACTION_SEND chooser
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType("text/plain");
            if (to != null && !to.trim().isEmpty()) {
                sendIntent.putExtra(Intent.EXTRA_EMAIL, new String[]{to.trim()});
            }
            if (subject != null) {
                sendIntent.putExtra(Intent.EXTRA_SUBJECT, subject);
            }
            if (body != null) {
                sendIntent.putExtra(Intent.EXTRA_TEXT, body);
            }
            sendIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            Intent chooser = Intent.createChooser(sendIntent, "Send Email");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("status", "opened_chooser");
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error opening email intent", e);
            try {
                // Priority 4: Fallback ACTION_VIEW
                String fallback = "mailto:" + (to != null ? Uri.encode(to.trim()) : "") +
                        "?subject=" + (subject != null ? Uri.encode(subject) : "") +
                        "&body=" + (body != null ? Uri.encode(body) : "");
                Intent viewIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(fallback));
                viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(viewIntent);

                JSObject ret = new JSObject();
                ret.put("status", "opened_view");
                call.resolve(ret);
            } catch (Exception ex) {
                Log.e(TAG, "Failed to launch any email app", ex);
                call.reject("Failed to launch email application: " + ex.getMessage());
            }
        }
    }
}
