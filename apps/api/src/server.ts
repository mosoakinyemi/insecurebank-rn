import { resolve } from 'node:path';
import { loadLocalEnv } from './env.js';
import { createApp, type AuthzMode } from './app.js';
import { createDatabase, createMySqlDatabase, resetDatabase, type LabDatabase } from './db.js';

loadLocalEnv();
const mode = process.env.NODE_ENV === 'production' ? 'corrected' : process.env.AUTHZ_MODE === 'corrected' ? 'corrected' : 'vulnerable';
const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
async function main() {
  const db: LabDatabase = process.env.MYSQL_URL
    ? await createMySqlDatabase(process.env.MYSQL_URL, process.env.MYSQL_SSL_CA ?? '')
    : createDatabase(process.env.LAB_DB_PATH ?? resolve('lab.sqlite'));
  if (!await db.prepare('SELECT 1 FROM users LIMIT 1').get()) await resetDatabase(db);
  const app = createApp(db, mode as AuthzMode, { allowReset: process.env.LAB_ALLOW_RESET === 'true' && process.env.NODE_ENV !== 'production' });
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
  const server = app.listen(port, host, () => {
    console.log(`InsecureBank RN lab API (${mode} authorization) listening at http://${host}:${port}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => server.close(() => { void db.close().finally(() => process.exit(0)); }));
  }
}
void main().catch((error) => { console.error('API startup failed:', error); process.exitCode = 1; });
