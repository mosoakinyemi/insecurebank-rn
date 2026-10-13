# Exercise D — insecure local storage

## Objective and affected files

Show that AsyncStorage is ordinary persistent app-private storage, not a protected credential vault.

- `src/App.tsx`: saves and restores `insecurebank.session` through `@react-native-async-storage/async-storage`.
- `package.json`: native AsyncStorage dependency.

## Static discovery

Search the React Native source for `AsyncStorage.setItem`, `AsyncStorage.getItem`, and `insecurebank.session`. The token is restored during startup and removed at logout.

## Runtime validation and evidence

Sign in on a debuggable lab install, then use Android Studio's Device Explorer or a supported `run-as` shell to inspect the app-private database directory. AsyncStorage's Android implementation stores values in app-private database storage; the exact file layout depends on the installed library version. First list the directory rather than assuming a filename:

```sh
adb shell run-as com.insecurebankrn ls databases
```

Use SQLite tooling or Device Explorer to inspect the resulting database while the app is stopped if needed. The expected evidence is the synthetic `lab_…` session value. A non-rooted production Android sandbox restricts other apps from reading this directory; this exercise does not claim that any ordinary app can read another app's private files.

## Prerequisites, impact, and false positives

Access to the app's private files is required, such as a controlled debuggable/rooted test environment. Finding a token in app-private storage is not by itself proof of remote compromise. The risk is that a valid bearer credential persists in a location without application-level encryption and can be reused if an attacker crosses the device/app boundary.

## Remediation and verification

Avoid persisting sensitive tokens where possible; prefer short-lived, revocable tokens and clear them on logout/expiry. When persistence is required, use a maintained secure-storage library backed by Android Keystore-protected encryption, and document backup, key invalidation, and device-compromise limits. A controlled verification is to confirm sign-in still works while no reusable token appears in ordinary AsyncStorage; that alternative is not implemented in this training build.
