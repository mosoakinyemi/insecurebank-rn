# InsecureBank RN

An intentionally vulnerable Android training app and Node.js API for SecureCircle's **“What's Hiding in Your APK? A Practical Introduction to Mobile Pentesting.”** All users, balances, tokens, and transfers are synthetic. Run the vulnerable exercises locally. An optional hosted playground can let attendees try the corrected API with their own synthetic accounts.

## Architecture

This project uses the React Native Community CLI (bare React Native), TypeScript, a native Android Gradle project, and an Express API. Local development uses SQLite; the optional Render deployment uses Aiven MySQL. The CLI keeps the manifest, resources, and network policy in the project for APK inspection. The mobile app lives at the repository root to keep the generated CLI Android/Metro setup conventional; the API is in `apps/api/`.

```text
Android emulator ── HTTP ──> Express API ──> SQLite locally / Aiven MySQL on Render
    │                          ├─ vulnerable/corrected authorization mode
    ├─ AsyncStorage session    └─ loopback bind by default
    └─ Android manifest + network security config
```

## Prerequisites and setup

- Node.js 22.11 or newer and npm.
- Android Studio / Android SDK, an emulator, platform tools, and Java 17.
- Install dependencies once, then run offline for the local demo:

```sh
npm install
npm run reset
npm run api
```

In another terminal, start the Android emulator and run:

```sh
npm start
npm run android
```

The Android emulator uses `10.0.2.2` to reach the development machine's loopback service. `localhost` inside Android points back to Android itself. Genymotion commonly uses `10.0.3.2`. To change the mobile API URL, set `LAB_API_BASE_URL` before starting Metro and the Android command, for example `LAB_API_BASE_URL=http://10.0.3.2:3000 npm start` and `LAB_API_BASE_URL=http://10.0.3.2:3000 npm run android`. This is public lab configuration, not a secret; no production endpoint is configured.

The API binds to `127.0.0.1:3000`. No cloud service is needed for the local demo. Each attendee can run their own API and use the included synthetic data. To use a physical device, use a trusted isolated LAN and temporarily set `API_HOST=0.0.0.0`; use the host LAN address in `LAB_API_BASE_URL`, then restore loopback after the demo.

### `.env` security exercise

Copy `.env.example` to `.env`, then run the app normally. `LAB_DEMO_SECRET` is intentionally fake and is compiled into the React Native app to demonstrate that `.env` is configuration, not a secure vault. Anyone who can inspect the APK or app bundle can recover client-side values. Never put real credentials, signing keys, or privileged API tokens in a mobile `.env`; keep server-only secrets on the API host. `.env` stays out of Git, while `.env.example` contains safe sample values.

## Demo accounts

| Name | Email | Password | Account |
| --- | --- | --- | --- |
| Ada Lovelace | `ada@lab.test` | `lab-ada-2468` | `acct-1001` |
| Grace Hopper | `grace@lab.test` | `lab-grace-1357` | `acct-2002` |

All credentials and balances are fictional.

## Run, reset, and validate

- `npm run api`: vulnerable BOLA mode, loopback only.
- `npm run api:corrected`: server-side ownership checks enabled.
- `npm run reset`: restore seed data and invalidate sessions.
- `npm test`: API health, login, ownership, BOLA, transfer, and reset checks.
- `npm run typecheck`: TypeScript checks for mobile and API.
- `npm run build:apk`: assemble an installable, debug-signed release APK with its JavaScript bundle at `dist/insecurebank-rn-lab-training.apk`.
- `adb install -r dist/insecurebank-rn-lab-training.apk`: install the APK.

The generated release artifact targets the arm64 Android emulator used for this lab. It is still a vulnerable training build, uses a debug signing key, and is not for distribution. Change `reactNativeArchitectures` in `android/gradle.properties` if you need a different emulator/device ABI. `npm run android` is the development flow and needs Metro running.

## Exercises

- [A — hardcoded client key](docs/vulnerabilities/A-hardcoded-value.md)
- [B — broken object-level authorization](docs/vulnerabilities/B-bola.md)
- [C — cleartext HTTP](docs/vulnerabilities/C-cleartext-http.md)
- [D — insecure local storage](docs/vulnerabilities/D-local-storage.md)
- [E — sensitive logging](docs/vulnerabilities/E-sensitive-logs.md)
- [G — `.env` values bundled into the mobile app](docs/vulnerabilities/G-env-mobile-config.md)
- [F — optional exported component](docs/vulnerabilities/F-exported-component.md)
- [Demo walkthrough](docs/demo-walkthrough.md) · [Findings matrix](docs/security-findings.md) · [Troubleshooting](docs/troubleshooting.md)

For the API contract and exact setup commands, see [setup](docs/setup.md) and [architecture](docs/architecture.md). The reference InsecureBankv2 project is used for learning themes only; its implementation is not ported.

### Create an account

From the sign-in screen, choose **New here? Create an account**. Accounts are synthetic and receive an isolated, empty transaction history and a demo balance. Passwords are hashed on the API. Use a unique training email address; there is no email verification or password recovery.

### Optional Render playground

[`render.yaml`](render.yaml) describes a free API service using corrected ownership checks, HTTPS, and a disabled public reset route. Configure its server-only credentials to connect to an Aiven Free MySQL service. See the [Render deployment guide](docs/deploy-render.md) for free-tier limits and setup. Keep vulnerable BOLA mode local; the hosted service is shared and anyone with the URL can register.

Current build and runtime verification results are recorded in [validation status](docs/validation.md).
