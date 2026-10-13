import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load the project-root .env for local runs. Hosting providers inject their own env vars.
export function loadLocalEnv() {
  let contents: string;
  try { contents = readFileSync(resolve('../../.env'), 'utf8'); } catch { return; }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2').replace(/\s+#.*$/, '');
    process.env[match[1]] = value;
  }
}
