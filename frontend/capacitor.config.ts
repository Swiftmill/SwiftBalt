import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.swiftmill.swiftbalt',
  appName: 'SwiftBalt',
  webDir: 'dist',
  backgroundColor: '#0a0a0c',
  ios: {
    contentInset: 'always',
  },
  server: {
    androidScheme: 'https',
    cleartext: true
  }
};

export default config;
