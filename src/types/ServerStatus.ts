export interface ServerStatus {
  status: { [key: string]: string };
  externalServices: ExternalServiceInfo[];
  warningMessages: string[];
}

interface ExternalServiceInfo {
  name: string;
  version?: string;
  url?: string;
}
