import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import ServiceInfo from './ServiceInfo';
import ServiceMetrics from './ServiceMetrics';
import ServiceId from '../../types/ServiceId';

export default function ServiceDetails(routeProps: RouteComponentProps<ServiceId>) {
  return (
    <div className="container-fluid container-pf-nav-pf-vertical">
      <div className="page-header">
        <h2>
          Service {routeProps.match.params.namespace} / {routeProps.match.params.service}
        </h2>
      </div>
      <ServiceInfo namespace={routeProps.match.params.namespace} service={routeProps.match.params.service} />
      <ServiceMetrics namespace={routeProps.match.params.namespace} service={routeProps.match.params.service} />
    </div>
  );
}
