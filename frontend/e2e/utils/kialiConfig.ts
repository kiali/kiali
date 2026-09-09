import type { APIRequestContext } from '@playwright/test';
import { test } from '@playwright/test';
import { kubectlExec } from './kubectl';

type KialiConfig = {
  ambientEnabled?: boolean;
  gatewayAPIEnabled?: boolean;
  kialiFeatureFlags?: {
    istioInjectionAction?: boolean;
    istioUpgradeAction?: boolean;
  };
};

type ServiceListItem = {
  additionalDetailSample?: { icon?: string } | null;
  name: string;
};

export async function getKialiConfig(request: APIRequestContext): Promise<KialiConfig> {
  const response = await request.get('/api/config');
  if (!response.ok()) {
    return {};
  }
  return (await response.json()) as KialiConfig;
}

export async function isGatewayApiEnabled(request: APIRequestContext): Promise<boolean> {
  const config = await getKialiConfig(request);
  return Boolean(config.gatewayAPIEnabled);
}

export async function isIstioInjectionUiEnabled(request: APIRequestContext): Promise<boolean> {
  const config = await getKialiConfig(request);
  const flags = config.kialiFeatureFlags;
  return Boolean(flags?.istioInjectionAction) && !flags?.istioUpgradeAction;
}

export function hasGrafanaDeployment(): boolean {
  return kubectlExec('kubectl get deployment grafana -n istio-system').exitCode === 0;
}

export function hasSailIstioCr(): boolean {
  return kubectlExec('kubectl get istio default -n istio-system').exitCode === 0;
}

export function hasLoggersNamespace(): boolean {
  return kubectlExec('kubectl get namespace loggers').exitCode === 0;
}

/** Skip when Kiali is not configured with additional_display_details (operator/CI default). */
export const skipUnlessApiDocumentationConfigured = async (
  request: APIRequestContext,
  namespace: string,
  serviceName: string
): Promise<void> => {
  const response = await request.get(`/api/clusters/services?namespaces=${namespace}&health=true`);
  if (!response.ok()) {
    test.skip(true, 'Could not fetch services list to verify API documentation config');
    return;
  }
  const body = (await response.json()) as { services?: ServiceListItem[] };
  const service = body.services?.find(item => item.name === serviceName);
  if (!service?.additionalDetailSample?.icon) {
    test.skip(
      true,
      'API Documentation requires additional_display_details in Kiali config (restart with hack/ci-yaml/ci-test-config-*.yaml)'
    );
  }
};
