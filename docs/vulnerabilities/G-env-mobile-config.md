# G — `.env` values bundled into a mobile app

## Goal

Show why `.env` files keep local configuration out of Git but do not protect values that are compiled into a client application.

## Exercise

1. Copy `.env.example` to `.env`.
2. Leave `LAB_DEMO_SECRET=FAKE-DEMO-ENV-SECRET-NOT-A-CREDENTIAL` in place.
3. Run Metro and build/install the app.
4. In the app's **Profile & settings → Security lab checks**, inspect the value shown for Exercise G.
5. Inspect the APK's bundled JavaScript or decompile it and search for `FAKE-DEMO-ENV-SECRET`.

The RN build script loads `.env`, and Babel replaces the `process.env.LAB_DEMO_SECRET` reference with a literal during bundling. The resulting value is shipped on the user's device. Putting it in `.env`, excluding `.env` from Git, or obfuscating the bundle does not make a client value secret.

## Discussion

`.env` is useful for local configuration and preventing accidental commits. It is not a vault. A mobile app is controlled by the person who installs it, so API URLs and other public settings can be bundled, while passwords, private signing keys, database credentials, and privileged API tokens must remain on a server. The API's `.env` settings are read by the server process; they are not automatically sent to the phone. Hosted secrets belong in the host's server-side environment settings.

Only the fake training value belongs in this exercise. Do not use any real secret or point the intentionally vulnerable exercises at real accounts or data.
