import { TLSStatus } from './TLSStatus';
import { Metric } from './Metrics';
import { ValidationStatus } from './IstioObjects';
import { IstioConfigList } from './IstioConfigList';

export type NamespaceInfo = {
  annotations?: { [key: string]: string };
  cluster?: string;
  errorMetrics?: Metric[];
  isAmbient?: boolean;
  istioConfig?: IstioConfigList;
  labels?: { [key: string]: string };
  metrics?: Metric[];
  name: string;
  outboundPolicyMode?: string;
  status?: NamespaceStatus;
  tlsStatus?: TLSStatus;
  validations?: ValidationStatus;
};

export type NamespaceStatus = {
  inError: string[];
  inNotReady: string[];
  inSuccess: string[];
  inWarning: string[];
  notAvailable: string[];
};
