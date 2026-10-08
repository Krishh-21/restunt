import { config } from 'dotenv';
import { resolve } from 'path';
// npm workspaces run with a workspace cwd; load one root configuration consistently.
config({ path: resolve(__dirname, '../../../..', '.env') });
