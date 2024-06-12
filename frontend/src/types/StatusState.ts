export enum StatusKey {
  DISABLED_FEATURES = 'Disabled features',
  KIALI_CORE_COMMIT_HASH = 'Kiali commit hash',
  KIALI_CORE_VERSION = 'Kiali version',
  KIALI_CONTAINER_VERSION = 'Kiali container version',
  KIALI_STATE = 'Kiali state'
}

export type Status = { [K in StatusKey]?: string };

export type TempoConfig = {
  datasource_uid: string;
  org_id: string;
};

export interface ExternalServiceInfo {
  name: string;
  tempoConfig?: TempoConfig;
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
