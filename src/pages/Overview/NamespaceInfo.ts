import { TLSStatus } from '../../types/TLSStatus';

export type NamespaceInfo = {
  name: string;
  status?: NamespaceStatus;
  tlsStatus?: TLSStatus;
};

export type NamespaceStatus = {
  inError: string[];
  inWarning: string[];
  inSuccess: string[];
  notAvailable: string[];
};

export default NamespaceInfo;
