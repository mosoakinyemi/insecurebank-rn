# Exercise E — sensitive information in logs

## Objective and affected files

Observe a synthetic bearer token in Android logs and distinguish it from a value-free event log.

- `src/App.tsx`: the login handler intentionally logs the returned session token.
- `apps/api/src/app.ts`: creates random synthetic bearer sessions.

## Static discovery

Search the JS bundle or source for `[EXERCISE E]` and `console.log`. The same handler includes a corrected alternative (`console.info`) that records only successful sign-in without the token; set `SHOW_VULNERABLE_LOG` to `false` to use it.

## Runtime validation and evidence

Clear old logs, start logcat, and sign in:

```sh
adb logcat -c
adb logcat | grep 'EXERCISE E'
```

Expected evidence is the synthetic `lab_…` token in the login event. Android may filter or restrict logs differently by build and OS version; if the message is absent, inspect the app's React Native console in Android Studio and confirm the chosen log mode.

## Prerequisites, impact, and false positives

The demonstration needs an installed lab app and a way to observe its process logs. A log call in source is a strong indicator, but the actual exposure depends on how the build and device handle logs. A token can be replayed while valid if another party can read it.

## Remediation and verification

Remove access tokens, passwords, and sensitive request/response values from logs. Log a non-sensitive event and correlation ID instead. Set `SHOW_VULNERABLE_LOG` to `false`, rebuild, sign in, and confirm the event appears without the token. The default remains vulnerable for this training build.
