import Namespace from './Namespace';
import { Health } from './Health';

export interface ServiceOverview {
  name: string;
  health: Health;
  istioSidecar: boolean;
}

export interface ServiceList {
  namespace: Namespace;
  services: ServiceOverview[];
}

export interface ServiceItem extends ServiceOverview {
  namespace: string;
}

export const overviewToItem = (overview: ServiceOverview, namespace: string): ServiceItem => {
  return {
    name: overview.name,
    health: overview.health,
    istioSidecar: overview.istioSidecar,
    namespace: namespace
  };
};

export const IstioLogo = require('../assets/img/istio-logo.svg');

export interface SortField {
  title: string;
  isNumeric: boolean;
  compare: (a: ServiceItem, b: ServiceItem) => number;
}
