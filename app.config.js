/**
 * Dynamic Expo config layered on top of app.json.
 *
 * The only thing computed here is the iOS `aps-environment` entitlement, which
 * must match the provisioning profile's APNs environment:
 *   - production / preview builds  → App Store / TestFlight distribution → "production"
 *   - everything else (dev client) → development provisioning            → "development"
 *
 * Selecting on EAS_BUILD_PROFILE (set by EAS Build) keeps FCM push working in
 * released builds without breaking on-device development builds. Everything
 * else lives in app.json and is passed through untouched.
 */
const PRODUCTION_PUSH_PROFILES = new Set(['production', 'preview']);

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const apsEnvironment = PRODUCTION_PUSH_PROFILES.has(profile)
    ? 'production'
    : 'development';

  config.ios = config.ios || {};
  config.ios.entitlements = {
    ...(config.ios.entitlements || {}),
    'aps-environment': apsEnvironment,
  };

  return config;
};
