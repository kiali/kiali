import { execSync } from 'child_process';

export function kubectlNamespaceExists(namespace: string): boolean {
  try {
    execSync(`kubectl get namespace ${namespace}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function kubectlScale(namespace: string, deployment: string, replicas: number): void {
  execSync(`kubectl scale -n ${namespace} --replicas=${replicas} deployment/${deployment}`, { stdio: 'ignore' });
}
