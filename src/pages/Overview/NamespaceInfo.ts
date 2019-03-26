import { TLSStatus } from '../../types/TLSStatus';
import { TimeSeries } from '../../types/Metrics';

export type NamespaceInfo = {
  name: string;
  status?: NamespaceStatus;
  tlsStatus?: TLSStatus;
  metrics?: TimeSeries[];
};

export type NamespaceStatus = {
  inError: string[];
  inWarning: string[];
  inSuccess: string[];
  notAvailable: string[];
};

export default NamespaceInfo;
