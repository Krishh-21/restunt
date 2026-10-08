import '../lib/loadEnv';
import { spawn } from 'child_process';
import { createCipheriv, randomBytes, randomUUID } from 'crypto';
import { createWriteStream, createReadStream } from 'fs';
import { mkdir, appendFile, unlink, stat } from 'fs/promises';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { pipeline } from 'stream/promises';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../lib/s3';
export function backupKey(value = process.env.BACKUP_ENCRYPTION_KEY) {
  if (!value || !/^([a-f0-9]{64})$/i.test(value))
    throw new Error('Set BACKUP_ENCRYPTION_KEY to 64 hexadecimal characters');
  return Buffer.from(value, 'hex');
}
export async function createDatabaseBackup() {
  const key = backupKey();
  const database = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL || '');
  const bucket = process.env.AWS_BUCKET_NAME;
  const destination = process.env.BACKUP_DIRECTORY;
  if (!bucket && !destination) throw new Error('Configure BACKUP_DIRECTORY or AWS_BUCKET_NAME');
  const directory = resolve(destination || tmpdir(), 'dinely-backups');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const name = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID() + '.dump.aes';
  const file = resolve(directory, name);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const dump = spawn(
    process.env.PG_DUMP_BIN || 'pg_dump',
    ['--format=custom', '--no-owner', '--no-acl'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PGHOST: database.hostname,
        PGPORT: database.port || '5432',
        PGDATABASE: decodeURIComponent(database.pathname.slice(1)),
        PGUSER: decodeURIComponent(database.username),
        PGPASSWORD: decodeURIComponent(database.password),
        PGSSLMODE: database.searchParams.get('sslmode') || process.env.PGSSLMODE || 'prefer',
      },
    }
  );
  dump.stderr.resume();
  const finished = new Promise<void>((done, reject) => {
    dump.once('error', () =>
      reject(new Error('pg_dump could not start; install a client matching the database server'))
    );
    dump.once('close', (code) =>
      code === 0
        ? done()
        : reject(
            new Error('pg_dump failed; verify DIRECT_URL, permissions and client/server versions')
          )
    );
  });
  // Attach a handler immediately: an early process failure must not become unhandled.
  void finished.catch(() => undefined);
  try {
    const output = createWriteStream(file, { flags: 'wx', mode: 0o600 });
    output.write(Buffer.concat([Buffer.from('DINELY01'), iv]));
    await Promise.all([pipeline(dump.stdout, cipher, output), finished]);
    await appendFile(file, cipher.getAuthTag());
    const size = (await stat(file)).size;
    if (bucket) {
      const objectKey = 'backups/' + name;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: createReadStream(file),
          ContentLength: size,
          ContentType: 'application/octet-stream',
          ServerSideEncryption: 'AES256',
        })
      );
      if (!destination) await unlink(file);
      return { name, bytes: size, storage: 's3', key: objectKey };
    }
    return { name, bytes: size, storage: 'local' };
  } catch (error) {
    dump.kill();
    await unlink(file).catch(() => undefined);
    throw error;
  }
}
