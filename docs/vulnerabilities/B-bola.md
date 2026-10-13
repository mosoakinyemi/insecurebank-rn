# Exercise B — broken object-level authorization

## Objective and affected files

Demonstrate a genuine server-side ownership failure with two authenticated users and deterministic accounts.

- `apps/api/src/app.ts`: vulnerable/corrected account and history checks.
- `apps/api/src/db.ts`: deterministic users and account IDs.
- `apps/api/test/authz.test.ts`: tests both outcomes.

## Static discovery

Trace the bearer-auth middleware in `apps/api/src/app.ts` into `GET /api/accounts/:accountId`. Authentication identifies the caller, but vulnerable mode does not compare the requested account's `user_id` with the session's `userId`. The account identifier is an object selector, not proof of ownership.

## Runtime reproduction and evidence

Start `npm run reset` and then `npm run api`. Sign in as Ada and copy the token:

```sh
TOKEN=$(curl -s http://127.0.0.1:3000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@lab.test","password":"lab-ada-2468"}' | jq -r .token)
curl -i http://127.0.0.1:3000/api/accounts/acct-1001 -H "Authorization: Bearer $TOKEN"
curl -i http://127.0.0.1:3000/api/accounts/acct-2002 -H "Authorization: Bearer $TOKEN"
```

The first request returns Ada's account with `$2,480.50`; the modified identifier in the second returns Grace's account with `$7,314.20` in vulnerable mode. The same pattern works for `/api/accounts/acct-2002/transactions`. Use a controlled API client or an intercepting proxy to change the path identifier while preserving Ada's valid bearer token.

Stop that server and run `npm run api:corrected`. Log in again, then repeat the modified request. Expected response: HTTP 403 with `{"error":{"code":"FORBIDDEN","message":"You do not own this account."}}`.

## Prerequisites, impact, and false positives

The demonstration requires a valid Ada session and the synthetic account ID. Authentication succeeds in both cases; authorization is the failed control. The finding is not inferred from a client screen or a guessed ID alone: the cross-owner response is returned by the API. The impact here is synthetic account and transaction disclosure; real impact depends on actual data and reachable identifiers.

## Correction and verification

Corrected mode compares `account.user_id` with the authenticated session for both account and history reads. Transfers independently check source-account ownership in every mode. Run `npm test`; tests assert that vulnerable mode returns Grace's fixture and corrected mode rejects account and transaction reads. The client does not decide whether the read is allowed.
