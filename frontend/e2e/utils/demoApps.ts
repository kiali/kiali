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

function hasKialiCr(): boolean {
  try {
    execSync('kubectl get crd kialis.kiali.io', { stdio: 'ignore' });
    const names = execSync('kubectl get kiali --all-namespaces -o name', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return names.length > 0;
  } catch {
    return false;
  }
}

function waitForDemoNamespaces(namespaces: string): void {
  if (hasKialiCr()) {
    execSync(path.join(HACK_ISTIO, 'wait-for-namespace.sh') + ` -n ${namespaces}`, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      timeout: 400000
    });
    return;
  }

  // Local Kiali (make run-backend): no Kiali CR / operator — wait for pods only.
  for (const namespace of namespaces.split(/\s+/)) {
    execSync(`kubectl wait pods -n ${namespace} --for condition=Ready --timeout=120s --all`, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      timeout: 130000
    });
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
  waitForDemoNamespaces(config.namespaces);
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
