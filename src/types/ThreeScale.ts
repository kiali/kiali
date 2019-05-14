import { ResourcePermissions } from './Permissions';

export interface ThreeScaleInfo {
  enabled: boolean;
  permissions: ResourcePermissions;
}

export interface ThreeScaleHandler {
  name: string;
  serviceId: string;
  systemUrl: string;
  accessToken: string;
}

export interface ThreeScaleServiceRule {
  serviceName: string;
  serviceNamespace: string;
  threeScaleHandlerName: string;
}
