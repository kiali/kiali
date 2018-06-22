import Namespace from './Namespace';
import { DestinationPolicy, DestinationRule, ObjectValidation, RouteRule, VirtualService } from './ServiceInfo';

export interface IstioConfigItem {
  namespace: string;
  type: string;
  name: string;
  gateway?: Gateway;
  routeRule?: RouteRule;
  destinationPolicy?: DestinationPolicy;
  virtualService?: VirtualService;
  destinationRule?: DestinationRule;
  serviceEntry?: ServiceEntry;
  rule?: IstioRule;
  validation?: ObjectValidation;
}

export interface IstioConfigList {
  namespace: Namespace;
  gateways: Gateway[];
  routeRules: RouteRule[];
  destinationPolicies: DestinationPolicy[];
  virtualServices: VirtualService[];
  destinationRules: DestinationRule[];
  serviceEntries: ServiceEntry[];
  rules: IstioRule[];
}

export interface Gateway {
  name: string;
  createdAt: string;
  resourceVersion: string;
  servers?: Server[];
  selector?: { [key: string]: string };
}

export interface Server {
  port: Port;
  hosts: string[];
  tls: TLSOptions;
}

export interface Port {
  number: number;
  protocol: string;
  name: string;
}

export interface TLSOptions {
  httpsRedirect: boolean;
  mode: string;
  serverCertificate: string;
  privateKey: string;
  caCertificates: string;
  subjectAltNames: string[];
}

export interface ServiceEntry {
  name: string;
  createdAt: string;
  resourceVersion: string;
  hosts?: string[];
  addresses?: string[];
  ports?: Port[];
  location?: string;
  resolution?: string;
  endpoints?: Endpoint[];
}

export interface Endpoint {
  address: string;
  ports: { [key: string]: number };
  labels: { [key: string]: string };
}

export interface IstioRule {
  name: string;
  match: string;
  actions: IstioRuleActionItem[];
}

export interface IstioRuleActionItem {
  handler: string;
  instances: string[];
}

export interface SortField {
  id: string;
  title: string;
  isNumeric: boolean;
}

export const dicIstioType = {
  Gateway: 'gateways',
  RouteRule: 'routerules',
  DestinationPolicy: 'destinationpolicies',
  VirtualService: 'virtualservices',
  DestinationRule: 'destinationrules',
  ServiceEntry: 'serviceentries',
  Rule: 'rules',
  gateways: 'Gateway',
  routerules: 'RouteRule',
  destinationpolicies: 'DestinationPolicy',
  virtualservices: 'VirtualService',
  destinationrules: 'DestinationRule',
  serviceentries: 'ServiceEntry',
  rules: 'Rule'
};

const includeName = (name: string, names: string[]) => {
  for (let i = 0; i < names.length; i++) {
    if (name.includes(names[i])) {
      return true;
    }
  }
  return false;
};

export const filterByName = (unfiltered: IstioConfigList, names: string[]) => {
  if (names && names.length === 0) {
    return unfiltered;
  }
  let filtered: IstioConfigList = {
    namespace: unfiltered.namespace,
    gateways: unfiltered.gateways.filter(gw => includeName(gw.name, names)),
    routeRules: unfiltered.routeRules.filter(rr => includeName(rr.name, names)),
    destinationPolicies: unfiltered.destinationPolicies.filter(dp => includeName(dp.name, names)),
    virtualServices: unfiltered.virtualServices.filter(vs => includeName(vs.name, names)),
    destinationRules: unfiltered.destinationRules.filter(dr => includeName(dr.name, names)),
    serviceEntries: unfiltered.serviceEntries.filter(se => includeName(se.name, names)),
    rules: unfiltered.rules.filter(r => includeName(r.name, names))
  };
  return filtered;
};

