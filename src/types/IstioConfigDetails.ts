import Namespace from './Namespace';
import { DestinationPolicy, DestinationRule, RouteRule, VirtualService } from './ServiceInfo';
import { RuleAction } from './IstioRuleInfo';
import { AceOptions } from 'react-ace';
import { Gateway, QuotaSpec, QuotaSpecBinding, ServiceEntry } from './IstioConfigList';

export interface IstioConfigId {
  namespace: string;
  objectType: string;
  object: string;
}

export interface IstioRuleDetails {
  name: string;
  namespace: Namespace;
  match: string;
  actions: RuleAction[];
}

export interface IstioConfigDetails {
  namespace: Namespace;
  gateway: Gateway;
  routeRule: RouteRule;
  destinationPolicy: DestinationPolicy;
  virtualService: VirtualService;
  destinationRule: DestinationRule;
  serviceEntry: ServiceEntry;
  rule: IstioRuleDetails;
  quotaSpec: QuotaSpec;
  quotaSpecBinding: QuotaSpecBinding;
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
