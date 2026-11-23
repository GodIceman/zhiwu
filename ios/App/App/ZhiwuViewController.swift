import Capacitor
import UIKit

final class ZhiwuViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(ZhiwuNativePlugin())

        // The page handles its own scrolling and safe-area spacing. Prevent a
        // second native inset or rubber-band background around fixed sheets.
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false
        webView?.scrollView.keyboardDismissMode = .interactive
        // Do not freeze the system appearance before persisted web settings
        // have loaded. WKWebView's prefers-color-scheme must keep tracking iOS.
        applyAppearance(dark: traitCollection.userInterfaceStyle == .dark, followSystem: true)
    }

    func applyAppearance(dark: Bool, followSystem: Bool) {
        let style: UIUserInterfaceStyle = followSystem ? .unspecified : (dark ? .dark : .light)
        // UIKit can change traits before the WebKit media query is delivered.
        let background = UIColor(named: "LaunchBackground") ?? .systemBackground

        overrideUserInterfaceStyle = style
        // Only update this app's presenting window, never a global window list.
        viewIfLoaded?.window?.overrideUserInterfaceStyle = style
        viewIfLoaded?.window?.backgroundColor = background
        viewIfLoaded?.backgroundColor = background
        webView?.isOpaque = false
        webView?.backgroundColor = background
        webView?.scrollView.backgroundColor = background
        webView?.underPageBackgroundColor = background
    }
}
