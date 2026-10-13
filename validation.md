# Validation status

Last checked: 2026-10-13. These results describe this workspace's build; rerun the commands after changing the app or Android configuration.

## Verified

- `npm install` completed, and the lockfile was refreshed with the API dependencies in the API workspace.
- `npm run typecheck` passed for the React Native app and API.
- `npm test` passed all seven API tests, including account registration/password hashing, reset-route gating, vulnerable cross-account disclosure, corrected account and history denial, transfer/reset behavior, and the synthetic support key route.
- The local API started in vulnerable mode on `127.0.0.1:3000` after startup path correction.
- `npm run build:apk` completed successfully. It produced `dist/insecurebank-rn-lab-training.apk` (18 MB, arm64-v8a, debug-signed release variant with bundled JavaScript).
- The updated Release APK rebuilt successfully with the account creation screen and Exercise G value.
- Android APK inspection confirmed package `com.insecurebankrn`, the INTERNET permission, the network-security-config manifest reference, the emulator-only cleartext resource, the `lab_support_key` resource with value `SC-LAB-PRIV-4D92A7`, and the JavaScript bundle asset.

## Not verified on a running app

The APK was not installed or launched. The running Pixel 9a emulator had 307 MB free and Android Package Installer rejected installation with “Requested internal only, but not enough space.” The emulator was left intact; no app data was cleared. Consequently, the following remain unverified on-device:

- Login screen rendering and the banking flows.
- Emulator-to-host API connectivity and the Android cleartext policy in actual requests.
- Runtime proxy capture, logcat token observation, and app-private AsyncStorage inspection.

The static APK checks and API tests do not replace those runtime demonstrations. Free space on an emulator or use a disposable emulator with a larger data partition, then follow [setup](setup.md) and [demo walkthrough](demo-walkthrough.md).
