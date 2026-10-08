import { backupKey } from '../apps/api/src/services/backupService';
import { decryptBackup } from '../apps/api/src/services/backupCrypto';
const [source, destination] = process.argv.slice(2);
if (!source || !destination) {
  console.error('Usage: npm run backup:decrypt -- encrypted.dump.aes restored.dump');
  process.exitCode = 1;
} else
  decryptBackup(source, destination, backupKey())
    .then(() => console.log('Verified and decrypted. No database was modified.'))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
