import type { APIRequestContext } from '@playwright/test';
import { kubectlExec } from './kubectl';

type KialiConfig = {
  ambientEnabled?: boolean;
  gatewayAPIEnabled?: boolean;
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

export function hasGrafanaDeployment(): boolean {
  return kubectlExec('kubectl get deployment grafana -n istio-system').exitCode === 0;
}

export function hasSailIstioCr(): boolean {
  return kubectlExec('kubectl get istio default -n istio-system').exitCode === 0;
}

export function hasLoggersNamespace(): boolean {
  return kubectlExec('kubectl get namespace loggers').exitCode === 0;
}
