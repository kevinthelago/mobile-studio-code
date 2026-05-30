import ExpoModulesCore
import CryptoKit
import Foundation

// URLSession delegate that pins the desktop tunnel's self-signed certificate by
// SHA-256 fingerprint. iOS rejects self-signed certs by default; this lets us
// trust exactly one cert — the one whose fingerprint we received in the QR
// pairing payload — and nothing else. Lifecycle events are forwarded via
// closures so the Expo module can re-emit them to JS.
final class PinnedSocketDelegate: NSObject, URLSessionWebSocketDelegate {
  /// Lowercased hex SHA-256 of the pinned cert (no separators). nil = no pin.
  private let fingerprint: String?
  private let onOpen: () -> Void
  private let onClose: () -> Void
  private let onTrustFailure: (String) -> Void

  init(
    fingerprint: String?,
    onOpen: @escaping () -> Void,
    onClose: @escaping () -> Void,
    onTrustFailure: @escaping (String) -> Void
  ) {
    self.fingerprint = fingerprint
    self.onOpen = onOpen
    self.onClose = onClose
    self.onTrustFailure = onTrustFailure
  }

  func urlSession(
    _ session: URLSession,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
          let trust = challenge.protectionSpace.serverTrust else {
      completionHandler(.performDefaultHandling, nil)
      return
    }
    // Without a pinned fingerprint, defer to the system — which will (correctly)
    // reject a self-signed cert. Pinning is the only path that trusts one.
    guard let pinned = fingerprint, !pinned.isEmpty else {
      completionHandler(.performDefaultHandling, nil)
      return
    }

    var leaf: SecCertificate?
    if #available(iOS 15.0, *) {
      leaf = (SecTrustCopyCertificateChain(trust) as? [SecCertificate])?.first
    } else {
      leaf = SecTrustGetCertificateAtIndex(trust, 0)
    }
    guard let cert = leaf else {
      onTrustFailure("No server certificate presented")
      completionHandler(.cancelAuthenticationChallenge, nil)
      return
    }

    let der = SecCertificateCopyData(cert) as Data
    let hex = SHA256.hash(data: der).map { String(format: "%02x", $0) }.joined()
    if hex == pinned {
      NSLog("[tunnel-tls] cert pin matched")
      completionHandler(.useCredential, URLCredential(trust: trust))
    } else {
      NSLog("[tunnel-tls] cert pin MISMATCH — expected %@, got %@", pinned, hex)
      onTrustFailure("Certificate fingerprint mismatch")
      completionHandler(.cancelAuthenticationChallenge, nil)
    }
  }

  func urlSession(
    _ session: URLSession,
    webSocketTask: URLSessionWebSocketTask,
    didOpenWithProtocol protocol: String?
  ) {
    onOpen()
  }

  func urlSession(
    _ session: URLSession,
    webSocketTask: URLSessionWebSocketTask,
    didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
    reason: Data?
  ) {
    onClose()
  }
}

public final class TlsWebSocketModule: Module {
  private var task: URLSessionWebSocketTask?
  private var session: URLSession?
  private var delegate: PinnedSocketDelegate?

  public func definition() -> ModuleDefinition {
    Name("TlsWebSocket")

    Events("onOpen", "onMessage", "onError", "onClose")

    // Opens a single pinned WebSocket. fingerprint is lowercased hex SHA-256 of
    // the server's leaf cert (DER); pass nil to skip pinning.
    Function("connect") { (urlString: String, fingerprint: String?) in
      self.closeInternal()

      guard let url = URL(string: urlString) else {
        self.sendEvent("onError", ["message": "Invalid URL: \(urlString)"])
        return
      }
      let normalized = fingerprint?
        .lowercased()
        .replacingOccurrences(of: ":", with: "")
        .trimmingCharacters(in: .whitespacesAndNewlines)

      let del = PinnedSocketDelegate(
        fingerprint: normalized,
        onOpen: { [weak self] in self?.sendEvent("onOpen", [:]) },
        onClose: { [weak self] in self?.sendEvent("onClose", [:]) },
        onTrustFailure: { [weak self] message in
          self?.sendEvent("onError", ["message": message])
        }
      )
      self.delegate = del

      NSLog("[tunnel-tls] connecting to %@ (pinned=%@)", urlString, normalized != nil ? "yes" : "no")
      let urlSession = URLSession(configuration: .default, delegate: del, delegateQueue: nil)
      self.session = urlSession
      let socketTask = urlSession.webSocketTask(with: url)
      self.task = socketTask
      socketTask.resume()
      self.receive()
    }

    Function("send") { (text: String) in
      self.task?.send(.string(text)) { [weak self] error in
        if let error = error {
          self?.sendEvent("onError", ["message": error.localizedDescription])
        }
      }
    }

    Function("close") {
      self.closeInternal()
    }

    OnDestroy {
      self.closeInternal()
    }
  }

  private func closeInternal() {
    task?.cancel(with: .goingAway, reason: nil)
    task = nil
    session?.invalidateAndCancel()
    session = nil
    delegate = nil
  }

  // Recursively pulls frames off the socket and re-emits them to JS. Each
  // receive() handles exactly one message, then re-arms itself.
  private func receive() {
    task?.receive { [weak self] result in
      guard let self = self else { return }
      switch result {
      case .failure(let error):
        self.sendEvent("onError", ["message": error.localizedDescription])
        self.sendEvent("onClose", [:])
      case .success(let message):
        switch message {
        case .string(let text):
          self.sendEvent("onMessage", ["data": text])
        case .data(let data):
          self.sendEvent("onMessage", ["data": String(data: data, encoding: .utf8) ?? ""])
        @unknown default:
          break
        }
        self.receive()
      }
    }
  }
}
