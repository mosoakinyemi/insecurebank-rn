import { resolve } from 'node:path';
import { loadLocalEnv } from './env.js';
import { createDatabase, createMySqlDatabase, resetDatabase } from './db.js';

loadLocalEnv();
const db = process.env.MYSQL_URL
  ? await createMySqlDatabase(process.env.MYSQL_URL, process.env.MYSQL_SSL_CA ?? '')
  : createDatabase(process.env.LAB_DB_PATH ?? resolve('lab.sqlite'));
await resetDatabase(db);
await db.close();
console.log('Lab database reset to deterministic synthetic seed data.');
