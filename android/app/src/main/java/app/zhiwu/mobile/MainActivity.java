package app.zhiwu.mobile;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;
import android.widget.ImageView;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import org.json.JSONObject;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int LIGHT_BACKGROUND = Color.rgb(245, 247, 243);
    private static final int DARK_BACKGROUND = Color.rgb(20, 28, 25);

    private FrameLayout nativeSplashView;
    private boolean nativeSplashHidden = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showNativeSplash();
        applyEdgeToEdge();
        prepareWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        applyEdgeToEdge();
        prepareWebView();
    }

    private void applyEdgeToEdge() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().setNavigationBarDividerColor(Color.TRANSPARENT);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }

        updateSystemBarIconStyle(isSystemDark());
    }

    private void prepareWebView() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        getBridge().getWebView().setVerticalScrollBarEnabled(false);
        getBridge().getWebView().setHorizontalScrollBarEnabled(false);
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
        getBridge().getWebView().addJavascriptInterface(new SystemBarsBridge(), "ZhiwuSystemBars");
        getBridge().getWebView().addJavascriptInterface(new NativeSplashBridge(), "ZhiwuNativeSplash");
        getBridge().getWebView().addJavascriptInterface(new FileExportBridge(), "ZhiwuFileExport");
    }

    private void updateSystemBarIconStyle(boolean darkMode) {
        WindowInsetsControllerCompat controller =
            new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());

        controller.setAppearanceLightStatusBars(!darkMode);
        controller.setAppearanceLightNavigationBars(!darkMode);
    }

    private boolean isSystemDark() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
            == Configuration.UI_MODE_NIGHT_YES;
    }

    private int dp(float value) {
        return Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            getResources().getDisplayMetrics()
        ));
    }

    private void showNativeSplash() {
        if (nativeSplashView != null) {
            return;
        }

        boolean darkMode = isSystemDark();
        nativeSplashView = new FrameLayout(this);
        nativeSplashView.setClickable(true);
        nativeSplashView.setBackgroundColor(darkMode ? DARK_BACKGROUND : LIGHT_BACKGROUND);
        nativeSplashView.setAlpha(1f);

        ImageView brand = new ImageView(this);
        brand.setImageResource(darkMode
            ? R.drawable.native_splash_wordmark_dark
            : R.drawable.native_splash_wordmark_light);
        brand.setAdjustViewBounds(true);
        brand.setScaleType(ImageView.ScaleType.FIT_CENTER);

        nativeSplashView.addView(brand);

        nativeSplashView.post(() -> {
            int width = nativeSplashView.getWidth();
            int height = nativeSplashView.getHeight();
            int brandWidth = Math.min(Math.round(width * 0.52f), dp(280));
            int brandHeight = Math.round(brandWidth * 560f / 1400f);
            int top = Math.max(0, Math.round(height * 0.382f - brandHeight / 2f));

            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(brandWidth, brandHeight);
            params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            params.topMargin = top;
            brand.setLayoutParams(params);
        });

        ViewGroup decor = (ViewGroup) getWindow().getDecorView();
        decor.addView(nativeSplashView, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        nativeSplashView.postDelayed(this::hideNativeSplash, 4500);
    }

    private void hideNativeSplash() {
        if (nativeSplashHidden || nativeSplashView == null) {
            return;
        }

        nativeSplashHidden = true;
        nativeSplashView.animate()
            .alpha(0f)
            .setDuration(220)
            .setStartDelay(80)
            .setListener(new AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(Animator animation) {
                    if (nativeSplashView == null) {
                        return;
                    }

                    ViewGroup parent = (ViewGroup) nativeSplashView.getParent();
                    if (parent != null) {
                        parent.removeView(nativeSplashView);
                    }
                    nativeSplashView = null;
                }
            })
            .start();
    }

    private class SystemBarsBridge {
        @JavascriptInterface
        public void setDarkMode(boolean darkMode) {
            runOnUiThread(() -> updateSystemBarIconStyle(darkMode));
        }
    }

    private class NativeSplashBridge {
        @JavascriptInterface
        public void hide() {
            runOnUiThread(() -> hideNativeSplash());
        }
    }

    private class FileExportBridge {
        @JavascriptInterface
        public void saveTextFile(String filename, String text, String mimeType) {
            runOnUiThread(() -> {
                try {
                    String location = saveTextToDownloads(filename, text, normalizeMimeType(mimeType));
                    dispatchExportResult(true, "已保存到：" + location);
                } catch (Exception error) {
                    dispatchExportResult(false, "导出失败，请稍后重试");
                }
            });
        }
    }

    private void dispatchExportResult(boolean success, String message) {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        String detail = "{\"success\":" + success + ",\"message\":" + JSONObject.quote(message) + "}";
        String script = "window.dispatchEvent(new CustomEvent('zhiwu:export-result',{detail:" + detail + "}));";
        getBridge().getWebView().evaluateJavascript(script, null);
    }

    private String normalizeMimeType(String mimeType) {
        if (mimeType == null || mimeType.trim().isEmpty()) {
            return "text/plain";
        }

        return mimeType.split(";")[0].trim();
    }

    private String saveTextToDownloads(String filename, String text, String mimeType) throws Exception {
        String safeFilename = filename == null || filename.trim().isEmpty()
            ? "zhiwu-export.txt"
            : filename.replaceAll("[\\\\/:*?\"<>|]", "_");
        byte[] bytes = text == null
            ? new byte[0]
            : text.getBytes(StandardCharsets.UTF_8);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, safeFilename);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            ContentResolver resolver = getContentResolver();
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new IllegalStateException("Cannot create download file");
            }

            try (OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) {
                    throw new IllegalStateException("Cannot open download file");
                }
                output.write(bytes);
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
            return Environment.DIRECTORY_DOWNLOADS + "/" + safeFilename;
        }

        File directory = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null && getFilesDir() != null) {
            directory = getFilesDir();
        }
        if (directory == null) {
            throw new IllegalStateException("No writable directory");
        }
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IllegalStateException("Cannot create export directory");
        }

        File outputFile = new File(directory, safeFilename);
        try (FileOutputStream output = new FileOutputStream(outputFile)) {
            output.write(bytes);
        }

        return outputFile.getAbsolutePath();
    }
}
