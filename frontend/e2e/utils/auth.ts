import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Shared auth state path used by auth.setup.ts and playwright.config.ts projects. */
export const AUTH_FILE = path.join(__dirname, '../../playwright/.auth/user.json');
