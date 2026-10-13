# Troubleshooting

## Emulator cannot reach the API

- Start the API on the host and confirm `curl http://127.0.0.1:3000/health` succeeds.
- Use `10.0.2.2` from the standard Android Emulator, not `localhost`. Genymotion commonly uses `10.0.3.2`.
- Check the `LAB_API_BASE_URL` value used when starting Metro/building the app. It is a public build-time setting.
- If edits to `.env` do not appear in the app, restart Metro and rebuild/reinstall the app; client values are substituted during bundling.
- For hosted mode, set `LAB_API_BASE_URL` to the service's HTTPS URL. Hosting credentials do not belong in mobile `.env`.
- The API binds to loopback by default. A physical device needs a trusted isolated LAN bind and the host's LAN address; restore loopback afterward.

## Cleartext traffic rejected

Inspect `android/app/src/main/AndroidManifest.xml` and `android/app/src/main/res/xml/network_security_config.xml`. The Android app points to this config; the base policy denies cleartext and the lab permits it for emulator aliases only. Rebuild after changing native XML. Don't disable certificate checks or allow cleartext globally as a shortcut.

## API startup or database state

- Use Node 22.11+ and run `npm install` from the repository root.
- If the port is in use, set `API_PORT=3001` for the API and `LAB_API_BASE_URL` to the matching emulator URL.
- `npm run reset` restores both users and balances and invalidates existing sessions.
- The database file is `apps/api/lab.sqlite`; remove it only when the server is stopped, then run `npm run reset`.

## Android build fails

- React Native 0.86 requires a compatible Android SDK, Java 17, and Android Gradle tools. Set `JAVA_HOME` to JDK 17 if the shell selects a newer JDK.
- Install the Android SDK platform and Build Tools versions declared in `android/build.gradle`.
- Run `adb devices` to confirm an emulator is connected. The API and Metro run on the host.
- For a clean rebuild, stop Gradle and use `cd android && ./gradlew clean`, then retry `npm run build:apk`.

## Intercepting the HTTP request

Use a local Burp Suite or mitmproxy listener and configure the emulator's HTTP proxy to the host alias and listener port. Confirm the listener accepts the emulator connection and that the Exercise C button is pressed while signed in. This exercise uses HTTP, so the synthetic request body is visible without a TLS interception certificate. Restore the emulator's proxy setting after the demo.

## Logs and local storage

Use `adb logcat` while signing in to observe Exercise E. For AsyncStorage, inspect app-private data only on the lab emulator; release APK access does not by itself grant access to another app's private files. Modern Android restricts `adb shell` access to app data; a debuggable installation can use `adb shell run-as com.insecurebankrn ...` where supported.
