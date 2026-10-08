import '../apps/api/src/lib/loadEnv';
import { createDatabaseBackup, backupKey } from '../apps/api/src/services/backupService';
import { decryptBackup } from '../apps/api/src/services/backupCrypto';
import { Client } from 'pg';
import { randomBytes } from 'crypto';
import { resolve } from 'path';
import { unlink } from 'fs/promises';
import { spawn } from 'child_process';
async function main() {
  if (process.env.BACKUP_SMOKE_TEST !== 'true' || process.env.NODE_ENV === 'production')
    throw new Error('Backup smoke test is restricted to explicit development/CI runs');
  const connection = new URL(process.env.DATABASE_URL!);
  const admin = new Client({ connectionString: connection.toString() });
  await admin.connect();
  const name = 'dinely_restore_test_' + randomBytes(8).toString('hex');
  let encrypted: string | undefined, plain: string | undefined;
  try {
    const result = await createDatabaseBackup();
    if (result.storage !== 'local')
      throw new Error('Smoke test requires local-only backup storage');
    encrypted = resolve(process.env.BACKUP_DIRECTORY!, 'dinely-backups', result.name);
    plain = encrypted + '.verified.dump';
    await decryptBackup(encrypted, plain, backupKey());
    await admin.query('CREATE DATABASE ' + name);
    connection.pathname = '/' + name;
    await new Promise<void>((done, reject) => {
      const child = spawn(
        'pg_restore',
        ['--no-owner', '--no-acl', '--exit-on-error', '--dbname', name, plain!],
        {
          stdio: 'ignore',
          env: {
            ...process.env,
            PGHOST: connection.hostname,
            PGPORT: connection.port || '5432',
            PGUSER: decodeURIComponent(connection.username),
            PGPASSWORD: decodeURIComponent(connection.password),
          },
        }
      );
      child.once('error', reject);
      child.once('close', (code) =>
        code === 0 ? done() : reject(new Error('Isolated restore failed'))
      );
    });
    const restored = new Client({ connectionString: connection.toString() });
    await restored.connect();
    try {
      const rows = await restored.query(
        `SELECT COUNT(*)::int AS count FROM pg_tables WHERE schemaname IN ('public','tenant')`
      );
      if (rows.rows[0].count < 10) throw new Error('Restored schema incomplete');
      console.log('Encrypted backup decrypted and restored into isolated database successfully');
    } finally {
      await restored.end();
    }
  } finally {
    await admin.query('DROP DATABASE IF EXISTS ' + name + ' WITH (FORCE)');
    await admin.end();
    if (plain) await unlink(plain).catch(() => undefined);
    if (encrypted) await unlink(encrypted).catch(() => undefined);
  }
}
main().catch(() => {
  console.error('Backup recovery smoke test failed');
  process.exitCode = 1;
});
