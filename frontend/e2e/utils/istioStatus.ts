import type { APIRequestContext } from '@playwright/test';
import { test } from '@playwright/test';

type IstioComponentStatus = {
  name: string;
  status: string;
};

/** Skip when the cluster reports non-healthy Istio components (local clusters often show warnings). */
export const skipUnlessHealthyIstioComponents = async (request: APIRequestContext): Promise<void> => {
  const response = await request.get('/api/istio/status');
  if (!response.ok()) {
    return;
  }
  const components = (await response.json()) as IstioComponentStatus[];
  const unhealthy = components.filter(component => component.status !== 'Healthy');
  if (unhealthy.length > 0) {
    test.skip(true, `Istio components are not all Healthy (${unhealthy.map(c => `${c.name}=${c.status}`).join(', ')})`);
  }
};
