import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type CachingState = {
  graphCacheEnabled: boolean;
  healthCacheEnabled: boolean;
  healthStatusMetricsEnabled: boolean;
  mode: 'cluster-already-enabled' | 'cluster-patched' | 'local-config';
};

export const CACHING_STATE_FILE = path.join(__dirname, '../../playwright/.auth/caching-state.json');

export const writeCachingState = (state: CachingState): void => {
  fs.mkdirSync(path.dirname(CACHING_STATE_FILE), { recursive: true });
  fs.writeFileSync(CACHING_STATE_FILE, JSON.stringify(state));
};

export const readCachingState = (): CachingState | undefined => {
  if (!fs.existsSync(CACHING_STATE_FILE)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(CACHING_STATE_FILE, 'utf8')) as CachingState;
};

export const isCachingConfigured = (): boolean => {
  const state = readCachingState();
  if (!state) {
    return false;
  }
  return state.graphCacheEnabled && state.healthCacheEnabled;
};
