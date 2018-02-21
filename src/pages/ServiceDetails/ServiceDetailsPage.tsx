import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import ServiceInfo from './ServiceInfo/ServiceInfo';
import ServiceMetrics from './ServiceMetrics';
import ServiceId from '../../types/ServiceId';
import { Nav, NavItem, TabContainer, TabContent, TabPane } from 'patternfly-react';

export default function ServiceDetails(routeProps: RouteComponentProps<ServiceId>) {
  return (
    <div className="container-fluid container-pf-nav-pf-vertical">
      <div className="page-header">
        <h2>
          Service {routeProps.match.params.namespace} / {routeProps.match.params.service}
        </h2>
      </div>
      <TabContainer id="basic-tabs" defaultActiveKey={1}>
        <div>
          <Nav bsClass="nav nav-tabs nav-tabs-pf">
            <NavItem eventKey={1}>
              <div dangerouslySetInnerHTML={{ __html: 'Info' }} />
            </NavItem>
            <NavItem eventKey={2}>
              <div dangerouslySetInnerHTML={{ __html: 'Metrics' }} />
            </NavItem>
          </Nav>
          <TabContent>
            <TabPane eventKey={1}>
              <ServiceInfo namespace={routeProps.match.params.namespace} service={routeProps.match.params.service} />
            </TabPane>
            <TabPane eventKey={2}>
              <ServiceMetrics namespace={routeProps.match.params.namespace} service={routeProps.match.params.service} />
            </TabPane>
          </TabContent>
        </div>
      </TabContainer>
    </div>
  );
}
