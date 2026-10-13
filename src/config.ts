declare const process: { env: { LAB_API_BASE_URL?: string; LAB_DEMO_SECRET?: string } };

// Public lab setting; change at build time for emulator or trusted test-device routing.
export const API_BASE_URL = process.env.LAB_API_BASE_URL || 'http://10.0.2.2:3000';
// Exercise G: fake .env value deliberately inlined into the client bundle.
export const LAB_EXPOSED_ENV_VALUE = process.env.LAB_DEMO_SECRET || 'FAKE-DEMO-ENV-SECRET-NOT-A-CREDENTIAL';
// EXERCISE A: a fake key is deliberately embedded in the app bundle for APK discovery.
export const LAB_SUPPORT_KEY = 'SC-LAB-PRIV-4D92A7';
