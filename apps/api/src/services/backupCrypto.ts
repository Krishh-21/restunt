import { createDecipheriv, randomUUID } from 'crypto';
import { createReadStream, createWriteStream, constants } from 'fs';
import { open, stat, copyFile, unlink } from 'fs/promises';
import { dirname, resolve } from 'path';
import { pipeline } from 'stream/promises';
export async function decryptBackup(source: string, destination: string, key: Buffer) {
  if (key.length !== 32) throw new Error('A 32-byte backup key is required');
  const size = (await stat(source)).size;
  if (size < 36) throw new Error('Invalid backup file');
  const input = await open(source, 'r');
  const header = Buffer.alloc(20),
    tag = Buffer.alloc(16);
  try {
    await input.read(header, 0, 20, 0);
    await input.read(tag, 0, 16, size - 16);
  } finally {
    await input.close();
  }
  if (header.subarray(0, 8).toString() !== 'DINELY01') throw new Error('Unknown backup format');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(8));
  decipher.setAuthTag(tag);
  const temporary = resolve(dirname(destination), '.dinely-restore-' + randomUUID() + '.tmp');
  try {
    await pipeline(
      createReadStream(source, { start: 20, end: size - 17 }),
      decipher,
      createWriteStream(temporary, { flags: 'wx', mode: 0o600 })
    );
    await copyFile(temporary, destination, constants.COPYFILE_EXCL);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
