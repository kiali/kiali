import * as React from 'react';
import { style } from 'typestyle';
import { Col, Row, ToastNotification, ToastNotificationList } from 'patternfly-react';

import ServiceId from '../../types/ServiceId';
import ServiceInfoDescription from './ServiceInfo/ServiceInfoDescription';
import { ServiceDetailsInfo, validationToSeverity } from '../../types/ServiceInfo';
import ServiceInfoVirtualServices from './ServiceInfo/ServiceInfoVirtualServices';
import ServiceInfoDestinationRules from './ServiceInfo/ServiceInfoDestinationRules';
import ServiceInfoWorkload from './ServiceInfo/ServiceInfoWorkload';
import { ObjectValidation, Validations, ValidationTypes } from '../../types/IstioObjects';
import IstioWizardDropdown from '../../components/IstioWizards/IstioWizardDropdown';
import { ThreeScaleInfo, ThreeScaleServiceRule } from '../../types/ThreeScale';
import { DurationDropdownContainer } from '../../components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import ErrorBoundaryWithMessage from '../../components/ErrorBoundary/ErrorBoundaryWithMessage';
import { Tab } from '@patternfly/react-core';
import Validation from '../../components/Validations/Validation';

interface ServiceDetails extends ServiceId {
  serviceDetails: ServiceDetailsInfo;
  gateways: string[];
  validations: Validations;
  onRefresh: () => void;
  threeScaleInfo: ThreeScaleInfo;
  threeScaleServiceRule?: ThreeScaleServiceRule;
}

type ServiceInfoState = {
  error: boolean;
  errorMessage: string;
  currentTab: string;
};

interface ValidationChecks {
  hasVirtualServiceChecks: boolean;
  hasDestinationRuleChecks: boolean;
}

const tabIconStyle = style({
  fontSize: '0.9em'
});

const tabName = 'list';
const defaultTab = 'workloads';
const paramToTab: { [key: string]: number } = {
  workloads: 0,
  virtualservices: 1,
  destinationrules: 2
};

class ServiceInfo extends React.Component<ServiceDetails, ServiceInfoState> {
  constructor(props: ServiceDetails) {
    super(props);
    this.state = {
      error: false,
      errorMessage: '',
      currentTab: activeTab(tabName, defaultTab)
    };
  }

  componentDidUpdate() {
    const aTab = activeTab(tabName, defaultTab);

    if (this.state.currentTab !== aTab) {
      this.setState({
        currentTab: aTab
      });
    }
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
        validations.virtualservice[virtualService.metadata.name].checks &&
        validations.virtualservice[virtualService.metadata.name].checks.length > 0
    );

    validationChecks.hasDestinationRuleChecks = this.props.serviceDetails.destinationRules.items.some(
      destinationRule =>
        validations.destinationrule &&
        destinationRule.metadata &&
        validations.destinationrule[destinationRule.metadata.name] &&
        validations.destinationrule[destinationRule.metadata.name].checks &&
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
    const getSeverityIcon: any = (severity: ValidationTypes = ValidationTypes.Error) => (
      <span className={tabIconStyle}>
        {' '}
        <Validation severity={severity} />
      </span>
    );

    const getValidationIcon = (keys: string[], type: string) => {
      let severity = ValidationTypes.Warning;
      keys.forEach(key => {
        const validationsForIcon = (this.props.validations || {})![type][key];
        if (validationToSeverity(validationsForIcon) === ValidationTypes.Error) {
          severity = ValidationTypes.Error;
        }
      });
      return getSeverityIcon(severity);
    };

    // @ts-ignore
    const vsItems = virtualServices.items;
    // @ts-ignore
    const drItems = destinationRules.items;

    const vsTabTitle: any = (
      <>
        Virtual Services ({vsItems.length})
        {validationChecks.hasVirtualServiceChecks
          ? getValidationIcon(
              (this.props.serviceDetails.virtualServices.items || []).map(a => a.metadata.name),
              'virtualservice'
            )
          : undefined}
      </>
    );

    const drTabTitle: any = (
      <>
        Destination Rules ({drItems.length})
        {validationChecks.hasDestinationRuleChecks
          ? getValidationIcon(
              (this.props.serviceDetails.destinationRules.items || []).map(a => a.metadata.name),
              'destinationrule'
            )
          : undefined}
      </>
    );

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
                  // @ts-ignore
                  virtualServices={virtualServices}
                  // @ts-ignore
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
              <ParameterizedTabs
                id="service-tabs"
                onSelect={tabValue => {
                  this.setState({ currentTab: tabValue });
                }}
                tabMap={paramToTab}
                tabName={tabName}
                defaultTab={defaultTab}
                activeTab={this.state.currentTab}
              >
                <Tab eventKey={0} title={'Workloads (' + Object.keys(workloads).length + ')'}>
                  <ErrorBoundaryWithMessage message={this.errorBoundaryMessage('Workloads')}>
                    {(Object.keys(workloads).length > 0 || this.props.serviceDetails.istioSidecar) && (
                      <ServiceInfoWorkload workloads={workloads} namespace={this.props.namespace} />
                    )}
                  </ErrorBoundaryWithMessage>
                </Tab>
                <Tab eventKey={1} title={vsTabTitle}>
                  <ErrorBoundaryWithMessage message={this.errorBoundaryMessage('Virtual Services')}>
                    {(vsItems.length > 0 || this.props.serviceDetails.istioSidecar) && (
                      <ServiceInfoVirtualServices virtualServices={vsItems} validations={validations!.virtualservice} />
                    )}
                  </ErrorBoundaryWithMessage>
                </Tab>
                <Tab eventKey={2} title={drTabTitle}>
                  <ErrorBoundaryWithMessage message={this.errorBoundaryMessage('Destination Rules')}>
                    {(drItems.length > 0 || this.props.serviceDetails.istioSidecar) && (
                      <ServiceInfoDestinationRules
                        destinationRules={drItems}
                        validations={validations!.destinationrule}
                      />
                    )}
                  </ErrorBoundaryWithMessage>
                </Tab>
              </ParameterizedTabs>
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}

export default ServiceInfo;
