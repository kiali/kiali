import * as React from 'react';
import { IstioObjectLink } from '../components/Link/IstioObjectLink';
import { Namespace } from '../types/Namespace';
import { Paths } from '../config';
import { Link } from 'react-router-dom-v5-compat';
import { EnvoySummary, GroupVersionKind, Host } from '../types/IstioObjects';
import { ActiveFilter, ActiveFiltersInfo } from '../types/Filters';
import { FilterSelected } from '../components/Filters/StatefulFilters';
import { kioskContextMenuAction } from '../components/Kiosk/KioskActions';

export type FilterMethodMap = { [id: string]: (value, filter) => boolean };

export const istioConfigLink = (halfQDN: string, objectGVK: GroupVersionKind): JSX.Element | string => {
  const nameParts: string[] = halfQDN.split('.');
  if (nameParts.length === 2) {
    return (
      <React.Fragment>
        <IstioObjectLink name={nameParts[0]} namespace={nameParts[1]} objectGVK={objectGVK}>
          {halfQDN}
        </IstioObjectLink>
      </React.Fragment>
    );
  }
  return halfQDN;
};

export const routeLink = (
  route: string,
  namespace: string,
  workload: string | undefined,
  handler: () => void
): JSX.Element | string => {
  let re = /Route: ([a-z-.:\d]*)/;

  if (workload !== undefined) {
    const result = route.match(re);
    if (result && result[1]) {
      return (
        <React.Fragment>
          <Link
            onClick={handler}
            to={`/namespaces/${namespace}/workloads/${workload}?tab=envoy&envoyTab=routes&name=${result[1]}`}
          >
            {route}
          </Link>
        </React.Fragment>
      );
    }
  }

  return route;
};

export const serviceLink = (
  host: Host,
  namespaces: Namespace[] | undefined,
  podNamespace: string,
  simpleSvc = false,
  isParentKiosk: boolean
): JSX.Element | string => {
  let to = '/namespaces/';
  let linkText: string = host.service;
  let showLink = false;

  const hasSimpleServiceForm = host.service.split('.').length === 1 && host.service !== '*';
  // Show link if simple service names are allowed,
  // and the service is no * and has no domains,subdomains
  if (host.service && !host.namespace && simpleSvc && hasSimpleServiceForm) {
    to += `${podNamespace}/${Paths.SERVICES}/${host.service}`;
    showLink = true;
  } else if (host.service && host.namespace && namespaces) {
    to += `${host.namespace}/${Paths.SERVICES}/${host.service}`;
    linkText += `.${host.namespace}`;
    if (host.cluster) {
      linkText += `.${host.cluster}`;
    }
    // Show link if the namespace matches to one in the list of available namespaces
    showLink = namespaces.findIndex((namespace: Namespace): boolean => namespace.name === host.namespace) >= 0;
  }

  if (showLink) {
    return (
      <React.Fragment>
        {isParentKiosk ? (
          <Link
            to={''}
            onClick={() => {
              kioskContextMenuAction(to);
            }}
          >
            {linkText}
          </Link>
        ) : (
          <Link to={to}>{linkText}</Link>
        )}
      </React.Fragment>
    );
  } else {
    return linkText;
  }
};

export const defaultFilter = (value: EnvoySummary, filterMethods: FilterMethodMap): boolean => {
  const activeFilters: ActiveFiltersInfo = FilterSelected.getSelected();
  // If there is no active filters, show the entry
  if (activeFilters.filters.length === 0) {
    return true;
  }

  // Group filters by id
  const groupedFilters: ActiveFilter[][] = activeFilters.filters.reduce(
    (groupedFilters: ActiveFilter[][], filter: ActiveFilter): ActiveFilter[][] => {
      let filterGroup = groupedFilters[filter.category];
      if (!filterGroup) {
        filterGroup = [];
      }
      groupedFilters[filter.category] = filterGroup.concat(filter);
      return groupedFilters;
    },
    []
  );

  // Show entities that has a match in each filter group
  return Object.keys(groupedFilters).reduce((prevMatch: boolean, filterId: string): boolean => {
    // There is at least one filter matching the item in the group
    return (
      prevMatch &&
      groupedFilters[filterId].some((filter: ActiveFilter) => {
        return filterMethods[filter.category](value, filter);
      })
    );
  }, true);
};
