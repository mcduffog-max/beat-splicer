package com.mcduffog.beatsplicer;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
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

/* Updates the app in place: downloads the newest APK and hands it to Android's installer. */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    @PluginMethod
    public void info(PluginCall call) {
        try {
            PackageInfo p = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject r = new JSObject();
            r.put("versionCode", Build.VERSION.SDK_INT >= 28 ? (int) p.getLongVersionCode() : p.versionCode);
            r.put("versionName", p.versionName);
            r.put("canInstall", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /* Android asks once whether this app may install updates; this opens that switch. */
    @PluginMethod
    public void allowInstalls(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void install(PluginCall call) {
        final String url = call.getString("url");
        if (url == null) { call.reject("No download address"); return; }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getExternalFilesDir(null), "updates");
                if (!dir.exists()) dir.mkdirs();
                File apk = new File(dir, "beat-splicer.apk");
                if (apk.exists()) apk.delete();
                String at = url; HttpURLConnection c = null;
                for (int hop = 0; hop < 6; hop++) { // GitHub hands the file over through redirects
                    c = (HttpURLConnection) new URL(at).openConnection();
                    c.setInstanceFollowRedirects(false); c.setConnectTimeout(20000); c.setReadTimeout(60000);
                    int code = c.getResponseCode();
                    if (code >= 300 && code < 400) { at = c.getHeaderField("Location"); c.disconnect(); continue; }
                    if (code != 200) throw new Exception("Download failed (" + code + ")");
                    break;
                }
                long total = c.getContentLengthLong(), got = 0; int last = -1;
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n); got += n;
                        int pct = total > 0 ? (int) (got * 100 / total) : -1;
                        if (pct != last) { last = pct; JSObject ev = new JSObject(); ev.put("percent", pct); notifyListeners("progress", ev); }
                    }
                }
                c.disconnect();
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Download failed");
            }
        }).start();
    }
}
