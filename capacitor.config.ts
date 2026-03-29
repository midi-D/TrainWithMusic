import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trainwithmusic.app',
  appName: 'TrainWithMusic',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
