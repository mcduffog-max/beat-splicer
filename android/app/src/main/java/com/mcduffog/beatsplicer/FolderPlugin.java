package com.mcduffog.beatsplicer;

import android.content.ContentResolver;
import android.content.Intent;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/* Whole folders on the phone: Android's folder picker (Storage Access Framework). The app keeps permission to read the
   folder, so it can be loaded again later without picking every file. */
@CapacitorPlugin(name = "Folder")
public class FolderPlugin extends Plugin {

    @PluginMethod
    public void pick(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, i, "picked");
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (data == null || data.getData() == null) { call.reject("cancelled"); return; }
        Uri tree = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception e) { /* still readable for now */ }
        JSObject r = new JSObject();
        r.put("uri", tree.toString());
        r.put("name", nameOf(tree));
        call.resolve(r);
    }

    private String nameOf(Uri tree) {
        try {
            String id = DocumentsContract.getTreeDocumentId(tree);
            Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree, id);
            try (Cursor c = getContext().getContentResolver().query(doc, new String[] { DocumentsContract.Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
                if (c != null && c.moveToFirst()) return c.getString(0);
            }
            int k = id.lastIndexOf(':');
            return k >= 0 ? id.substring(k + 1) : id;
        } catch (Exception e) { return "folder"; }
    }

    /* Is the folder still readable (permission kept, folder not deleted)? */
    @PluginMethod
    public void check(PluginCall call) {
        String uri = call.getString("uri");
        boolean ok = false;
        for (UriPermission p : getContext().getContentResolver().getPersistedUriPermissions())
            if (p.isReadPermission() && p.getUri().toString().equals(uri)) ok = true;
        JSObject r = new JSObject();
        r.put("ok", ok);
        call.resolve(r);
    }

    /* Every file in the folder and its subfolders (three levels down), newest first. */
    @PluginMethod
    public void list(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) { call.reject("no folder"); return; }
        try {
            Uri tree = Uri.parse(uri);
            JSArray out = new JSArray();
            walk(tree, DocumentsContract.getTreeDocumentId(tree), "", 0, out);
            JSObject r = new JSObject();
            r.put("files", out);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Couldn't read the folder: " + e.getMessage());
        }
    }

    private void walk(Uri tree, String parentId, String rel, int depth, JSArray out) {
        if (depth > 3 || out.length() >= 3000) return;
        ContentResolver cr = getContext().getContentResolver();
        Uri kids = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId);
        String[] cols = { DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED };
        try (Cursor c = cr.query(kids, cols, null, null, null)) {
            if (c == null) return;
            while (c.moveToNext()) {
                String id = c.getString(0), name = c.getString(1), mime = c.getString(2);
                if (name == null || name.startsWith(".")) continue;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) { walk(tree, id, rel + name + "/", depth + 1, out); continue; }
                JSObject f = new JSObject();
                f.put("uri", DocumentsContract.buildDocumentUriUsingTree(tree, id).toString());
                f.put("name", name);
                f.put("path", rel + name);
                f.put("mime", mime == null ? "" : mime);
                f.put("size", c.isNull(3) ? 0 : c.getLong(3));
                f.put("mtime", c.isNull(4) ? 0 : c.getLong(4));
                out.put(f);
            }
        }
    }

    /* Copies one file into the app's cache, so the page can read it; the page removes the copy once it has its own. */
    @PluginMethod
    public void copy(PluginCall call) {
        String uri = call.getString("uri");
        try {
            File dir = new File(getContext().getCacheDir(), "folder-in");
            dir.mkdirs();
            File dst = new File(dir, "f" + System.nanoTime());
            try (InputStream in = getContext().getContentResolver().openInputStream(Uri.parse(uri)); OutputStream out = new FileOutputStream(dst)) {
                if (in == null) throw new Exception("the file couldn't be opened");
                byte[] buf = new byte[1 << 20];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            JSObject r = new JSObject();
            r.put("path", dst.getAbsolutePath());
            r.put("size", dst.length());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Couldn't copy the file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String path = call.getString("path");
        File dir = new File(getContext().getCacheDir(), "folder-in");
        if (path != null && path.startsWith(dir.getAbsolutePath())) new File(path).delete();
        call.resolve();
    }
}
