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
import { ServiceDetailsInfo, severityToIconName, validationToSeverity, Validations } from '../../types/ServiceInfo';
import ServiceInfoVirtualServices from './ServiceInfo/ServiceInfoVirtualServices';
import ServiceInfoDestinationRules from './ServiceInfo/ServiceInfoDestinationRules';

interface ServiceDetails extends ServiceId {
  serviceDetails: ServiceDetailsInfo;
  validations: Validations;
  onRefresh: () => void;
  onSelectTab: (tabName: string, tabKey?: string) => void;
  activeTab: (tabName: string, whenEmpty: string) => string;
}

type ServiceInfoState = {
  error: boolean;
  errorMessage: string;
};

interface ValidationChecks {
  hasVirtualServiceChecks: boolean;
  hasDestinationRuleChecks: boolean;
}

const tabName = 'list';

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
        this.props.validations['virtualservice'][virtualService.name].checks.length > 0
    );

    validationChecks.hasDestinationRuleChecks = destinationRules.some(
      destinationRule =>
        this.props.validations['destinationrule'] &&
        this.props.validations['destinationrule'][destinationRule.name] &&
        this.props.validations['destinationrule'][destinationRule.name].checks.length > 0
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
    const getSeverityIcon: any = (severity: string = 'error') => (
      <span>
        {' '}
        <Icon type="pf" name={severityToIconName(severity)} />
      </span>
    );

    const getValidationIcon = (keys: string[], type: string) => {
      let severity = 'warning';
      keys.map(key => {
        const validations = this.props.validations![type][key];
        if (validationToSeverity(validations) === 'error') {
          severity = 'error';
        }
      });
      return getSeverityIcon(severity);
    };

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
              <TabContainer
                id="service-tabs"
                activeKey={this.props.activeTab(tabName, 'pods')}
                onSelect={this.props.onSelectTab(tabName)}
              >
                <div>
                  <Nav bsClass="nav nav-tabs nav-tabs-pf">
                    <NavItem eventKey={'pods'}>{'Pods (' + pods.length + ')'}</NavItem>
                    <NavItem eventKey={'deployments'}>{'Deployments (' + deployments.length + ')'}</NavItem>
                    <NavItem eventKey={'sources'}>
                      {'Source Services (' + Object.keys(dependencies).length + ')'}
                    </NavItem>
                    <NavItem eventKey={'virtualservices'}>
                      {'Virtual Services (' + virtualServices.length + ')'}
                      {validationChecks.hasVirtualServiceChecks
                        ? getValidationIcon(
                            (this.props.serviceDetails.virtualServices || []).map(a => a.name),
                            'virtualservice'
                          )
                        : undefined}
                    </NavItem>
                    <NavItem eventKey={'destinationrules'}>
                      {'Destination Rules (' + destinationRules.length + ')'}
                      {validationChecks.hasDestinationRuleChecks
                        ? getValidationIcon(
                            (this.props.serviceDetails.destinationRules || []).map(a => a.name),
                            'destinationrule'
                          )
                        : undefined}
                    </NavItem>
                  </Nav>
                  <TabContent>
                    <TabPane eventKey={'pods'}>
                      {(pods.length > 0 || this.props.serviceDetails.istioSidecar) && <ServiceInfoPods pods={pods} />}
                    </TabPane>
                    <TabPane eventKey={'deployments'}>
                      {(deployments.length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoDeployments deployments={deployments} />
                      )}
                    </TabPane>
                    <TabPane eventKey={'sources'}>
                      {(Object.keys(dependencies).length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoRoutes dependencies={dependencies} />
                      )}
                    </TabPane>
                    <TabPane eventKey={'virtualservices'}>
                      {(virtualServices.length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoVirtualServices
                          virtualServices={virtualServices}
                          editorLink={editorLink}
                          validations={this.props.validations!['virtualservice']}
                        />
                      )}
                    </TabPane>
                    <TabPane eventKey={'destinationrules'}>
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
