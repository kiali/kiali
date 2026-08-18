import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const HACK_ISTIO = path.join(REPO_ROOT, 'hack/istio');

export type DemoApp = 'bookinfo' | 'error-rates' | 'sleep' | 'loggers';

type DemoAppConfig = {
  deletionArgs: string;
  installExtraArgs: string;
  namespaces: string;
  statusScript: string;
  tgArg: string;
};

const DEMO_APP_CONFIG: Record<DemoApp, DemoAppConfig> = {
  bookinfo: {
    deletionArgs: '--delete-bookinfo',
    installExtraArgs: '-in istio-system',
    namespaces: 'bookinfo',
    statusScript: 'bookinfo-status.sh',
    tgArg: '-tg'
  },
  'error-rates': {
    deletionArgs: '--delete',
    installExtraArgs: '-in istio-system',
    namespaces: 'alpha beta',
    statusScript: 'error-rates-status.sh',
    tgArg: ''
  },
  sleep: {
    deletionArgs: '--delete-sleep',
    installExtraArgs: '',
    namespaces: 'sleep',
    statusScript: 'sleep-status.sh',
    tgArg: ''
  },
  loggers: {
    deletionArgs: '--delete',
    installExtraArgs: '',
    namespaces: 'loggers',
    statusScript: 'loggers-status.sh',
    tgArg: ''
  }
};

function isOpenShift(): boolean {
  try {
    execSync('kubectl api-versions | grep --quiet "route.openshift.io"', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getNodeArchitecture(): string | undefined {
  try {
    return execSync(path.join(HACK_ISTIO, 'cypress/get-node-architecture.sh'), {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    }).trim();
  } catch {
    return undefined;
  }
}

function installDemoApp(demoapp: DemoApp): void {
  const config = DEMO_APP_CONFIG[demoapp];
  const arch = getNodeArchitecture();
  if (!arch) {
    throw new Error(`Could not detect node architecture to install ${demoapp} demo app`);
  }

  const installScript = path.join(HACK_ISTIO, `install-${demoapp}-demo.sh`);
  const openshift = isOpenShift();
  const clientArg = openshift ? '' : '-c kubectl';
  const tgArg = config.tgArg ? `${config.tgArg} ` : '';
  const extraArgs = config.installExtraArgs ? `${config.installExtraArgs} ` : '';

  execSync(`${installScript} ${config.deletionArgs} true ${clientArg}`, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    timeout: 300000
  });
  execSync(`${installScript} ${clientArg} ${tgArg}${extraArgs}-a ${arch}`, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    timeout: 300000
  });
  execSync(path.join(HACK_ISTIO, 'wait-for-namespace.sh') + ` -n ${config.namespaces}`, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    timeout: 400000
  });
}

/**
 * Ensure a Cypress demo app is installed (mirrors @bookinfo-app / @sleep-app hooks).
 */
export function ensureDemoApp(demoapp: DemoApp): void {
  const config = DEMO_APP_CONFIG[demoapp];
  const statusScript = path.join(HACK_ISTIO, 'cypress', config.statusScript);
  try {
    execSync(statusScript, { cwd: REPO_ROOT, stdio: 'inherit', timeout: 120000 });
  } catch {
    installDemoApp(demoapp);
  }
}
