import * as React from 'react';
import { style } from 'typestyle';
import {
  Col,
  Icon,
  Nav,
  NavItem,
  Row,
  TabContainer,
  TabContent,
  ToastNotification,
  ToastNotificationList
} from 'patternfly-react';

import ServiceId from '../../types/ServiceId';
import ServiceInfoDescription from './ServiceInfo/ServiceInfoDescription';
import { ServiceDetailsInfo, severityToIconName, validationToSeverity } from '../../types/ServiceInfo';
import ServiceInfoVirtualServices from './ServiceInfo/ServiceInfoVirtualServices';
import ServiceInfoDestinationRules from './ServiceInfo/ServiceInfoDestinationRules';
import ServiceInfoWorkload from './ServiceInfo/ServiceInfoWorkload';
import { ObjectValidation, Validations } from '../../types/IstioObjects';
import { TabPaneWithErrorBoundary } from '../../components/ErrorBoundary/WithErrorBoundary';
import IstioWizardDropdown from '../../components/IstioWizards/IstioWizardDropdown';
import { ThreeScaleInfo, ThreeScaleServiceRule } from '../../types/ThreeScale';
import { DurationDropdownContainer } from '../../components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';

interface ServiceDetails extends ServiceId {
  serviceDetails: ServiceDetailsInfo;
  gateways: string[];
  validations: Validations;
  onRefresh: () => void;
  onSelectTab: (tabName: string, postHandler?: (tabName: string) => void) => void;
  activeTab: (tabName: string, whenEmpty: string) => string;
  threeScaleInfo: ThreeScaleInfo;
  threeScaleServiceRule?: ThreeScaleServiceRule;
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
const tabIconStyle = style({
  fontSize: '0.9em'
});

class ServiceInfo extends React.Component<ServiceDetails, ServiceInfoState> {
  constructor(props: ServiceDetails) {
    super(props);
    this.state = {
      error: false,
      errorMessage: ''
    };
  }

  validationChecks(): ValidationChecks {
    const validationChecks = {
      hasVirtualServiceChecks: false,
      hasDestinationRuleChecks: false
    };
    const validations = this.props.validations || {};
    validationChecks.hasVirtualServiceChecks = this.props.serviceDetails.virtualServices.items.some(
      virtualService =>
        validations.virtualservice &&
        validations.virtualservice[virtualService.metadata.name] &&
        validations.virtualservice[virtualService.metadata.name].checks.length > 0
    );

    validationChecks.hasDestinationRuleChecks = this.props.serviceDetails.destinationRules.items.some(
      destinationRule =>
        validations.destinationrule &&
        destinationRule.metadata &&
        validations.destinationrule[destinationRule.metadata.name] &&
        validations.destinationrule[destinationRule.metadata.name].checks.length > 0
    );

    return validationChecks;
  }

  errorBoundaryMessage(resourceName: string) {
    return `One of the ${resourceName} associated to this service has an invalid format`;
  }

  getServiceValidation(): ObjectValidation {
    if (this.props.validations && this.props.validations.service) {
      return this.props.validations.service[this.props.serviceDetails.service.name];
    }
    return {} as ObjectValidation;
  }

