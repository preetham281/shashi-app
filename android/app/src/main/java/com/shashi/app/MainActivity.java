package com.shashi.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends AppCompatActivity {
    private static final int PICK_MEDIA = 301;
    private static final int REQUEST_CAMERA = 302;

    private LinearLayout root;
    private LinearLayout content;
    private SharedPreferences prefs;
    private String apiBase;
    private String token = "";
    private String username = "";
    private String selectedUpload = "story";
    private boolean darkMode = false;
    private int primary = Color.rgb(37, 99, 235);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("shashi_native", MODE_PRIVATE);
        apiBase = prefs.getString("apiBase", "http://10.0.2.2:5000");
        token = prefs.getString("token", "");
        username = prefs.getString("username", "");
        darkMode = prefs.getBoolean("darkMode", false);
        primary = prefs.getInt("primary", Color.rgb(37, 99, 235));
        buildShell();
        showHome();
    }

    private void buildShell() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(darkMode ? Color.rgb(15, 23, 42) : Color.rgb(241, 245, 249));

        TextView title = text("SHASHI Native Android", 22, true);
        title.setPadding(24, 22, 24, 12);
        root.addView(title);

        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(18, 12, 18, 12);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));

        LinearLayout nav = new LinearLayout(this);
        nav.setOrientation(LinearLayout.HORIZONTAL);
        nav.setGravity(Gravity.CENTER);
        nav.setPadding(6, 8, 6, 8);
        nav.addView(navButton("Chat", v -> showChat()));
        nav.addView(navButton("Reels", v -> showReels()));
        nav.addView(navButton("Status", v -> showStories()));
        nav.addView(navButton("Online", v -> showOnline()));
        nav.addView(navButton("Search", v -> showSearch()));
        root.addView(nav);

        setContentView(root);
    }

    private Button navButton(String label, View.OnClickListener click) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(11);
        button.setOnClickListener(click);
        button.setAllCaps(false);
        return button;
    }

    private Button button(String label, View.OnClickListener click) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(Color.WHITE);
        button.setBackgroundColor(primary);
        button.setOnClickListener(click);
        button.setPadding(12, 10, 12, 10);
        return button;
    }

    private TextView text(String value, int size, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(darkMode ? Color.WHITE : Color.rgb(15, 23, 42));
        if (bold) view.setTypeface(null, 1);
        return view;
    }

    private EditText input(String hint) {
        EditText edit = new EditText(this);
        edit.setHint(hint);
        edit.setSingleLine(false);
        edit.setTextColor(darkMode ? Color.WHITE : Color.rgb(15, 23, 42));
        edit.setHintTextColor(Color.rgb(100, 116, 139));
        return edit;
    }

    private LinearLayout card(String heading) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(18, 18, 18, 18);
        card.setBackgroundColor(darkMode ? Color.rgb(17, 24, 39) : Color.WHITE);
        TextView title = text(heading, 18, true);
        title.setPadding(0, 0, 0, 12);
        card.addView(title);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(0, 0, 0, 16);
        card.setLayoutParams(lp);
        return card;
    }

    private void clear(String title) {
        content.removeAllViews();
        TextView pageTitle = text(title, 24, true);
        pageTitle.setPadding(0, 0, 0, 18);
        content.addView(pageTitle);
    }

    private void showHome() {
        clear("Dashboard");
        LinearLayout status = card("Account");
        status.addView(text(username.isEmpty() ? "Not signed in" : "Signed in as @" + username, 15, false));
        status.addView(text("Backend: " + apiBase, 13, false));
        status.addView(button("Check backend", v -> get("/", result -> toast("Backend online: " + result))));
        status.addView(button("Friends", v -> showFriends()));
        status.addView(button("AI tools", v -> showAi()));
        status.addView(button("Settings", v -> showSettings()));
        content.addView(status);

        LinearLayout quick = card("Native Android Features");
        quick.addView(text("This is now native Android UI, not a website screen.", 15, false));
        quick.addView(text("Available: auth, chat, reels, friends, stories, AI tools, cloud storage status, settings, camera/media permissions.", 14, false));
        content.addView(quick);
    }

    private void showChat() {
        clear("Login and Chat");
        LinearLayout auth = card("Sign in");
        EditText email = input("Email");
        EditText phone = input("Mobile number");
        EditText password = input("Password");
        EditText newUsername = input("Username for signup");
        auth.addView(email);
        auth.addView(phone);
        auth.addView(password);
        auth.addView(newUsername);
        auth.addView(button("Login", v -> login(email.getText().toString(), phone.getText().toString(), password.getText().toString())));
        auth.addView(button("Signup", v -> signup(newUsername.getText().toString(), email.getText().toString(), phone.getText().toString(), password.getText().toString())));
        content.addView(auth);

        LinearLayout chat = card("Send message");
        EditText receiver = input("Receiver username");
        EditText message = input("Message");
        chat.addView(receiver);
        chat.addView(message);
        chat.addView(button("Send", v -> moderateAndSend(receiver.getText().toString(), message.getText().toString())));
        chat.addView(button("Load messages", v -> get("/api/messages", result -> showResult("Messages", result))));
        content.addView(chat);
    }

    private void showReels() {
        clear("Reels");
        LinearLayout upload = card("Upload reel");
        EditText caption = input("Caption");
        upload.addView(caption);
        upload.addView(button("Pick video", v -> {
            selectedUpload = "reel:" + caption.getText().toString();
            pickMedia("video/*");
        }));
        upload.addView(button("Load reels", v -> get("/api/reels", result -> showResult("Reels", result))));
        content.addView(upload);
    }

    private void showFriends() {
        clear("Friends");
        LinearLayout friends = card("Friend system");
        EditText other = input("Username");
        friends.addView(other);
        friends.addView(button("Send request / follow", v -> friendPost("/api/friends/request", "from", username, "to", other.getText().toString())));
        friends.addView(button("Accept request", v -> friendPost("/api/friends/accept", "username", username, "requester", other.getText().toString())));
        friends.addView(button("Remove friend", v -> friendPost("/api/friends/remove", "username", username, "friend", other.getText().toString())));
        friends.addView(button("Load my friends", v -> get("/api/friends/" + username, result -> showResult("Friends", result))));
        content.addView(friends);
    }

    private void showStories() {
        clear("Stories");
        LinearLayout stories = card("24-hour story");
        EditText caption = input("Caption");
        stories.addView(caption);
        stories.addView(button("Pick story media", v -> {
            selectedUpload = "story:" + caption.getText().toString();
            pickMedia("*/*");
        }));
        stories.addView(button("Load stories", v -> get("/api/stories", result -> showResult("Stories", result))));
        content.addView(stories);
    }

    private void showOnline() {
        clear("Online");
        LinearLayout online = card("Online users");
        online.addView(button("Load users", v -> get("/api/auth/users", result -> showResult("Online users", result))));
        content.addView(online);
    }

    private void showSearch() {
        clear("Search");
        LinearLayout search = card("Search");
        EditText query = input("Search users, reels, chats");
        search.addView(query);
        search.addView(button("Search", v -> get("/api/search?q=" + query.getText().toString() + "&username=" + username, result -> showResult("Search", result))));
        content.addView(search);
    }

    private void showAi() {
        clear("AI and Cloud");
        LinearLayout ai = card("AI tools");
        EditText aiText = input("Text for moderation or translation");
        ai.addView(aiText);
        ai.addView(button("Moderate text", v -> postJson("/api/ai/moderate", json().putSafe("text", aiText.getText().toString()), result -> showResult("Moderation", result))));
        ai.addView(button("Translate to Hindi", v -> postJson("/api/ai/translate", json().putSafe("text", aiText.getText().toString()).putSafe("language", "Hindi"), result -> showResult("Translation", result))));
        ai.addView(button("Load recommendations", v -> get("/api/ai/recommendations?username=" + username, result -> showResult("Recommendations", result))));
        content.addView(ai);

        LinearLayout storage = card("Cloud storage");
        storage.addView(button("Check storage status", v -> get("/api/storage/status", result -> showResult("Storage", result))));
        storage.addView(button("Check push status", v -> get("/api/notifications/push/status", result -> showResult("Push notifications", result))));
        storage.addView(button("Register this phone for push", v -> registerPushToken()));
        storage.addView(text("Cloudinary works after keys are added. Firebase and S3 are prepared in backend config.", 14, false));
        content.addView(storage);
    }

    private void showSettings() {
        clear("Settings");
        LinearLayout settings = card("App settings");
        EditText api = input("Backend URL");
        api.setText(apiBase);
        settings.addView(api);
        settings.addView(button("Save backend URL", v -> {
            apiBase = api.getText().toString().trim();
            prefs.edit().putString("apiBase", apiBase).apply();
            toast("Backend URL saved");
        }));
        settings.addView(button(darkMode ? "Turn light mode on" : "Turn dark mode on", v -> {
            darkMode = !darkMode;
            prefs.edit().putBoolean("darkMode", darkMode).apply();
            buildShell();
            showSettings();
        }));
        settings.addView(button("Blue theme", v -> saveTheme(Color.rgb(37, 99, 235))));
        settings.addView(button("Rose theme", v -> saveTheme(Color.rgb(225, 29, 72))));
        settings.addView(button("Green theme", v -> saveTheme(Color.rgb(22, 163, 74))));
        settings.addView(button("Open camera permission", v -> requestCamera()));
        content.addView(settings);
    }

    private void saveTheme(int color) {
        primary = color;
        prefs.edit().putInt("primary", color).apply();
        buildShell();
        showSettings();
    }

    private void login(String email, String phone, String password) {
        postJson("/api/auth/login", json().putSafe("email", email).putSafe("phone", phone).putSafe("password", password), result -> {
            try {
                JSONObject data = new JSONObject(result);
                token = data.optString("token", "");
                JSONObject user = data.optJSONObject("user");
                username = user == null ? "" : user.optString("username", "");
                prefs.edit().putString("token", token).putString("username", username).apply();
                registerPushToken();
                toast("Login successful");
                showHome();
            } catch (Exception error) {
                showResult("Login response", result);
            }
        });
    }

    private void signup(String name, String email, String phone, String password) {
        postJson("/api/auth/signup", json().putSafe("username", name).putSafe("email", email).putSafe("phone", phone).putSafe("password", password), result -> showResult("Signup", result));
    }

    private void moderateAndSend(String receiver, String message) {
        postJson("/api/ai/moderate", json().putSafe("text", message), result -> {
            try {
                JSONObject moderation = new JSONObject(result);
                if (!moderation.optBoolean("allowed", true)) {
                    toast(moderation.optString("message", "Message blocked"));
                    return;
                }
            } catch (Exception ignored) {}
            JSONObject body = json()
                    .putSafe("sender", username)
                    .putSafe("receiver", receiver)
                    .putSafe("text", message)
                    .putSafe("messageType", "text");
            postJson("/api/messages", body, saved -> toast("Message sent"));
        });
    }

    private void friendPost(String path, String key1, String value1, String key2, String value2) {
        postJson(path, json().putSafe(key1, value1).putSafe(key2, value2), result -> showResult("Friend action", result));
    }

    private void pickMedia(String type) {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType(type);
        startActivityForResult(Intent.createChooser(intent, "Choose media"), PICK_MEDIA);
    }

    private void requestCamera() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, REQUEST_CAMERA);
            return;
        }
        startActivity(new Intent(MediaStore.ACTION_IMAGE_CAPTURE));
    }

    private void registerPushToken() {
        if (username.isEmpty()) {
            toast("Login first to register push notifications");
            return;
        }

        if (android.os.Build.VERSION.SDK_INT >= 33 &&
                ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 401);
        }

        FirebaseMessaging.getInstance().getToken()
                .addOnSuccessListener(tokenValue -> postJson(
                        "/api/notifications/push/register",
                        json().putSafe("username", username).putSafe("token", tokenValue),
                        result -> toast("Push notifications registered")
                ))
                .addOnFailureListener(error -> toast("Push token failed: " + error.getMessage()));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_MEDIA && resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
            uploadSelectedMedia(data.getData());
        }
    }

    private void uploadSelectedMedia(Uri uri) {
        runAsync(() -> {
            try {
                String mediaType = getContentResolver().getType(uri);
                if (mediaType == null) mediaType = "application/octet-stream";
                String dataUrl = "data:" + mediaType + ";base64," + encodeUri(uri);
                JSONObject uploaded = new JSONObject(request("POST", "/api/storage/upload",
                        json().putSafe("file", dataUrl).putSafe("fileName", "android-upload").putSafe("mediaType", mediaType).putSafe("folder", "native")));
                String url = uploaded.optString("url", dataUrl);

                if (selectedUpload.startsWith("reel:")) {
                    String caption = selectedUpload.substring(5);
                    postJson("/api/reels", json().putSafe("username", username).putSafe("caption", caption).putSafe("videoUrl", url).putSafe("videoType", mediaType), result -> showResult("Reel uploaded", result));
                } else {
                    String caption = selectedUpload.startsWith("story:") ? selectedUpload.substring(6) : "";
                    postJson("/api/stories", json().putSafe("username", username).putSafe("caption", caption).putSafe("mediaUrl", url).putSafe("mediaType", mediaType.startsWith("video") ? "video" : "image"), result -> showResult("Story uploaded", result));
                }
            } catch (Exception error) {
                runOnUiThread(() -> toast(error.getMessage()));
            }
        });
    }

    private String encodeUri(Uri uri) throws Exception {
        InputStream input = getContentResolver().openInputStream(uri);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while (input != null && (read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        if (input != null) input.close();
        return Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
    }

    private NativeJson json() {
        return new NativeJson();
    }

    private void get(String path, ResultHandler handler) {
        runAsync(() -> {
            try {
                String result = request("GET", path, null);
                runOnUiThread(() -> handler.handle(result));
            } catch (Exception error) {
                runOnUiThread(() -> toast(error.getMessage()));
            }
        });
    }

    private void postJson(String path, JSONObject body, ResultHandler handler) {
        runAsync(() -> {
            try {
                String result = request("POST", path, body);
                runOnUiThread(() -> handler.handle(result));
            } catch (Exception error) {
                runOnUiThread(() -> toast(error.getMessage()));
            }
        });
    }

    private String request(String method, String path, @Nullable JSONObject body) throws Exception {
        URL url = new URL(apiBase + path);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Content-Type", "application/json");
        if (!token.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + token);
        if (body != null) {
            connection.setDoOutput(true);
            OutputStream output = connection.getOutputStream();
            output.write(body.toString().getBytes("UTF-8"));
            output.close();
        }
        InputStream stream = connection.getResponseCode() >= 400 ? connection.getErrorStream() : connection.getInputStream();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int read;
        while (stream != null && (read = stream.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        if (stream != null) stream.close();
        return output.toString("UTF-8");
    }

    private void runAsync(Runnable work) {
        new Thread(work).start();
    }

    private void showResult(String title, String result) {
        clear(title);
        LinearLayout resultCard = card(title);
        TextView body = text(formatJson(result), 13, false);
        resultCard.addView(body);
        content.addView(resultCard);
    }

    private String formatJson(String value) {
        try {
            if (value.trim().startsWith("[")) return new JSONArray(value).toString(2);
            if (value.trim().startsWith("{")) return new JSONObject(value).toString(2);
        } catch (Exception ignored) {}
        return value;
    }

    private void toast(String value) {
        Toast.makeText(this, value, Toast.LENGTH_LONG).show();
    }

    private interface ResultHandler {
        void handle(String result);
    }

    private static class NativeJson extends JSONObject {
        NativeJson putSafe(String key, Object value) {
            try {
                put(key, value);
            } catch (Exception ignored) {}
            return this;
        }
    }
}
