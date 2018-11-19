import Namespace from './Namespace';
import { DestinationPolicy, DestinationRule, RouteRule, VirtualService } from './ServiceInfo';
import { AceOptions } from 'react-ace';
import {
  Gateway,
  IstioAdapter,
  IstioRule,
  IstioTemplate,
  QuotaSpec,
  QuotaSpecBinding,
  ServiceEntry
} from './IstioConfigList';
import { ResourcePermissions } from './Permissions';

export interface IstioConfigId {
  namespace: string;
  objectType: string;
  objectSubtype: string;
  object: string;
}

export interface IstioConfigDetails {
  namespace: Namespace;
  gateway: Gateway;
  routeRule: RouteRule;
  destinationPolicy: DestinationPolicy;
  virtualService: VirtualService;
  destinationRule: DestinationRule;
  serviceEntry: ServiceEntry;
  rule: IstioRule;
  adapter: IstioAdapter;
  template: IstioTemplate;
  quotaSpec: QuotaSpec;
  quotaSpecBinding: QuotaSpecBinding;
  permissions: ResourcePermissions;
}

export const aceOptions: AceOptions = {
  readOnly: true,
  showPrintMargin: false,
  autoScrollEditorIntoView: true
};

export const safeDumpOptions = {
  styles: {
    '!!null': 'canonical' // dump null as ~
  }
};

export interface ParsedSearch {
  type?: string;
  name?: string;
}
