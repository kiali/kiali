export enum StatusKey {
  DISABLED_FEATURES = 'Disabled features',
  KIALI_CORE_COMMIT_HASH = 'Kiali commit hash',
  KIALI_CORE_VERSION = 'Kiali version',
  KIALI_CONTAINER_VERSION = 'Kiali container version',
  KIALI_STATE = 'Kiali state',
  MESH_NAME = 'Mesh name',
  MESH_VERSION = 'Mesh version'
}

export type Status = { [K in StatusKey]?: string };

export interface ExternalServiceInfo {
  frontendProvider?: string;
  frontendProviderConfig?: Record<string, string>;
  name: string;
  url?: string;
  version?: string;
}

export interface IstioEnvironment {
  istioAPIEnabled: boolean;
}

export interface StatusState {
  externalServices: ExternalServiceInfo[];
  istioEnvironment: IstioEnvironment;
  status: Status;
  warningMessages: string[];
}
