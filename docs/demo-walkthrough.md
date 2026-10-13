# Demo walkthrough — 30–35 minutes

## Before the talk

1. Install dependencies and build the training APK with `npm run build:apk`.
2. Start an emulator, install `dist/insecurebank-rn-lab-training.apk`, and confirm the login screen.
3. Start `npm run reset`, then `npm run api`; keep a second terminal ready for API mode changes.
4. Open the APK in JADX. Prepare searches for `SC-LAB-PRIV-4D92A7`, `network_security_config`, and the cleartext route.
5. If showing traffic, configure an emulator proxy to a local Burp/mitmproxy listener and confirm the emulator can reach the host.

Recommended core investigations: BOLA (12–14 min), APK client key (6–7 min), and HTTP traffic (7–8 min). Leave the remaining time for questions and transitions. D and E are optional follow-ups. F is omitted.

## B — cross-account authorization (core, 12–14 min)

- **Open:** API source at `apps/api/src/app.ts`, terminal with `npm run api`, and a controlled API client.
- **Inspect:** `GET /api/accounts/:accountId`; point to session authentication and the absent ownership comparison in vulnerable mode.
- **Trigger:** Sign in as Ada, request `acct-1001`, then change only the ID to `acct-2002` while keeping the same bearer token.
- **Observe:** The API returns Grace's synthetic balance/history. Explain authentication versus authorization and why UI restrictions do not fix the server boundary.
- **Correct:** Restart with `npm run api:corrected`, obtain a fresh Ada token, repeat the request, and show HTTP 403. Run `npm test` if time allows.
- **Transition:** “Now that the server boundary is clear, let's inspect what the APK itself gives away.”
- **Fallback:** Use the automated vulnerable/corrected API tests and captured JSON output if the emulator or proxy fails.

## A — bundled client key (core, 6–7 min)

- **Open:** APK in JADX; search for `SC-LAB-PRIV-4D92A7`.
- **Inspect:** `src/config.ts` and bundled JavaScript, then `/api/lab/support-info` validation in API source.
- **Trigger:** Sign in, open Profile, tap **Open support info**. Repeat with curl and the extracted header.
- **Observe:** A replayable key returns only a synthetic support note. Clarify public configuration versus a credential the server trusts.
- **Explain:** Obfuscation does not make a client-held shared key confidential; server-side identity and authorization are needed.
- **Transition:** “Static inspection found the setting. Next, observe data moving at runtime.”
- **Fallback:** Use the curl request in [Exercise A](vulnerabilities/A-hardcoded-value.md) if JADX is slow.

## C — HTTP capture (core, 7–8 min)

- **Open:** Merged manifest and network security XML in JADX/APK Analyzer; local proxy listener.
- **Inspect:** `android:networkSecurityConfig`, base cleartext denial, and emulator host exceptions.
- **Trigger:** Sign in and tap **Capture HTTP sample** on Profile.
- **Observe:** Capture `GET /api/lab/cleartext/acct-1001`; show the synthetic bearer header and JSON response are readable as HTTP.
- **Explain:** The exception exists for a contained local exercise. A production app should require HTTPS and validate trusted certificates.
- **Transition:** “We have seen client data in transit; next is where session state lives at rest.”
- **Fallback:** Use the app's displayed response and `curl` against the local endpoint if proxy setup fails.

## Optional: D and E

- **D:** Inspect AsyncStorage calls in `src/App.tsx`, sign in, then use Device Explorer or a debuggable `run-as` session to inspect app-private database files. Explain Android sandbox boundaries and Keystore-backed encryption options. If app-data inspection is blocked, present the source and explain the access prerequisite.
- **E:** Start `adb logcat`, sign in, and show the synthetic token line. Toggle `SHOW_VULNERABLE_LOG` to `false`, rebuild, and show a value-free login event. If logcat filters the line, use Android Studio's app log viewer or the source as fallback.

## Reset and stop

Run `npm run reset`, stop the API and Metro, and restore any emulator proxy changes. Keep all captures synthetic and local.
