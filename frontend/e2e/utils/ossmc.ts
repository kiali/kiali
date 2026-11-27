import type { Page } from '@playwright/test';

export const isOssmc = (): boolean => process.env.PLAYWRIGHT_OSSMC === 'true';

// Kiali routes a workload detail page as /console/namespaces/<ns>/workloads/<name>,
// but the OSSMC console route is /k8s/ns/<ns>/deployments/<name>/ossmconsole.
export const workloadDetailUrlPattern = (name: string): RegExp => new RegExp(`/(workloads|deployments)/${name}`);

// The console kind segment depends on the workload type (deployments, daemonsets,
// statefulsets, ...); the Kiali workload API reports it as gvk.Kind.
export const consoleWorkloadDetailPath = (namespace: string, kind: string, name: string): string =>
  `/k8s/ns/${namespace}/${kind.toLowerCase()}s/${name}/ossmconsole`;

// In OSSMC the API goes through the console plugin proxy, where the Kiali
// backend enforces CSRF on mutating requests: the X-CSRFToken header must
// match the csrf-token cookie set on the console origin.
export const ossmcCsrfHeaders = async (page: Page): Promise<Record<string, string>> => {
  if (!isOssmc()) {
    return {};
  }
  const token = (await page.context().cookies()).find(cookie => cookie.name === 'csrf-token')?.value;
  return token ? { 'X-CSRFToken': token } : {};
};
