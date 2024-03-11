import { Namespace } from './Namespace';
import { ServiceHealth } from './Health';
import { Validations, ObjectValidation, ObjectReference } from './IstioObjects';
import { AdditionalItem } from './Workload';

export interface ServiceList {
  namespace: Namespace;
  services: ServiceOverview[];
  validations: Validations;
}

export interface ServiceOverview {
  additionalDetailSample?: AdditionalItem;
  cluster?: string;
  health: ServiceHealth;
  istioAmbient: boolean;
  istioReferences: ObjectReference[];
  istioSidecar: boolean;
  kialiWizard: string;
  labels: { [key: string]: string };
  name: string;
  namespace: string;
  ports: { [key: string]: number };
  serviceRegistry: string;
}

export interface ServiceListItem extends ServiceOverview {
  namespace: string;
  validation?: ObjectValidation;
}

export interface ServiceListQuery {
  health: 'true' | 'false';
  istioResources: 'true' | 'false';
  onlyDefinitions: 'true' | 'false';
  rateInterval: string;
}
