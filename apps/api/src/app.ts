import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { createSession, createUser, resetDatabase, verifyPassword, type LabDatabase } from './db.js';

type LabRequest = Request & { userId?: string };
export type AuthzMode = 'vulnerable' | 'corrected';
const dollars = (cents: number) => Number((cents / 100).toFixed(2));
const LAB_CONSOLE_KEY = 'SC-LAB-PRIV-4D92A7'; // Exercise A: synthetic key deliberately bundled in the APK.

export function createApp(db: LabDatabase, mode: AuthzMode = 'vulnerable', options: { allowReset?: boolean } = {}) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  const fail = (res: Response, status: number, code: string, message: string) =>
    res.status(status).json({ error: { code, message } });
  const auth = async (req: LabRequest, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const session = await db.prepare('SELECT user_id FROM sessions WHERE token = ?').get<{ user_id: string }>(token);
    if (!session) return fail(res, 401, 'UNAUTHENTICATED', 'A valid lab session is required.');
    req.userId = session.user_id;
    next();
  };
  const accountFor = (id: string) => db.prepare(
    'SELECT id,user_id,label,balance_cents FROM accounts WHERE id = ?',
  ).get<{ id: string; user_id: string; label: string; balance_cents: number }>(id);
  const routeId = (value: string | string[]): string => Array.isArray(value) ? value[0] ?? '' : value;
  const authorizeRead = (req: LabRequest, res: Response, account: { user_id: string }) => {
    // EXERCISE B: vulnerable mode omits the ownership check after authentication.
    if (mode === 'corrected' && account.user_id !== req.userId) {
      fail(res, 403, 'FORBIDDEN', 'You do not own this account.');
      return false;
    }
    return true;
  };

  app.get('/health', (_req, res) => res.json({ status: 'ok', lab: 'InsecureBank RN' }));
  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return fail(res, 400, 'INVALID_REQUEST', 'Email and password are required.');
    }
    const user = await db.prepare('SELECT id,name,email,password_hash FROM users WHERE email = ?')
      .get<{ id: string; name: string; email: string; password_hash: string }>(email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.password_hash)) return fail(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const token = await createSession(db, user.id);
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  });
  app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 ||
        typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 ||
        typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return fail(res, 400, 'INVALID_REGISTRATION', 'Provide a name, valid email address, and password of at least 8 characters.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)) {
      return fail(res, 409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }
    try {
      const created = await createUser(db, name.trim(), normalizedEmail, password);
      const token = await createSession(db, created.id);
      return res.status(201).json({ token, user: { id: created.id, name: name.trim(), email: normalizedEmail } });
    } catch (error) {
      if (error instanceof Error && (error.message.includes('UNIQUE constraint failed') || ['23505', 'ER_DUP_ENTRY'].includes((error as Error & { code?: string }).code ?? ''))) {
        return fail(res, 409, 'EMAIL_IN_USE', 'An account with this email already exists.');
      }
      throw error;
    }
  });
  app.post('/api/logout', auth, async (req: LabRequest, res) => {
    const token = (req.header('authorization') ?? '').slice(7);
    await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.json({ ok: true });
  });
  app.get('/api/me', auth, async (req: LabRequest, res) => {
    const user = await db.prepare(`SELECT users.id,users.name,users.email,users.phone,accounts.id AS account_id
      FROM users JOIN accounts ON accounts.user_id = users.id WHERE users.id = ?`).get(req.userId);
    return res.json({ user });
  });
  app.get('/api/accounts/:accountId', auth, async (req: LabRequest, res) => {
    const account = await accountFor(routeId(req.params.accountId));
    if (!account) return fail(res, 404, 'ACCOUNT_NOT_FOUND', 'Account not found.');
    if (!authorizeRead(req, res, account)) return;
    return res.json({ account: { id: account.id, label: account.label, balance: dollars(account.balance_cents) } });
  });
  app.get('/api/accounts/:accountId/transactions', auth, async (req: LabRequest, res) => {
    const account = await accountFor(routeId(req.params.accountId));
    if (!account) return fail(res, 404, 'ACCOUNT_NOT_FOUND', 'Account not found.');
    if (!authorizeRead(req, res, account)) return;
    const rows = await db.prepare(`SELECT id,description,amount_cents,created_at FROM transactions
      WHERE account_id = ? ORDER BY created_at DESC`).all<{ id: string; description: string; amount_cents: number; created_at: string }>(account.id);
    return res.json({ transactions: rows.map((row) => ({
      id: row.id, description: row.description, amount: dollars(row.amount_cents), date: row.created_at,
    })) });
  });
  app.post('/api/transfers', auth, async (req: LabRequest, res) => {
    const { fromAccountId, toAccountId, amount } = req.body ?? {};
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0 || fromAccountId === toAccountId) {
      return fail(res, 400, 'INVALID_TRANSFER', 'Provide a positive amount and two different accounts.');
    }
    const from = await accountFor(fromAccountId);
    const to = await accountFor(toAccountId);
    if (!from || !to) return fail(res, 404, 'ACCOUNT_NOT_FOUND', 'Transfer account not found.');
    if (from.user_id !== req.userId) return fail(res, 403, 'FORBIDDEN', 'You do not own the source account.');
    if (from.balance_cents < cents) return fail(res, 400, 'INSUFFICIENT_FUNDS', 'The source account has insufficient funds.');
    const at = new Date().toISOString();
    await db.batch([
      { sql: 'UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?', params: [cents, from.id] },
      { sql: 'UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?', params: [cents, to.id] },
      { sql: 'INSERT INTO transactions VALUES (?,?,?,?,?)', params: [`txn-${randomUUID()}-out`, from.id, 'Lab transfer', -cents, at] },
      { sql: 'INSERT INTO transactions VALUES (?,?,?,?,?)', params: [`txn-${randomUUID()}-in`, to.id, 'Lab transfer', cents, at] },
    ]);
    return res.status(201).json({ ok: true, amount: dollars(cents), fromAccountId, toAccountId });
  });
  app.post('/api/lab/reset', async (_req, res) => {
    if (!options.allowReset) return fail(res, 404, 'NOT_FOUND', 'Route not found.');
    await resetDatabase(db);
    return res.json({ ok: true, message: 'Lab database restored to seeded state.' });
  });
  // Exercise A: the fake shared key grants only synthetic training information.
  app.get('/api/lab/support-info', (req, res) => {
    if (req.header('x-lab-console-key') !== LAB_CONSOLE_KEY) {
      return fail(res, 403, 'INVALID_LAB_KEY', 'The lab console key is required.');
    }
    return res.json({ notice: 'Training only: synthetic support desk extension 4001.' });
  });
  // Exercise C: synthetic account data intentionally crosses the emulator link in plaintext HTTP.
  app.get('/api/lab/cleartext/:accountId', auth, async (req: LabRequest, res) => {
    const account = await accountFor(routeId(req.params.accountId));
    if (!account || account.user_id !== req.userId) return fail(res, 403, 'FORBIDDEN', 'Lab data unavailable.');
    return res.json({ demo: 'SYNTHETIC ONLY — sent over HTTP for the transport exercise',
      accountId: account.id, balance: dollars(account.balance_cents) });
  });
  app.use((_req, res) => fail(res, 404, 'NOT_FOUND', 'Route not found.'));
  return app;
}
