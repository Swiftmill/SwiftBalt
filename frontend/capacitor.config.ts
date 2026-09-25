import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.swiftmill.swiftbalt',
  appName: 'SwiftBalt',
  webDir: 'dist',
  backgroundColor: '#0d0d0f',
  ios: {
    contentInset: 'never',
    allowsLinkPreview: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: true
  }
};

export default config;
