import Namespace from './Namespace';
import { Health } from './Health';

export interface ServiceOverview {
  name: string;
  health: Health;
  istio_sidecar: boolean;
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
    istio_sidecar: overview.istio_sidecar,
    namespace: namespace
  };
};

export const IstioLogo = require('../assets/img/istio-logo.svg');

export interface SortField {
  title: string;
  isNumeric: boolean;
  compare: (a: ServiceItem, b: ServiceItem) => number;
}
