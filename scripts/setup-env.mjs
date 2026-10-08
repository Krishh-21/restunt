import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) console.log('.env already exists; left unchanged.');
else {
  let example = readFileSync('.env.example', 'utf8');
  const databasePassword = randomBytes(24).toString('hex');
  example = example.replaceAll('local-development-only', databasePassword);
  example = example
    .replace(/^JWT_SECRET=.*$/m, 'JWT_SECRET=' + randomBytes(48).toString('base64url'))
    .replace(
      /^BACKUP_ENCRYPTION_KEY=.*$/m,
      'BACKUP_ENCRYPTION_KEY=' + randomBytes(32).toString('hex')
    );
  writeFileSync('.env', example, { mode: 0o600, flag: 'wx' });
  console.log(
    'Created .env with generated secrets. Keep it private and store the backup key separately.'
  );
}
