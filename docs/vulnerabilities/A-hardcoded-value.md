# Exercise A — hardcoded client credential

## Objective and affected files

Show that a shared key included in a mobile bundle is recoverable and can be replayed. The key is synthetic and grants access only to a harmless training response.

- `src/config.ts`: `LAB_SUPPORT_KEY` is bundled into React Native JavaScript; `android/app/src/main/res/values/strings.xml` mirrors the exact fake value for Android resource inspection.
- `src/App.tsx`: profile action sends it as `X-Lab-Console-Key`.
- `apps/api/src/app.ts`: `/api/lab/support-info` validates it and returns synthetic help text.

## Static discovery

Build the inspection APK, open it in JADX, and search for `SC-LAB-PRIV-4D92A7` or `LAB_SUPPORT_KEY`. It is present in the compiled `lab_support_key` Android resource and in the app source; React Native JavaScript may be Hermes bytecode rather than readable TypeScript. The resource is an inspection aid containing the same fake value. This is a fake privileged client credential. `LAB_API_BASE_URL` is only a public endpoint setting and must not be treated as a credential.

## Runtime validation and expected evidence

Sign in, open Profile, and tap **Open support info (Exercise A)**. The app shows a fictional support extension. Reproduce outside the UI against the local API:

```sh
curl -i http://127.0.0.1:3000/api/lab/support-info \
  -H 'X-Lab-Console-Key: SC-LAB-PRIV-4D92A7'
```

Expected body: `{"notice":"Training only: synthetic support desk extension 4001."}`. Without the header, the API returns `403 INVALID_LAB_KEY`.

## Prerequisites, impact, and false positives

The caller needs the APK or app bundle and network reachability to the local API. A discovered string is not automatically a vulnerability: public app configuration is expected to be visible. The weakness is using a value that the server treats as privileged authorization while shipping it to every client. In this lab the impact is deliberately limited to synthetic information; real keys must never be embedded in a mobile client.

## Remediation and verification

Do not rely on a shared client secret. Authenticate each user and make authorization decisions on the server. Remove the `X-Lab-Console-Key` flow and use a server-side credential only between trusted services. The automated API test confirms the demo key is required for the synthetic route; it does not validate a production secret-management design.
