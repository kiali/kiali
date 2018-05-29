import * as React from 'react';
import ServiceId from '../../types/ServiceId';
import ServiceInfoDescription from './ServiceInfo/ServiceInfoDescription';
import ServiceInfoPods from './ServiceInfo/ServiceInfoPods';
import ServiceInfoDeployments from './ServiceInfo/ServiceInfoDeployments';
import ServiceInfoRouteRules from './ServiceInfo/ServiceInfoRouteRules';
import ServiceInfoRoutes from './ServiceInfo/ServiceInfoRoutes';
import ServiceInfoDestinationPolicies from './ServiceInfo/ServiceInfoDestinationPolicies';
import { RouteRule, ServiceDetailsInfo, Validations } from '../../types/ServiceInfo';
import {
  ToastNotification,
  ToastNotificationList,
  Col,
  Row,
  TabContainer,
  TabContent,
  TabPane,
  Nav,
  NavItem
} from 'patternfly-react';
import ServiceInfoVirtualServices from './ServiceInfo/ServiceInfoVirtualServices';
import ServiceInfoDestinationRules from './ServiceInfo/ServiceInfoDestinationRules';

interface ServiceDetails extends ServiceId {
  serviceDetails: ServiceDetailsInfo;
  validations: Validations;
}

type ServiceInfoState = {
  error: boolean;
  errorMessage: string;
};

class ServiceInfo extends React.Component<ServiceDetails, ServiceInfoState> {
  constructor(props: ServiceDetails) {
    super(props);
    props.serviceDetails.routeRules = this.sortRouteRulesByPrecedence(props.serviceDetails.routeRules || []);
    this.state = {
      error: false,
      errorMessage: ''
    };
  }

  sortRouteRulesByPrecedence(routeRules: RouteRule[]) {
    let sorted: RouteRule[] = [];
    if (routeRules) {
      sorted = routeRules.sort((a: RouteRule, b: RouteRule) => {
        if (a.precedence && b.precedence) {
          return a.precedence < b.precedence ? 1 : -1;
        }
        return -1;
      });
    }
    return sorted;
  }

  render() {
    const pods = this.props.serviceDetails.pods || [];
    const deployments = this.props.serviceDetails.deployments || [];
    const dependencies = this.props.serviceDetails.dependencies || {};
    const routeRules = this.props.serviceDetails.routeRules || [];
    const destinationPolicies = this.props.serviceDetails.destinationPolicies || [];
    const virtualServices = this.props.serviceDetails.virtualServices || [];
    const destinationRules = this.props.serviceDetails.destinationRules || [];
    const editorLink = '/namespaces/' + this.props.namespace + '/services/' + this.props.service;
    return (
      <div>
        {this.state.error ? (
          <ToastNotificationList>
            <ToastNotification type="danger">
              <span>
                <strong>Error </strong>
                {this.state.errorMessage}
              </span>
            </ToastNotification>
          </ToastNotificationList>
        ) : null}
        <div className="container-fluid container-cards-pf">
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <ServiceInfoDescription
                name={this.props.serviceDetails.name}
                createdAt={this.props.serviceDetails.createdAt}
                resourceVersion={this.props.serviceDetails.resourceVersion}
                istio_sidecar={this.props.serviceDetails.istioSidecar}
                labels={this.props.serviceDetails.labels}
                ports={this.props.serviceDetails.ports}
                type={this.props.serviceDetails.type}
                ip={this.props.serviceDetails.ip}
                endpoints={this.props.serviceDetails.endpoints}
                health={this.props.serviceDetails.health}
              />
            </Col>
          </Row>
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <TabContainer id="service-tabs" defaultActiveKey={0}>
                <div>
                  <Nav bsClass="nav nav-tabs nav-tabs-pf">
                    <NavItem eventKey={0}>{'Pods (' + pods.length + ')'}</NavItem>
                    <NavItem eventKey={1}>{'Deployments (' + deployments.length + ')'}</NavItem>
                    <NavItem eventKey={2}>{'Source Services (' + Object.keys(dependencies).length + ')'}</NavItem>
                    <NavItem eventKey={3}>{'Route Rules (' + routeRules.length + ')'}</NavItem>
                    <NavItem eventKey={4}>{'Destination Policies (' + destinationPolicies.length + ')'}</NavItem>
                    <NavItem eventKey={5}>{'Virtual Services (' + virtualServices.length + ')'}</NavItem>
                    <NavItem eventKey={6}>{'Destination Rules (' + destinationRules.length + ')'}</NavItem>
                  </Nav>
                  <TabContent>
                    <TabPane eventKey={0}>
                      {(pods.length > 0 || this.props.serviceDetails.istioSidecar) && <ServiceInfoPods pods={pods} />}
                    </TabPane>
                    <TabPane eventKey={1}>
                      {(deployments.length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoDeployments deployments={deployments} />
                      )}
                    </TabPane>
                    <TabPane eventKey={2}>
                      {(Object.keys(dependencies).length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoRoutes dependencies={dependencies} />
                      )}
                    </TabPane>
                    <TabPane eventKey={3}>
                      {(routeRules.length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoRouteRules
                          routeRules={routeRules}
                          editorLink={editorLink}
                          validations={this.props.validations!['routerule']}
                        />
                      )}
                    </TabPane>
                    <TabPane eventKey={4}>
                      {(destinationPolicies.length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoDestinationPolicies
                          destinationPolicies={destinationPolicies}
                          editorLink={editorLink}
                        />
                      )}
                    </TabPane>
                    <TabPane eventKey={5}>
                      {(virtualServices.length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoVirtualServices virtualServices={virtualServices} editorLink={editorLink} />
                      )}
                    </TabPane>
                    <TabPane eventKey={6}>
                      {(destinationRules.length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoDestinationRules destinationRules={destinationRules} editorLink={editorLink} />
                      )}
                    </TabPane>
                  </TabContent>
                </div>
              </TabContainer>
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}

export default ServiceInfo;
