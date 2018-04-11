import Namespace from './Namespace';
import { Health } from './Health';

export interface ServiceName {
  name: string;
  health: Health;
  request_count: number;
  request_error_count: number;
  error_rate: number;
}

export interface ServiceList {
  namespace: Namespace;
  services: ServiceName[];
}

export interface ServiceItem {
  servicename: string;
  namespace: string;
  health: Health;
  request_count: number;
  request_error_count: number;
  error_rate: number;
}