  render() {
    const workloads = this.props.serviceDetails.workloads || [];
    const virtualServices = this.props.serviceDetails.virtualServices || [];
    const destinationRules = this.props.serviceDetails.destinationRules || [];
    const validations = this.props.validations || {};
    const validationChecks = this.validationChecks();
    const getSeverityIcon: any = (severity: string = 'error') => (
      <span className={tabIconStyle}>
        {' '}
        <Icon type="pf" name={severityToIconName(severity)} />
      </span>
    );

    const getValidationIcon = (keys: string[], type: string) => {
      let severity = 'warning';
      keys.forEach(key => {
        const validationsForIcon = (this.props.validations || {})![type][key];
        if (validationToSeverity(validationsForIcon) === 'error') {
          severity = 'error';
        }
      });
      return getSeverityIcon(severity);
    };

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
              <span style={{ float: 'right' }}>
                <DurationDropdownContainer id="service-info-duration-dropdown" />{' '}
                <RefreshButtonContainer handleRefresh={this.props.onRefresh} />
                &nbsp;
                <IstioWizardDropdown
                  namespace={this.props.namespace}
                  serviceName={this.props.serviceDetails.service.name}
                  show={false}
                  workloads={workloads}
                  virtualServices={virtualServices}
                  destinationRules={destinationRules}
                  gateways={this.props.gateways}
                  tlsStatus={this.props.serviceDetails.namespaceMTLS}
                  onChange={this.props.onRefresh}
                  threeScaleInfo={this.props.threeScaleInfo}
                  threeScaleServiceRule={this.props.threeScaleServiceRule}
                />
              </span>
            </Col>
          </Row>
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <ServiceInfoDescription
                name={this.props.serviceDetails.service.name}
                namespace={this.props.namespace}
                createdAt={this.props.serviceDetails.service.createdAt}
                resourceVersion={this.props.serviceDetails.service.resourceVersion}
                istioEnabled={this.props.serviceDetails.istioSidecar}
                labels={this.props.serviceDetails.service.labels}
                selectors={this.props.serviceDetails.service.selectors}
                ports={this.props.serviceDetails.service.ports}
                type={this.props.serviceDetails.service.type}
                ip={this.props.serviceDetails.service.ip}
                endpoints={this.props.serviceDetails.endpoints}
                health={this.props.serviceDetails.health}
                externalName={this.props.serviceDetails.service.externalName}
                threeScaleServiceRule={this.props.threeScaleServiceRule}
                validations={this.getServiceValidation()}
              />
            </Col>
          </Row>
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <TabContainer
                id="service-tabs"
                activeKey={this.props.activeTab(tabName, 'workloads')}
                onSelect={this.props.onSelectTab(tabName)}
              >
                <div>
                  <Nav bsClass="nav nav-tabs nav-tabs-pf">
                    <NavItem eventKey={'workloads'}>{'Workloads (' + Object.keys(workloads).length + ')'}</NavItem>
                    <NavItem eventKey={'virtualservices'}>
                      {'Virtual Services (' + virtualServices.items.length + ')'}
                      {validationChecks.hasVirtualServiceChecks
                        ? getValidationIcon(
                            (this.props.serviceDetails.virtualServices.items || []).map(a => a.metadata.name),
                            'virtualservice'
                          )
                        : undefined}
                    </NavItem>
                    <NavItem eventKey={'destinationrules'}>
                      {'Destination Rules (' + destinationRules.items.length + ')'}
                      {validationChecks.hasDestinationRuleChecks
                        ? getValidationIcon(
                            (this.props.serviceDetails.destinationRules.items || []).map(a => a.metadata.name),
                            'destinationrule'
                          )
                        : undefined}
                    </NavItem>
                  </Nav>
                  <TabContent>
                    <TabPaneWithErrorBoundary eventKey={'workloads'} message={this.errorBoundaryMessage('Workloads')}>
                      {(Object.keys(workloads).length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoWorkload workloads={workloads} namespace={this.props.namespace} />
                      )}
                    </TabPaneWithErrorBoundary>
                    <TabPaneWithErrorBoundary
                      eventKey={'virtualservices'}
                      message={this.errorBoundaryMessage('Virtual Services')}
                    >
                      {(virtualServices.items.length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoVirtualServices
                          virtualServices={virtualServices.items}
                          validations={validations!.virtualservice}
                        />
                      )}
                    </TabPaneWithErrorBoundary>
                    <TabPaneWithErrorBoundary
                      eventKey={'destinationrules'}
                      message={this.errorBoundaryMessage('Destination Rules')}
                    >
                      {(destinationRules.items.length > 0 || this.props.serviceDetails.istioSidecar) && (
                        <ServiceInfoDestinationRules
                          destinationRules={destinationRules.items}
                          validations={validations!.destinationrule}
                        />
                      )}
                    </TabPaneWithErrorBoundary>
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