export const filterByConfigValidation = (unfiltered: IstioConfigItem[], configFilters: string[]): IstioConfigItem[] => {
  if (configFilters && configFilters.length === 0) {
    return unfiltered;
  }
  let filtered: IstioConfigItem[] = [];

  let filterByValid = configFilters.indexOf('Valid') > -1;
  let filterByNotValid = configFilters.indexOf('Not Valid') > -1;
  let filterByNotValidated = configFilters.indexOf('Not Validated') > -1;
  if (filterByValid && filterByNotValid && filterByNotValidated) {
    return unfiltered;
  }

  unfiltered.forEach(item => {
    if (filterByValid && item.validation && item.validation.valid) {
      filtered.push(item);
    }
    if (filterByNotValid && item.validation && !item.validation.valid) {
      filtered.push(item);
    }
    if (filterByNotValidated && !item.validation) {
      filtered.push(item);
    }
  });
  return filtered;
};

export const toIstioItems = (istioConfigList: IstioConfigList): IstioConfigItem[] => {
  let istioItems: IstioConfigItem[] = [];
  istioConfigList.gateways.forEach(gw =>
    istioItems.push({ namespace: istioConfigList.namespace.name, type: 'gateway', name: gw.name, gateway: gw })
  );
  istioConfigList.routeRules.forEach(rr =>
    istioItems.push({ namespace: istioConfigList.namespace.name, type: 'routerule', name: rr.name, routeRule: rr })
  );
  istioConfigList.destinationPolicies.forEach(dp =>
    istioItems.push({
      namespace: istioConfigList.namespace.name,
      type: 'destinationpolicy',
      name: dp.name,
      destinationPolicy: dp
    })
  );
  istioConfigList.virtualServices.forEach(vs =>
    istioItems.push({
      namespace: istioConfigList.namespace.name,
      type: 'virtualservice',
      name: vs.name,
      virtualService: vs
    })
  );
  istioConfigList.destinationRules.forEach(dr =>
    istioItems.push({
      namespace: istioConfigList.namespace.name,
      type: 'destinationrule',
      name: dr.name,
      destinationRule: dr
    })
  );
  istioConfigList.serviceEntries.forEach(se =>
    istioItems.push({
      namespace: istioConfigList.namespace.name,
      type: 'serviceentry',
      name: se.name,
      serviceEntry: se
    })
  );
  istioConfigList.rules.forEach(r =>
    istioItems.push({ namespace: istioConfigList.namespace.name, type: 'rule', name: r.name, rule: r })
  );
  return istioItems;
};

export const sortIstioItems = (unsorted: IstioConfigItem[], sortField: SortField, isAscending: boolean) => {
  let sorted: IstioConfigItem[] = unsorted.sort((a: IstioConfigItem, b: IstioConfigItem) => {
    let sortValue = -1;
    if (sortField.id === 'namespace') {
      sortValue = a.namespace.localeCompare(b.namespace);
    }
    if (sortField.id === 'istiotype') {
      sortValue = a.type.localeCompare(b.type);
    }
    if (sortField.id === 'configvalidation') {
      if (a.validation && !b.validation) {
        sortValue = -1;
      }
      if (!a.validation && b.validation) {
        sortValue = 1;
      }
      if (!a.validation && !b.validation) {
        sortValue = 0;
      }
      if (a.validation && b.validation) {
        if (a.validation.valid && !b.validation.valid) {
          sortValue = -1;
        }
        if (!a.validation.valid && b.validation.valid) {
          sortValue = 1;
        }
        if (a.validation.valid && b.validation.valid) {
          sortValue = 0;
        }
        if (!a.validation.valid && !b.validation.valid) {
          let aIssues = a.validation.checks ? a.validation.checks.length : 0;
          let bIssues = b.validation.checks ? b.validation.checks.length : 0;
          sortValue = aIssues > bIssues ? -1 : aIssues < bIssues ? 1 : 0;
        }
      }
    }
    // Istioname at the end to be the default sort when sortValue === 0
    if (sortField.id === 'istioname' || sortValue === 0) {
      sortValue = a.name.localeCompare(b.name);
    }
    return isAscending ? sortValue : sortValue * -1;
  });
  return sorted;
};
