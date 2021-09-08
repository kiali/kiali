export enum StatusKey {
  KIALI_CORE_COMMIT_HASH = 'Kiali core commit hash',
  KIALI_CORE_VERSION = 'Kiali core version',
  KIALI_CONSOLE_VERSION = 'Kiali console version',
  KIALI_CONTAINER_VERSION = 'Kiali container version',
  KIALI_STATE = 'Kiali state'
}

export type Status = { [K in StatusKey]?: string };

export interface ExternalServiceInfo {
  name: string;
  version?: string;
  url?: string;
}

export interface IstioEnvironment {
  isMaistra: boolean;
}

export interface StatusState {
  status: Status;
  externalServices: ExternalServiceInfo[];
  warningMessages: string[];
  istioEnvironment: IstioEnvironment;
}
