const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// FirebaseCoreInternal (Swift) depends on GoogleUtilities which has no module map.
// `use_modular_headers!` tells CocoaPods to generate module maps for all pods,
// which lets Swift pods import them without issues.
module.exports = function withFirebasePodfile(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');
      if (!contents.includes('use_modular_headers!')) {
        contents = contents.replace(
          /^(platform :ios.+)$/m,
          '$1\nuse_modular_headers!'
        );
        fs.writeFileSync(podfilePath, contents);
      }
      return config;
    },
  ]);
};
