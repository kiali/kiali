import Namespace from './Namespace';
import { ServiceHealth } from './Health';

export interface ServiceList {
  namespace: Namespace;
  services: ServiceOverview[];
}

export interface ServiceOverview {
  name: string;
  istioSidecar: boolean;
}

export interface ServiceListItem extends ServiceOverview {
  namespace: string;
  healthPromise: Promise<ServiceHealth>;
}
