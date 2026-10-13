# Exercise C — insecure network communication

## Objective and affected files

Observe a synthetic authenticated account response travelling over HTTP, then identify the Android policy and explain the HTTPS correction.

- `android/app/src/main/AndroidManifest.xml`: references the network security config.
- `android/app/src/main/res/xml/network_security_config.xml`: denies cleartext by default and permits emulator host aliases for this lab.
- `src/config.ts`: contains the public local API URL fallback.
- `src/App.tsx` and `apps/api/src/app.ts`: trigger and serve the sample request.

## Static discovery

In JADX or APK Analyzer, inspect the merged manifest and `res/xml/network_security_config.xml`. Search the bundled assets for `http://10.0.2.2:3000` or `10.0.3.2` and `/api/lab/cleartext`. The allowlist is limited to emulator host aliases, but those requests are still plaintext by design.

## Runtime validation and evidence

Start the local API, sign in on the emulator, and open Profile → **Capture HTTP sample (Exercise C)**. The screen shows that the response is synthetic and includes the account ID and balance. Capture the request using Burp or mitmproxy configured as the emulator's HTTP proxy. Expected path: `GET /api/lab/cleartext/acct-1001`; the Authorization header and JSON response are readable because this is HTTP.

## Prerequisites, impact, and false positives

Use only the local emulator and synthetic seed data. Cleartext permission in the manifest is a policy observation, not proof that every request is exploitable: reachability and data sent over the permitted destination matter. Here the endpoint deliberately sends account data without transport encryption. A real attacker needs a position to observe or alter traffic on the path.

## Correction and verification

Outside the isolated exercise, use an HTTPS endpoint with a trusted certificate and enforce HTTPS in the network policy. Keep the base cleartext policy disabled, remove emulator IP exceptions, and do not install a permissive trust manager or disable certificate validation. Verify the actual APK's merged manifest and XML after building; the documented source setting alone does not establish what the artifact contains.
