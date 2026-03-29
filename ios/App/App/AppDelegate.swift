import UIKit
import WebKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Set audio session to playback with AirPlay + Bluetooth A2DP support
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to set AVAudioSession category: \(error)")
        }

        // Observe route changes (e.g. AirPlay selected) and interruptions
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleAudioRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleAudioInterruption(_:)),
            name: AVAudioSession.interruptionNotification, object: nil)

        return true
    }

    // MARK: - Audio session recovery

    @objc func handleAudioRouteChange(_ notification: Notification) {
        try? AVAudioSession.sharedInstance().setActive(true)
        resumeWebAudio()
    }

    @objc func handleAudioInterruption(_ notification: Notification) {
        guard let info = notification.userInfo,
              let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue),
              type == .ended else { return }
        try? AVAudioSession.sharedInstance().setActive(true)
        resumeWebAudio()
    }

    /// Tells the WKWebView to resume its AudioContext after a route change or interruption.
    func resumeWebAudio() {
        DispatchQueue.main.async {
            self.findWebView()?.evaluateJavaScript(
                "window.__resumeAudioContext && window.__resumeAudioContext()",
                completionHandler: nil
            )
        }
    }

    /// Walk the view hierarchy to find the WKWebView Capacitor uses.
    func findWebView() -> WKWebView? {
        guard let root = window?.rootViewController else { return nil }
        return findWebView(in: root.view)
    }

    func findWebView(in view: UIView) -> WKWebView? {
        if let wk = view as? WKWebView { return wk }
        for sub in view.subviews {
            if let found = findWebView(in: sub) { return found }
        }
        return nil
    }

    // MARK: - App lifecycle

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
