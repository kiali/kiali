import { TLSStatus } from '../../types/TLSStatus';
import { Metric } from '../../types/Metrics';
import { ValidationStatus } from '../../types/IstioObjects';
import { IstioConfigList } from '../../types/IstioConfigList';

export type NamespaceInfo = {
  name: string;
  status?: NamespaceStatus;
  tlsStatus?: TLSStatus;
  istioConfig?: IstioConfigList;
  validations?: ValidationStatus;
  metrics?: Metric[];
  labels?: { [key: string]: string };
};

export type NamespaceStatus = {
  inNotReady: string[];
  inError: string[];
  inWarning: string[];
  inSuccess: string[];
  notAvailable: string[];
};

export default NamespaceInfo;
