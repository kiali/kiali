import Namespace from './Namespace';
import { Health } from './Health';

export interface ServiceOverview {
  name: string;
  istioSidecar: boolean;
}

export interface ServiceList {
  namespace: Namespace;
  services: ServiceOverview[];
}

export interface ServiceItem extends ServiceOverview {
  namespace: string;
  healthPromise: Promise<Health>;
}

export const overviewToItem = (
  overview: ServiceOverview,
  namespace: string,
  healthPromise: Promise<Health>
): ServiceItem => {
  return {
    name: overview.name,
    istioSidecar: overview.istioSidecar,
    namespace: namespace,
    healthPromise: healthPromise
  };
};

export const IstioLogo = require('../assets/img/istio-logo.svg');

export interface SortField {
  title: string;
  isNumeric: boolean;
  compare: (a: ServiceItem, b: ServiceItem) => number;
}
