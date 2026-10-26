import type { Page } from '@playwright/test';
import { kubectlScaleAndWait } from './kubectl';
import { kialiUrl } from './kialiUrl';

const workloadGvk = 'apps/v1, Kind=Deployment';

// In OSSMC the API goes through the console plugin proxy, where the Kiali
// backend enforces CSRF on mutating requests: the X-CSRFToken header must
// match the csrf-token cookie set on the console origin.
const ossmcCsrfHeaders = async (page: Page): Promise<Record<string, string>> => {
  if (process.env.PLAYWRIGHT_OSSMC !== 'true') {
    return {};
  }
  const token = (await page.context().cookies()).find(cookie => cookie.name === 'csrf-token')?.value;
  return token ? { 'X-CSRFToken': token } : {};
};

const patchNamespace = async (page: Page, namespace: string, labels: Record<string, string | null>): Promise<void> => {
  const response = await page.request.patch(kialiUrl(`/api/namespaces/${namespace}`), {
    data: { metadata: { labels } },
    headers: await ossmcCsrfHeaders(page)
  });
  if (!response.ok()) {
    throw new Error(`Failed to patch namespace ${namespace}: ${response.status()}`);
  }
};

const patchWorkloadInjection = async (
  page: Page,
  namespace: string,
  workload: string,
  injectLabel: string | null,
  injectAnnotation: string | null = null
): Promise<void> => {
  const response = await page.request.patch(
    kialiUrl(`/api/namespaces/${namespace}/workloads/${workload}?gvk="${workloadGvk}"`),
    {
      data: {
        spec: {
          template: {
            metadata: {
              annotations: {
                'sidecar.istio.io/inject': injectAnnotation
              },
              labels: {
                'sidecar.istio.io/inject': injectLabel
              }
            }
          }
        }
      },
      headers: await ossmcCsrfHeaders(page)
    }
  );
  if (!response.ok()) {
    throw new Error(`Failed to patch workload ${namespace}/${workload}: ${response.status()}`);
  }
};

export async function clearNamespaceInjection(page: Page, namespace: string): Promise<void> {
  await patchNamespace(page, namespace, { 'istio-injection': null, 'istio.io/rev': null });
}

export async function setNamespaceInjection(page: Page, namespace: string, enabledOrDisabled: string): Promise<void> {
  await patchNamespace(page, namespace, { 'istio-injection': enabledOrDisabled, 'istio.io/rev': null });
}

export async function setupWorkloadWithoutSidecar(page: Page, namespace: string, workload: string): Promise<void> {
  await clearNamespaceInjection(page, namespace);
  await patchWorkloadInjection(page, namespace, workload, null, null);
  await restartWorkload(namespace, workload);
}

export async function setupWorkloadWithSidecar(page: Page, namespace: string, workload: string): Promise<void> {
  await setNamespaceInjection(page, namespace, 'enabled');
  await patchWorkloadInjection(page, namespace, workload, 'true', null);
  await restartWorkload(namespace, workload);
}

export async function ensureWorkloadHasInjectionOverride(
  page: Page,
  namespace: string,
  workload: string,
  hasSidecar: boolean
): Promise<void> {
  await patchWorkloadInjection(page, namespace, workload, hasSidecar ? 'true' : 'false', null);
}

export async function setupWorkloadWithInjectionOverride(
  page: Page,
  namespace: string,
  workload: string
): Promise<void> {
  await patchWorkloadInjection(page, namespace, workload, 'true', null);
}

export async function restartWorkload(namespace: string, workload: string): Promise<void> {
  kubectlScaleAndWait(namespace, workload);
}
