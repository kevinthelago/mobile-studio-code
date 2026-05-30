Pod::Spec.new do |s|
  s.name           = 'TlsWebSocket'
  s.version        = '1.0.0'
  s.summary        = 'WebSocket with self-signed TLS cert pinning for the mobile tunnel'
  s.description    = 'A WebSocket client over URLSessionWebSocketTask that pins the '\
                     'desktop tunnel\'s self-signed certificate by SHA-256 fingerprint.'
  s.author         = 'mobile-studio-code'
  s.homepage       = 'https://github.com/kevinthelago/mobile-studio-code'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
