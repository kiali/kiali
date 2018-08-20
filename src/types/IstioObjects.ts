import Namespace from './Namespace';

// NamespaceValidations are grouped per 'namespace'
export type NamespaceValidations = { [key: string]: Validations };

// validations are grouped per 'objectType' first in the first map and 'name' in the inner map
export type Validations = { [key1: string]: { [key2: string]: ObjectValidation } };

export interface ObjectValidation {
  name: string;
  objectType: string;
  valid: boolean;
  checks: ObjectCheck[];
}

export interface ObjectCheck {
  message: string;
  severity: string;
  path: string;
}

export interface Reference {
  name: string;
  kind: string;
}

export interface ContainerInfo {
  name: string;
  image: string;
}

export interface Port {
  protocol: string;
  port: number;
  name: string;
}

export interface Autoscaler {
  name: string;
  labels?: { [key: string]: string };
  createdAt: string;
  minReplicas: number;
  maxReplicas: number;
  targetCPUUtilizationPercentage: number;
  currentReplicas?: number;
  desiredReplicas?: number;
}

export interface Pod {
  name: string;
  labels?: { [key: string]: string };
  createdAt: string;
  createdBy: Reference[];
  istioContainers?: ContainerInfo[];
  istioInitContainers?: ContainerInfo[];
}

export interface Service {
  labels?: { [key: string]: string };
  type: string;
  name: string;
  createdAt: string;
  namespace: Namespace;
  resourceVersion: string;
  ip: string;
  ports?: Port[];
}

export interface Deployment {
  name: string;
  type: string;
  templateAnnotations?: { [key: string]: string };
  labels?: { [key: string]: string };
  createdAt: string;
  resourceVersion: string;
  replicas: number;
  availableReplicas: number;
  unavailableReplicas: number;
  autoscaler: Autoscaler;
  pods?: Pod[];
  services?: Service[];
}
