import Database from 'better-sqlite3';
import mysql, { type Pool, type ResultSetHeader } from 'mysql2/promise';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';

export type SqlParams = readonly unknown[];
export type SqlBatchItem = { sql: string; params?: SqlParams };
export interface LabStatement {
  get<T = Record<string, unknown>>(...params: unknown[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(...params: unknown[]): Promise<T[]>;
  run(...params: unknown[]): Promise<{ changes: number }>;
}
export interface LabDatabase {
  prepare(sql: string): LabStatement;
  batch(items: readonly SqlBatchItem[]): Promise<void>;
  close(): Promise<void>;
}

const sqliteSchema: SqlBatchItem[] = [
  { sql: `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, phone TEXT NOT NULL)` },
  { sql: `CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      label TEXT NOT NULL, balance_cents INTEGER NOT NULL CHECK(balance_cents >= 0))` },
  { sql: `CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
      description TEXT NOT NULL, amount_cents INTEGER NOT NULL, created_at TEXT NOT NULL)` },
  { sql: `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL)` },
];

const mysqlSchema: SqlBatchItem[] = [
  { sql: `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(191) PRIMARY KEY, name VARCHAR(191) NOT NULL, email VARCHAR(254) UNIQUE NOT NULL,
      password_hash VARCHAR(200) NOT NULL, phone VARCHAR(64) NOT NULL)` },
  { sql: `CREATE TABLE IF NOT EXISTS accounts (
      id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL,
      label VARCHAR(191) NOT NULL, balance_cents INT NOT NULL CHECK(balance_cents >= 0),
      FOREIGN KEY (user_id) REFERENCES users(id))` },
  { sql: `CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(191) PRIMARY KEY, account_id VARCHAR(191) NOT NULL,
      description VARCHAR(255) NOT NULL, amount_cents INT NOT NULL, created_at VARCHAR(40) NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id))` },
  { sql: `CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL, created_at VARCHAR(40) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id))` },
];

export function createDatabase(filename = ':memory:'): LabDatabase {
  const raw = new Database(filename);
  raw.pragma('foreign_keys = ON');
  raw.exec(sqliteSchema.map(({ sql }) => sql).join(';'));
  const userColumns = raw.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!userColumns.some((column) => column.name === 'password_hash')) {
    // Older lab databases contain only disposable synthetic data; recreate them with the current schema.
    raw.exec('DROP TABLE sessions; DROP TABLE transactions; DROP TABLE accounts; DROP TABLE users;');
    raw.exec(sqliteSchema.map(({ sql }) => sql).join(';'));
  }
  return {
    prepare(sql) {
      return {
        async get<T>(...params: unknown[]) { return raw.prepare(sql).get(...params) as T | undefined; },
        async all<T>(...params: unknown[]) { return raw.prepare(sql).all(...params) as T[]; },
        async run(...params: unknown[]) { return { changes: raw.prepare(sql).run(...params).changes }; },
      };
    },
    async batch(items) {
      raw.transaction(() => {
        for (const item of items) raw.prepare(item.sql).run(...(item.params ?? []));
      })();
    },
    async close() { raw.close(); },
  };
}

export async function createMySqlDatabase(connectionString: string, caCertificate: string): Promise<LabDatabase> {
  if (!caCertificate.trim()) throw new Error('MYSQL_SSL_CA must contain the Aiven project CA certificate.');
  const uri = new URL(connectionString);
  if (uri.protocol !== 'mysql:') throw new Error('MYSQL_URL must use the mysql:// scheme from Aiven.');
  const pool: Pool = mysql.createPool({
    host: uri.hostname,
    port: Number(uri.port || 3306),
    user: decodeURIComponent(uri.username),
    password: decodeURIComponent(uri.password),
    database: decodeURIComponent(uri.pathname.replace(/^\//, '')),
    waitForConnections: true,
    connectionLimit: 5,
    ssl: { ca: caCertificate, rejectUnauthorized: true },
  });
  const db: LabDatabase = {
    prepare(sql) {
      return {
        async get<T>(...params: unknown[]) {
          const [rows] = await pool.execute(sql, [...params] as never[]);
          return (rows as T[])[0];
        },
        async all<T>(...params: unknown[]) {
          const [rows] = await pool.execute(sql, [...params] as never[]);
          return rows as T[];
        },
        async run(...params: unknown[]) {
          const [result] = await pool.execute(sql, [...params] as never[]);
          return { changes: (result as ResultSetHeader).affectedRows };
        },
      };
    },
    async batch(items) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        for (const item of items) await connection.execute(item.sql, [...(item.params ?? [])] as never[]);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally { connection.release(); }
    },
    async close() { await pool.end(); },
  };
  await db.batch(mysqlSchema);
  return db;
}

export async function resetDatabase(db: LabDatabase): Promise<void> {
  const rows: SqlBatchItem[] = [
    { sql: 'DELETE FROM sessions' }, { sql: 'DELETE FROM transactions' },
    { sql: 'DELETE FROM accounts' }, { sql: 'DELETE FROM users' },
    { sql: 'INSERT INTO users (id,name,email,password_hash,phone) VALUES (?,?,?,?,?)', params: ['user-ada', 'Ada Lovelace', 'ada@lab.test', hashPassword('lab-ada-2468'), '+1 555 0101'] },
    { sql: 'INSERT INTO users (id,name,email,password_hash,phone) VALUES (?,?,?,?,?)', params: ['user-grace', 'Grace Hopper', 'grace@lab.test', hashPassword('lab-grace-1357'), '+1 555 0102'] },
    { sql: 'INSERT INTO accounts (id,user_id,label,balance_cents) VALUES (?,?,?,?)', params: ['acct-1001', 'user-ada', 'Everyday account', 248050] },
    { sql: 'INSERT INTO accounts (id,user_id,label,balance_cents) VALUES (?,?,?,?)', params: ['acct-2002', 'user-grace', 'Everyday account', 731420] },
  ];
  const seeded = [
    ['txn-a1', 'acct-1001', 'Workshop stipend', 250000, '2026-10-01T09:00:00.000Z'],
    ['txn-a2', 'acct-1001', 'Coffee House', -1950, '2026-10-03T13:20:00.000Z'],
    ['txn-g1', 'acct-2002', 'Training honorarium', 750000, '2026-10-02T10:30:00.000Z'],
    ['txn-g2', 'acct-2002', 'Bookshop', -18580, '2026-10-04T15:00:00.000Z'],
  ] as const;
  for (const transaction of seeded) rows.push({ sql: 'INSERT INTO transactions (id,account_id,description,amount_cents,created_at) VALUES (?,?,?,?,?)', params: transaction });
  await db.batch(rows);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  return scryptSync(password, salt, 64).toString('hex') === expected;
}

export async function createUser(db: LabDatabase, name: string, email: string, password: string): Promise<{ id: string; accountId: string }> {
  const id = `user-${randomUUID()}`;
  const accountId = `acct-${randomUUID()}`;
  await db.batch([
    { sql: 'INSERT INTO users (id,name,email,password_hash,phone) VALUES (?,?,?,?,?)', params: [id, name, email, hashPassword(password), ''] },
    { sql: 'INSERT INTO accounts (id,user_id,label,balance_cents) VALUES (?,?,?,?)', params: [accountId, id, 'Everyday account', 250000] },
  ]);
  return { id, accountId };
}

export async function createSession(db: LabDatabase, userId: string): Promise<string> {
  const token = `lab_${randomUUID()}`;
  await db.prepare('INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)')
    .run(token, userId, new Date().toISOString());
  return token;
}
