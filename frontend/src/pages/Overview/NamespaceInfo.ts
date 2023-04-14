import { TLSStatus } from '../../types/TLSStatus';
import { ControlPlaneMetricsMap, Metric } from '../../types/Metrics';
import { ValidationStatus } from '../../types/IstioObjects';
import { IstioConfigList } from '../../types/IstioConfigList';

export type NamespaceInfo = {
  name: string;
  cluster?: string;
  outboundPolicyMode?: string;
  status?: NamespaceStatus;
  tlsStatus?: TLSStatus;
  istioConfig?: IstioConfigList;
  validations?: ValidationStatus;
  metrics?: Metric[];
  errorMetrics?: Metric[];
  labels?: { [key: string]: string };
  controlPlaneMetrics?: ControlPlaneMetricsMap;
};

export type NamespaceStatus = {
  inNotReady: string[];
  inError: string[];
  inWarning: string[];
  inSuccess: string[];
  notAvailable: string[];
};

export default NamespaceInfo;
