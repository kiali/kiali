import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures');

/** Query parameters shared by every measured page — tune per environment, not per test. */
export type PerfParams = {
  allNamespaces: string;
  applicationName: string;
  configGroup: string;
  configKind: string;
  configName: string;
  configVersion: string;
  detailsNs: string;
  duration: string;
  graphType: string;
  layout: string;
  namespaces: string;
  rangeDuration: string;
  refresh: string;
  serviceName: string;
  traffic: string;
  workloadName: string;
};

/** Expected load time per measured page, in seconds. Results are reported as a delta against these. */
export type PerfBaselines = {
  appDetails: number;
  appListAll: number;
  appListSelected: number;
  configDetails: number;
  configListAll: number;
  configListSelected: number;
  graphAll: number;
  graphAllIdle: number;
  graphCore: number;
  graphIssueBaseline: number;
  graphOnlyIstio: number;
  graphSelected: number;
  graphWithoutIstio: number;
  namespaceListAll: number;
  namespaceListUnhealthy: number;
  overview: number;
  serviceDetails: number;
  serviceListAll: number;
  serviceListSelected: number;
  workloadDetails: number;
  workloadListAll: number;
  workloadListSelected: number;
};

const readFixture = <T>(fileName: string, overrideEnvVar: string): T => {
  const filePath = process.env[overrideEnvVar] ?? path.join(fixturesDir, fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

/** Override with `PERF_PARAMS_FILE=/path/to/commonParams.json` to measure another environment. */
export const perfParams = readFixture<PerfParams>('commonParams.json', 'PERF_PARAMS_FILE');

/** Override with `PERF_BASELINES_FILE=/path/to/baselines.json` to compare against other hardware. */
export const perfBaselines = readFixture<PerfBaselines>('baselines.json', 'PERF_BASELINES_FILE');
