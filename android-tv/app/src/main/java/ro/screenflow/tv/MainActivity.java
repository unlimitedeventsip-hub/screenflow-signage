package ro.screenflow.tv;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.util.UUID;

public final class MainActivity extends Activity {
    private static final String HOST = "screenflowum.netlify.app";
    private static final String DEFAULT_ID = "0e2e173f-b917-4fff-8083-c0705d9590ba"; // Legacy TV ID (retained only for fallback)
    private static final String PREF_KEY = "player_url";
    private WebView web;
    private FrameLayout frame;
    private LinearLayout offline;
    private TextView message;
    private String playerUrl;
    private boolean failed = false;
    private long lastBack = 0L;
    private Handler handler = new Handler(Looper.getMainLooper());
    private Runnable retry;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        playerUrl = "https://" + HOST + "/connect"; // v2 auto-registers every installed TV, no manual links
        if (verify(playerUrl) == null) playerUrl = "https://" + HOST + "/connect";
        acceptIntent(getIntent());
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        immersive();
        frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(14,25,37));
        setContentView(frame);
        createWeb();
        createOfflineUi();
        open();
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    private String verify(String candidate) {
        try {
            Uri uri = Uri.parse(candidate);
            if (!"https".equalsIgnoreCase(uri.getScheme()) ||
                !HOST.equalsIgnoreCase(uri.getHost()) ||
                (uri.getPort()!=-1 && uri.getPort()!=443) ||
                uri.getQuery()!=null || uri.getFragment()!=null) return null;
            String path = uri.getPath();
            if ("/connect".equals(path)) return "https://" + HOST + "/connect";
            if (path==null || !path.matches("(?i)/play/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) return null;
            UUID.fromString(path.substring(6));
            return "https://" + HOST + path;
        } catch (Exception ex) { return null; }
    }

    private void acceptIntent(Intent intent) {
        if (intent==null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getData()==null) return;
        String received = verify(intent.getData().toString());
        if (received!=null) {
            playerUrl = received;
            getPreferences(MODE_PRIVATE).edit().putString(PREF_KEY, received).apply();
        }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        acceptIntent(intent);
        if (web!=null) open();
    }

    private void createWeb() {
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(14,25,37));
        web.setKeepScreenOn(true);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setHorizontalScrollBarEnabled(false);
        web.setVerticalScrollBarEnabled(false);
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " ScreenflowTV/2.0");
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setBuiltInZoomControls(false);
        s.setLoadsImagesAutomatically(true);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(true);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return req.isForMainFrame() && verify(req.getUrl().toString())==null;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                failed=false;
                if (offline!=null) offline.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) error("Fără conexiune la Screenflow.");
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest req, WebResourceResponse res) {
                if (req.isForMainFrame() && res.getStatusCode()>=400)
                    error("Serverul a răspuns cu eroarea " + res.getStatusCode());
            }
            @Override public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                frame.removeView(web);
                web.destroy();
                web=null;
                createWeb();
                open();
                return true;
            }
        });
        frame.addView(web, new FrameLayout.LayoutParams(-1,-1));
    }

    private int dp(int n) { return (int)(getResources().getDisplayMetrics().density*n+0.5f); }

    private void createOfflineUi() {
        offline = new LinearLayout(this);
        offline.setOrientation(LinearLayout.VERTICAL);
        offline.setGravity(Gravity.CENTER);
        offline.setPadding(dp(50),dp(40),dp(50),dp(40));
        offline.setBackgroundColor(Color.rgb(14,25,37));
        frame.addView(offline,new FrameLayout.LayoutParams(-1,-1));
        TextView brand = new TextView(this);
        brand.setText("screenflow.");
        brand.setTextSize(34);
        brand.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        brand.setTextColor(Color.rgb(215,180,123));
        offline.addView(brand);
        message = new TextView(this);
        message.setTextSize(20);
        message.setTextColor(Color.WHITE);
        message.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams m = new LinearLayout.LayoutParams(-2,-2);
        m.topMargin=dp(26);
        m.bottomMargin=dp(24);
        offline.addView(message,m);
        Button button=new Button(this);
        button.setText("Reîncearcă");
        button.setOnClickListener(v -> open());
        offline.addView(button);
        offline.setVisibility(View.GONE);
    }

    private void open() {
        if(retry!=null) handler.removeCallbacks(retry);
        retry=null;
        failed=false;
        if(offline!=null) offline.setVisibility(View.GONE);
        if(web!=null) web.loadUrl(playerUrl);
    }

    private void error(String why) {
        failed=true;
        message.setText(why + "\nReîncercare automată...");
        offline.setVisibility(View.VISIBLE);
        offline.bringToFront();
        if(retry!=null) handler.removeCallbacks(retry);
        retry=()->{if(failed && !isFinishing()) open();};
        handler.postDelayed(retry,15000);
    }

    @Override public boolean onKeyDown(int key, KeyEvent event) {
        if(key==KeyEvent.KEYCODE_MENU || key==KeyEvent.KEYCODE_F5) {open(); return true;}
        return super.onKeyDown(key,event);
    }

    @Override public void onBackPressed() {
        if(System.currentTimeMillis()-lastBack<1800) super.onBackPressed();
        else {
            lastBack=System.currentTimeMillis();
            Toast.makeText(this,"Înapoi încă o dată pentru ieșire",Toast.LENGTH_SHORT).show();
        }
    }

    @Override protected void onResume() {
        super.onResume();
        immersive();
        if(web!=null) web.onResume();
        if(failed) open();
    }
    @Override protected void onPause() {
        if(web!=null) web.onPause();
        super.onPause();
    }
    @Override protected void onDestroy() {
        if(retry!=null) handler.removeCallbacks(retry);
        if(web!=null) {frame.removeView(web); web.destroy(); web=null;}
        super.onDestroy();
    }
}
