import type { APIRequestContext } from '@playwright/test';
import { kubectlExec } from './kubectl';

type HealthRateTolerance = {
  code?: string;
  degraded?: number;
  failure?: number;
};

type HealthRate = {
  kind?: string;
  name?: string;
  namespace?: string;
  tolerance?: HealthRateTolerance[];
};

type KialiConfig = {
  ambientEnabled?: boolean;
  gatewayAPIEnabled?: boolean;
  healthConfig?: {
    rate?: HealthRate[];
  };
  kialiFeatureFlags?: {
    istioInjectionAction?: boolean;
    istioUpgradeAction?: boolean;
  };
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

/**
 * Cypress core-2 and CI set health_config.rate for alpha/y-server so error-rates traffic
 * classifies as Degraded (not Failure). Local Kiali without that override reports Failure.
 */
export async function hasYServerDegradedHealthConfig(request: APIRequestContext): Promise<boolean> {
  const config = await getKialiConfig(request);
  return (
    config.healthConfig?.rate?.some(
      rate =>
        rate.namespace === 'alpha' &&
        rate.kind === 'service' &&
        rate.name === 'y-server' &&
        rate.tolerance?.some(
          tolerance =>
            tolerance.degraded !== undefined &&
            (tolerance.failure === undefined || tolerance.degraded < tolerance.failure)
        )
    ) ?? false
  );
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
