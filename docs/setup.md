# Setup and API contract

## Local environment

Install Node.js 22.11+, npm, Java 17, Android Studio / SDK, Android platform tools, and an Android emulator. The current React Native CLI project targets Android SDK 36 and Build Tools 36.0.0. Set `JAVA_HOME` to JDK 17 and `ANDROID_HOME` to the SDK path if the shell does not already resolve them. On this machine those are `/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home` and `/Users/mosolasiakinyemi/Library/Android/sdk`.

Copy `.env.example` to `.env` to configure local runs. The example contains a fake mobile value for Exercise G; do not add real secrets.

From the repository root:

```sh
npm install
npm run reset
npm run api
```

`GET http://127.0.0.1:3000/health` should return `{"status":"ok","lab":"InsecureBank RN"}`. In a second terminal, start an Android emulator, run `npm start`, then `npm run android`. When changing host routing, set `LAB_API_BASE_URL` before starting Metro and pass the same value to the Android command, e.g. `LAB_API_BASE_URL=http://10.0.3.2:3000 npm start` and `LAB_API_BASE_URL=http://10.0.3.2:3000 npm run android` for a typical Genymotion setup.

Android's `localhost` is the emulator itself. The standard Android Emulator host alias is `10.0.2.2`, which maps to the development machine's loopback. The API stays bound to `127.0.0.1`; don't bind it to all interfaces for the standard emulator workflow.

For a physical device on a trusted isolated LAN, temporarily run `API_HOST=0.0.0.0 npm run api`, set `LAB_API_BASE_URL` to the host's LAN IP, and restore loopback immediately after the demo. Do not expose this API publicly.

### Account registration

`POST /api/register` accepts JSON `{ "name", "email", "password" }`. It creates a synthetic account, hashes the password, creates a session, and returns `{ "token", "user" }`. Names must be 2–80 characters, passwords 8–128 characters, and emails valid and unique. Registration has no verification or recovery flow.

## Optional shared API on Render

For a shared audience playground, follow [the Render + Aiven deployment guide](deploy-render.md). The Blueprint intentionally enables vulnerable authorization on the public service and disables reset. Use synthetic data only; anyone with the service URL can register and exercise the BOLA flaw. Local mode defaults to SQLite. Set `MYSQL_URL` and `MYSQL_SSL_CA` to use a TLS-verified MySQL database in another environment.

## Commands

```sh
npm run api                 # vulnerable BOLA mode, loopback only
npm run api:corrected       # corrected account ownership checks
npm run reset               # restore deterministic seeds; invalidates sessions
npm test                    # isolated in-memory API tests
npm run typecheck           # mobile and API TypeScript checks
npm run build:apk           # release variant, bundled JS, debug signing key
```

`npm run android` is the development install flow and requires Metro. `npm run build:apk` creates `dist/insecurebank-rn-lab-training.apk`; the generated artifact targets `arm64-v8a` to fit the available emulator storage and is a debug-signed training build, not a distributable production APK. Change `reactNativeArchitectures` in `android/gradle.properties` for a different device ABI. `adb install -r dist/insecurebank-rn-lab-training.apk` installs it on a connected emulator.

## API contract

All error responses use `{"error":{"code":"...","message":"..."}}`.

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | No | Health check |
| `POST /api/login` | No | JSON `{ "email", "password" }`; returns `{ "token", "user" }` |
| `POST /api/register` | No | Creates a synthetic user and account; returns a session |
| `POST /api/logout` | Bearer | Invalidates current session |
| `GET /api/me` | Bearer | Current profile and owned account ID |
| `GET /api/accounts/:accountId` | Bearer | Account summary; ownership behavior depends on BOLA mode |
| `GET /api/accounts/:accountId/transactions` | Bearer | Transaction history; ownership behavior depends on mode |
| `POST /api/transfers` | Bearer | JSON `{ "fromAccountId", "toAccountId", "amount" }` |
| `POST /api/lab/reset` | No | Reset synthetic database and sessions; local lab only |
| `GET /api/lab/cleartext/:accountId` | Bearer | Synthetic response intentionally sent over HTTP |
| `GET /api/lab/support-info` | `X-Lab-Console-Key` | Exercise A's fake shared key demo |

## BOLA request sequence

In one terminal, start `npm run api`. Then use a controlled API client or `curl`:

```sh
TOKEN=$(curl -s http://127.0.0.1:3000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@lab.test","password":"lab-ada-2468"}' | jq -r .token)
curl -i http://127.0.0.1:3000/api/accounts/acct-1001 -H "Authorization: Bearer $TOKEN"
curl -i http://127.0.0.1:3000/api/accounts/acct-2002 -H "Authorization: Bearer $TOKEN"
```

In vulnerable mode, the second request returns Grace's synthetic account summary even though the token belongs to Ada. Start `npm run api:corrected`, log in again for a fresh token, and send the same modified request: it returns `403 FORBIDDEN`. Do not infer this result from client navigation; the API tests exercise the server boundary directly.
