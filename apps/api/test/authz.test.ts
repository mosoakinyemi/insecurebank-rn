import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp, type AuthzMode } from '../src/app.js';
import { createDatabase, resetDatabase, type LabDatabase } from '../src/db.js';

describe('InsecureBank lab API', () => {
  let db: LabDatabase | undefined;
  let server: import('node:http').Server | undefined;
  let base: string;

  async function start(mode: AuthzMode, allowReset = true) {
    db = createDatabase();
    await resetDatabase(db);
    const instance = createApp(db, mode, { allowReset }).listen(0, '127.0.0.1');
    server = instance;
    await new Promise<void>((resolve) => instance.once('listening', resolve));
    base = `http://127.0.0.1:${(instance.address() as AddressInfo).port}`;
  }
  async function login() {
    const response = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ada@lab.test', password: 'lab-ada-2468' }) });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  }

  afterEach(async () => {
    const activeServer = server;
    if (activeServer?.listening) await new Promise<void>((resolve, reject) => activeServer.close((error) => error ? reject(error) : resolve()));
    await db?.close();
    db = undefined;
    server = undefined;
  });

  it('health responds and seeded login returns an authenticated session', async () => {
    await start('vulnerable');
    assert.deepEqual(await (await fetch(`${base}/health`)).json(), { status: 'ok', lab: 'InsecureBank RN' });
    const token = await login();
    const own = await fetch(`${base}/api/accounts/acct-1001`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(own.status, 200);
    assert.deepEqual(await own.json(), { account: { id: 'acct-1001', label: 'Everyday account', balance: 2480.5 } });
  });

  it('registers an account with a hashed password and rejects duplicates', async () => {
    await start('corrected');
    const response = await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Tester', email: 'New@Test.Lab', password: 'training-pass-123' }) });
    assert.equal(response.status, 201);
    const created = await response.json() as { token: string; user: { email: string } };
    assert.equal(created.user.email, 'new@test.lab');
    const row = await db?.prepare('SELECT password_hash FROM users WHERE email = ?').get<{ password_hash: string }>('new@test.lab');
    assert.ok(row);
    assert.doesNotMatch(row.password_hash, /training-pass-123/);
    const profileResponse = await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${created.token}` } });
    assert.equal(profileResponse.status, 200);
    const profile = await profileResponse.json() as { user: { account_id: string } };
    assert.equal((await fetch(`${base}/api/accounts/${profile.user.account_id}`, { headers: { authorization: `Bearer ${created.token}` } })).status, 200);
    assert.equal((await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Again', email: 'new@test.lab', password: 'training-pass-123' }) })).status, 409);
  });

  it('does not expose database reset in hosted mode', async () => {
    await start('corrected', false);
    const response = await fetch(`${base}/api/lab/reset`, { method: 'POST' });
    assert.equal(response.status, 404);
  });

  it('vulnerable mode returns another synthetic account to an authenticated user', async () => {
    await start('vulnerable');
    const token = await login();
    const response = await fetch(`${base}/api/accounts/acct-2002`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { account: { id: 'acct-2002', label: 'Everyday account', balance: 7314.2 } });
    const history = await fetch(`${base}/api/accounts/acct-2002/transactions`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(history.status, 200);
    assert.equal((await history.json() as { transactions: { description: string }[] }).transactions[0].description, 'Bookshop');
  });

  it('corrected mode rejects cross-account reads for account and transaction endpoints', async () => {
    await start('corrected');
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };
    assert.equal((await fetch(`${base}/api/accounts/acct-2002`, { headers })).status, 403);
    assert.equal((await fetch(`${base}/api/accounts/acct-2002/transactions`, { headers })).status, 403);
  });

  it('transfers update both synthetic balances and reset restores seeded values', async () => {
    await start('corrected');
    const token = await login();
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const response = await fetch(`${base}/api/transfers`, { method: 'POST', headers,
      body: JSON.stringify({ fromAccountId: 'acct-1001', toAccountId: 'acct-2002', amount: 25 }) });
    assert.equal(response.status, 201);
    assert.equal((await db?.prepare('SELECT balance_cents FROM accounts WHERE id = ?').get<{ balance_cents: number }>('acct-1001'))?.balance_cents, 245550);
    assert.equal((await db?.prepare('SELECT balance_cents FROM accounts WHERE id = ?').get<{ balance_cents: number }>('acct-2002'))?.balance_cents, 733920);
    const reset = await fetch(`${base}/api/lab/reset`, { method: 'POST' });
    assert.equal(reset.status, 200);
    assert.equal((await fetch(`${base}/api/accounts/acct-1001`, { headers })).status, 401);
    const fresh = await login();
    assert.equal((await (await fetch(`${base}/api/accounts/acct-1001`, { headers: { authorization: `Bearer ${fresh}` } })).json() as any).account.balance, 2480.5);
  });

  it('hardcoded lab console key exposes only synthetic support information', async () => {
    await start('corrected');
    const denied = await fetch(`${base}/api/lab/support-info`);
    const allowed = await fetch(`${base}/api/lab/support-info`, { headers: { 'x-lab-console-key': 'SC-LAB-PRIV-4D92A7' } });
    assert.equal(denied.status, 403);
    assert.equal(allowed.status, 200);
    assert.match(JSON.stringify(await allowed.json()), /synthetic support desk/);
  });
});
