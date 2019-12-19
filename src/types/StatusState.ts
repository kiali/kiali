export enum StatusKey {
  KIALI_CORE_COMMIT_HASH = 'Kiali core commit hash',
  KIALI_CORE_VERSION = 'Kiali core version',
  KIALI_CONSOLE_VERSION = 'Kiali console version',
  KIALI_CONTAINER_VERSION = 'Kiali container version',
  KIALI_STATE = 'Kiali state'
}

export type Status = { [K in StatusKey]?: string };

export interface Component {
  name: string;
  version?: string;
  url?: string;
}

export interface StatusState {
  status: Status;
  components: Component[];
  warningMessages: string[];
}
