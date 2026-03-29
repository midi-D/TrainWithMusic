import UIKit
import WebKit
import Capacitor

class ViewController: CAPBridgeViewController {

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        // Allow media elements to route to AirPlay
        config.allowsAirPlayForMediaPlayback = true
        return config
    }
}
