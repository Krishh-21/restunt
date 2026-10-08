import { createCipheriv, randomBytes } from 'crypto';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { decryptBackup } from './backupCrypto';
test('encrypted backups authenticate before publishing decrypted output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dinely-test-'));
  try {
    const key = randomBytes(32),
      iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      Buffer.from('DINELY01'),
      iv,
      cipher.update('database-content'),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    const source = join(directory, 'backup.aes'),
      target = join(directory, 'restored.dump');
    await writeFile(source, encrypted);
    await decryptBackup(source, target, key);
    expect((await readFile(target)).toString()).toBe('database-content');
    await expect(decryptBackup(source, target, key)).rejects.toThrow();
    encrypted[25] ^= 1;
    await writeFile(source, encrypted);
    await expect(decryptBackup(source, join(directory, 'tampered.dump'), key)).rejects.toThrow();
    await expect(readFile(join(directory, 'tampered.dump'))).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
