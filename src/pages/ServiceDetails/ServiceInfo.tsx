import * as React from 'react';
import {
  Button,
  Col,
  Icon,
  Nav,
  NavItem,
  Row,
  TabContainer,
  TabContent,
  TabPane,
  ToastNotification,
  ToastNotificationList
} from 'patternfly-react';

import ServiceId from '../../types/ServiceId';
import ServiceInfoDescription from './ServiceInfo/ServiceInfoDescription';
import ServiceInfoPods from './ServiceInfo/ServiceInfoPods';
import ServiceInfoDeployments from './ServiceInfo/ServiceInfoDeployments';
import ServiceInfoRoutes from './ServiceInfo/ServiceInfoRoutes';
import { ServiceDetailsInfo, severityToIconName, Validations } from '../../types/ServiceInfo';
import ServiceInfoVirtualServices from './ServiceInfo/ServiceInfoVirtualServices';
import ServiceInfoDestinationRules from './ServiceInfo/ServiceInfoDestinationRules';

interface ServiceDetails extends ServiceId {
  serviceDetails: ServiceDetailsInfo;
  validations: Validations;
  onRefresh: () => void;
}

type ServiceInfoState = {
  error: boolean;
  errorMessage: string;
};

interface ValidationChecks {
  hasVirtualServiceChecks: boolean;
  hasDestinationRuleChecks: boolean;
}

class ServiceInfo extends React.Component<ServiceDetails, ServiceInfoState> {
  constructor(props: ServiceDetails) {
    super(props);
    this.state = {
      error: false,
      errorMessage: ''
    };
  }

  validationChecks(): ValidationChecks {
    let validationChecks = {
      hasVirtualServiceChecks: false,
      hasDestinationRuleChecks: false
    };

    const virtualServices = this.props.serviceDetails.virtualServices || [];
    const destinationRules = this.props.serviceDetails.destinationRules || [];

    validationChecks.hasVirtualServiceChecks = virtualServices.some(
      virtualService =>
        this.props.validations['virtualservice'] &&
        this.props.validations['virtualservice'][virtualService.name] &&
        !this.props.validations['virtualservice'][virtualService.name].valid
    );

    validationChecks.hasDestinationRuleChecks = destinationRules.some(
      destinationRule =>
        this.props.validations['destinationrule'] &&
        this.props.validations['destinationrule'][destinationRule.name] &&
        !this.props.validations['destinationrule'][destinationRule.name].valid
    );

    return validationChecks;
  }

  render() {
    const pods = this.props.serviceDetails.pods || [];
    const deployments = this.props.serviceDetails.deployments || [];
    const dependencies = this.props.serviceDetails.dependencies || {};
    const virtualServices = this.props.serviceDetails.virtualServices || [];
    const destinationRules = this.props.serviceDetails.destinationRules || [];
    const validationChecks = this.validationChecks();
    const errorIcon: any = (
      <span>
        {' '}
        <Icon type="pf" name={severityToIconName('error')} />
      </span>
    );

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
              <Button onClick={this.props.onRefresh} style={{ float: 'right' }}>
                <Icon name="refresh" />
              </Button>
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
                    <NavItem eventKey={3}>
                      {'Virtual Services (' + virtualServices.length + ')'}
                      {validationChecks.hasVirtualServiceChecks ? errorIcon : undefined}
                    </NavItem>
                    <NavItem eventKey={4}>
                      {'Destination Rules (' + destinationRules.length + ')'}
                      {validationChecks.hasDestinationRuleChecks ? errorIcon : undefined}
                    </NavItem>
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
                      {(virtualServices.length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoVirtualServices
                          virtualServices={virtualServices}
                          editorLink={editorLink}
                          validations={this.props.validations!['virtualservice']}
                        />
                      )}
                    </TabPane>
                    <TabPane eventKey={4}>
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
