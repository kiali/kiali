import Namespace from './Namespace';
import { ServiceHealth } from './Health';
import { Validations, ObjectValidation, ObjectReference } from './IstioObjects';
import { AdditionalItem } from './Workload';

export interface ServiceList {
  namespace: Namespace;
  services: ServiceOverview[];
  validations: Validations;
}

export interface ServiceOverview {
  name: string;
  istioSidecar: boolean;
  istioAmbient: boolean;
  additionalDetailSample?: AdditionalItem;
  labels: { [key: string]: string };
  istioReferences: ObjectReference[];
  kialiWizard: string;
  serviceRegistry: string;
  health: ServiceHealth;
}

export interface ServiceListItem extends ServiceOverview {
  namespace: string;
  validation?: ObjectValidation;
}
