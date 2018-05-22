import Namespace from './Namespace';
import { DestinationPolicy, DestinationRule, RouteRule, VirtualService } from './ServiceInfo';

export interface IstioConfigItem {
  namespace: string;
  routeRule?: RouteRule;
  destinationPolicy?: DestinationPolicy;
  virtualService?: VirtualService;
  destinationRule?: DestinationRule;
  rule?: IstioRule;
}

export interface IstioConfigList {
  namespace: Namespace;
  route_rules: RouteRule[];
  destination_policies: DestinationPolicy[];
  virtual_services: VirtualService[];
  destination_rules: DestinationRule[];
  rules: IstioRule[];
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
  RouteRule: 'routerules',
  DestinationPolicy: 'destinationpolicies',
  VirtualService: 'virtualservices',
  DestinationRule: 'destinationrules',
  Rule: 'rules',
  routerules: 'RouteRule',
  destinationpolicies: 'DestinationPolicy',
  virtualservices: 'VirtualService',
  destinationrules: 'DestinationRule',
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
    route_rules: unfiltered.route_rules.filter(rr => includeName(rr.name, names)),
    destination_policies: unfiltered.destination_policies.filter(dp => includeName(dp.name, names)),
    virtual_services: unfiltered.virtual_services.filter(vs => includeName(vs.name, names)),
    destination_rules: unfiltered.destination_rules.filter(dr => includeName(dr.name, names)),
    rules: unfiltered.rules.filter(r => includeName(r.name, names))
  };
  return filtered;
};

export const toIstioItems = (istioConfigList: IstioConfigList): IstioConfigItem[] => {
  let istioItems: IstioConfigItem[] = [];
  istioConfigList.route_rules.forEach(rr =>
    istioItems.push({ namespace: istioConfigList.namespace.name, routeRule: rr })
  );
  istioConfigList.destination_policies.forEach(dp =>
    istioItems.push({ namespace: istioConfigList.namespace.name, destinationPolicy: dp })
  );
  istioConfigList.virtual_services.forEach(vs =>
    istioItems.push({ namespace: istioConfigList.namespace.name, virtualService: vs })
  );
  istioConfigList.destination_rules.forEach(dr =>
    istioItems.push({ namespace: istioConfigList.namespace.name, destinationRule: dr })
  );
  istioConfigList.rules.forEach(r => istioItems.push({ namespace: istioConfigList.namespace.name, rule: r }));
  return istioItems;
};

const getIstioType = (item: IstioConfigItem) => {
  let istioType = '';
  if (item.routeRule) {
    istioType = 'RouteRule';
  } else if (item.destinationPolicy) {
    istioType = 'DestinationPolicy';
  } else if (item.virtualService) {
    istioType = 'VirtualService';
  } else if (item.destinationRule) {
    istioType = 'DestinationRule';
  } else if (item.rule) {
    istioType = 'Rule';
  }
  return istioType;
};

const getIstioName = (item: IstioConfigItem) => {
  let istioName = '';
  if (item.routeRule) {
    istioName = item.routeRule.name;
  } else if (item.destinationPolicy) {
    istioName = item.destinationPolicy.name;
  } else if (item.virtualService) {
    istioName = item.virtualService.name;
  } else if (item.destinationRule) {
    istioName = item.destinationRule.name;
  } else if (item.rule) {
    istioName = item.rule.name;
  }
  return istioName;
};

export const sortIstioItems = (unsorted: IstioConfigItem[], sortField: SortField, isAscending: boolean) => {
  let sorted: IstioConfigItem[] = unsorted.sort((a: IstioConfigItem, b: IstioConfigItem) => {
    let sortValue = -1;
    if (sortField.id === 'namespace') {
      sortValue = a.namespace.localeCompare(b.namespace);
    }
    if (sortField.id === 'istiotype') {
      sortValue = getIstioType(a).localeCompare(getIstioType(b));
    }
    if (sortField.id === 'istioname' || sortValue === 0) {
      sortValue = getIstioName(a).localeCompare(getIstioName(b));
    }
    return isAscending ? sortValue : sortValue * -1;
  });
  return sorted;
};
