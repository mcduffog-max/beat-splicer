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
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, i, "picked");
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (data == null || data.getData() == null) { call.reject("cancelled"); return; }
        Uri tree = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception e) {
            try { getContext().getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception e2) { /* still readable for now */ }
        }
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
        boolean ok = false, write = false;
        for (UriPermission p : getContext().getContentResolver().getPersistedUriPermissions())
            if (p.getUri().toString().equals(uri)) { if (p.isReadPermission()) ok = true; if (p.isWritePermission()) write = true; }
        JSObject r = new JSObject();
        r.put("ok", ok);
        r.put("write", write);
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
                f.put("parent", DocumentsContract.buildDocumentUriUsingTree(tree, parentId).toString());
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

    /* A subfolder (several levels, "People/Beach 12 Oct") inside the chosen folder, made if it isn't there yet. */
    @PluginMethod
    public void mkdirs(PluginCall call) {
        String uri = call.getString("uri"), path = call.getString("path");
        if (uri == null || path == null) { call.reject("no folder"); return; }
        try {
            Uri tree = Uri.parse(uri);
            ContentResolver cr = getContext().getContentResolver();
            String parentId = DocumentsContract.getTreeDocumentId(tree);
            Uri dir = DocumentsContract.buildDocumentUriUsingTree(tree, parentId);
            for (String part : path.split("/")) {
                if (part.trim().isEmpty()) continue;
                String found = null;
                Uri kids = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId);
                String[] cols = { DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE };
                try (Cursor c = cr.query(kids, cols, null, null, null)) {
                    if (c != null) while (c.moveToNext()) {
                        if (part.equals(c.getString(1)) && DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(2))) { found = c.getString(0); break; }
                    }
                }
                if (found != null) { parentId = found; dir = DocumentsContract.buildDocumentUriUsingTree(tree, found); }
                else {
                    Uri made = DocumentsContract.createDocument(cr, dir, DocumentsContract.Document.MIME_TYPE_DIR, part);
                    if (made == null) throw new Exception("couldn't make the folder " + part);
                    dir = made; parentId = DocumentsContract.getDocumentId(made);
                }
            }
            JSObject r = new JSObject();
            r.put("dir", dir.toString());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Couldn't make the folder: " + e.getMessage());
        }
    }

    /* Moves a file into another folder of the chosen folder. Android moves it in place when it can (nothing is copied);
       otherwise it is copied across and the original removed once the copy is complete. */
    @PluginMethod
    public void move(PluginCall call) {
        String doc = call.getString("doc"), from = call.getString("from"), to = call.getString("to");
        if (doc == null || from == null || to == null) { call.reject("missing file or folder"); return; }
        ContentResolver cr = getContext().getContentResolver();
        try {
            Uri moved = null;
            try { moved = DocumentsContract.moveDocument(cr, Uri.parse(doc), Uri.parse(from), Uri.parse(to)); }
            catch (Exception e) { moved = null; }
            if (moved == null) {
                Uri src = Uri.parse(doc);
                String name = "file", mime = "application/octet-stream";
                try (Cursor c = cr.query(src, new String[] { DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE }, null, null, null)) {
                    if (c != null && c.moveToFirst()) { name = c.getString(0); if (c.getString(1) != null) mime = c.getString(1); }
                }
                Uri dst = DocumentsContract.createDocument(cr, Uri.parse(to), mime, name);
                if (dst == null) throw new Exception("couldn't make the copy");
                long n = 0, want = -1;
                try (Cursor c = cr.query(src, new String[] { DocumentsContract.Document.COLUMN_SIZE }, null, null, null)) {
                    if (c != null && c.moveToFirst() && !c.isNull(0)) want = c.getLong(0);
                }
                try (InputStream in = cr.openInputStream(src); OutputStream out = cr.openOutputStream(dst)) {
                    if (in == null || out == null) throw new Exception("the file couldn't be opened");
                    byte[] buf = new byte[1 << 20]; int k;
                    while ((k = in.read(buf)) > 0) { out.write(buf, 0, k); n += k; }
                }
                if (want >= 0 && n != want) { DocumentsContract.deleteDocument(cr, dst); throw new Exception("the copy was incomplete"); }
                DocumentsContract.deleteDocument(cr, src);
                moved = dst;
            }
            JSObject r = new JSObject();
            r.put("doc", moved.toString());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Couldn't move the file: " + e.getMessage());
        }
    }
}
