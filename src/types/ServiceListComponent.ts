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
  health?: Health;
}

export const overviewToItem = (
  overview: ServiceOverview,
  namespace: string,
  healthPromise: Promise<Health>
): ServiceItem => {
  const item: ServiceItem = {
    name: overview.name,
    istioSidecar: overview.istioSidecar,
    namespace: namespace,
    healthPromise: healthPromise
  };
  healthPromise.then(h => (item.health = h));
  return item;
};

export const IstioLogo = require('../assets/img/istio-logo.svg');

export interface SortField {
  title: string;
  isNumeric: boolean;
  compare: (a: ServiceItem, b: ServiceItem) => number;
}
