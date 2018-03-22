import { Namespace } from './Namespace';

export interface ServiceName {
  name: string;
  replicas: number;
  available_replicas: number;
  unavailable_replicas: number;
}

export interface ServiceList {
  namespace: Namespace;
  services: ServiceName[];
}

export interface ServiceItem {
  servicename: string;
  namespace: string;
  replicas: number;
  available_replicas: number;
  unavailable_replicas: number;
}
