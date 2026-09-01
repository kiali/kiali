import { execSync } from 'child_process';

type KubectlExecResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export function kubectlExec(command: string, failOnNonZeroExit = false): KubectlExecResult {
  try {
    const stdout = execSync(command, { encoding: 'utf8' });
    return { exitCode: 0, stderr: '', stdout: stdout.trim() };
  } catch (error) {
    const execError = error as { status?: number; stderr?: Buffer | string; stdout?: Buffer | string };
    const result: KubectlExecResult = {
      exitCode: execError.status ?? 1,
      stderr: (execError.stderr ?? '').toString().trim(),
      stdout: (execError.stdout ?? '').toString().trim()
    };
    if (failOnNonZeroExit) {
      throw error;
    }
    return result;
  }
}

export function kubectlNamespaceExists(namespace: string): boolean {
  const { exitCode } = kubectlExec(`kubectl get namespace ${namespace}`);
  return exitCode === 0;
}

export function kubectlScale(namespace: string, deployment: string, replicas: number): void {
  kubectlExec(`kubectl scale -n ${namespace} --replicas=${replicas} deployment/${deployment}`, true);
}

export function kubectlRolloutRestart(namespace: string, deployment: string): void {
  kubectlExec(`kubectl rollout restart deployment ${deployment} -n ${namespace}`, true);
}

export function kubectlScaleAndWait(namespace: string, deployment: string, replicas = 1): void {
  kubectlScale(namespace, deployment, replicas);
  kubectlRolloutRestart(namespace, deployment);
  kubectlExec(`kubectl rollout status deployment ${deployment} -n ${namespace}`, true);
}

export function kubectlDelete(resourceArgs: string): KubectlExecResult {
  return kubectlExec(`kubectl delete ${resourceArgs}`, false);
}
