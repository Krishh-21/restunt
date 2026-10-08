import { createDatabaseBackup } from '../apps/api/src/services/backupService';
createDatabaseBackup()
  .then((result) => console.log(result))
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
