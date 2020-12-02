import * as React from 'react';
import { style } from 'typestyle';
import { Grid, GridItem, Tab } from '@patternfly/react-core';
import ServiceId from '../../types/ServiceId';
import ServiceInfoDescription from './ServiceInfo/ServiceInfoDescription';
import { ServiceDetailsInfo, validationToSeverity } from '../../types/ServiceInfo';
import ServiceInfoWorkload from './ServiceInfo/ServiceInfoWorkload';
import { ObjectValidation, PeerAuthentication, Validations, ValidationTypes } from '../../types/IstioObjects';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import ErrorBoundaryWithMessage from '../../components/ErrorBoundary/ErrorBoundaryWithMessage';
import Validation from '../../components/Validations/Validation';
import { RenderComponentScroll } from '../../components/Nav/Page';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { DurationInSeconds, TimeInMilliseconds } from 'types/Common';
import GraphDataSource from 'services/GraphDataSource';
import IstioConfigSubList from '../../components/IstioConfigSubList/IstioConfigSubList';
import { drToIstioItems, vsToIstioItems } from '../../types/IstioConfigList';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { durationSelector } from '../../store/Selectors';

interface Props extends ServiceId {
  duration: DurationInSeconds;
  lastRefreshAt: TimeInMilliseconds;
  serviceDetails?: ServiceDetailsInfo;
  gateways: string[];
  peerAuthentications: PeerAuthentication[];
  validations: Validations;
}

type ServiceInfoState = {
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
  istioconfig: 1
};

class ServiceInfo extends React.Component<Props, ServiceInfoState> {
  private promises = new PromisesRegistry();
  private graphDataSource = new GraphDataSource();

  constructor(props: Props) {
    super(props);
    this.state = {
      currentTab: activeTab(tabName, defaultTab)
    };
  }

  componentDidMount() {
    this.fetchBackend();
  }

  componentDidUpdate(prev: Props) {
    const aTab = activeTab(tabName, defaultTab);
    if (this.state.currentTab !== aTab) {
      this.setState({ currentTab: aTab });
    }
    if (
      prev.duration !== this.props.duration ||
      prev.lastRefreshAt !== this.props.lastRefreshAt ||
      prev.serviceDetails !== this.props.serviceDetails
    ) {
      this.fetchBackend();
    }
  }

  private fetchBackend = () => {
    this.promises.cancelAll();
    this.graphDataSource.fetchForService(this.props.duration, this.props.namespace, this.props.service);
  };

  private validationChecks(): ValidationChecks {
    const validationChecks = {
      hasVirtualServiceChecks: false,
      hasDestinationRuleChecks: false
    };
    const validations = this.props.validations || {};
    if (this.props.serviceDetails) {
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
    }

    return validationChecks;
  }

  private errorBoundaryMessage(resourceName: string) {
    return `One of the ${resourceName} associated to this service has an invalid format`;
  }

  private getServiceValidation(): ObjectValidation | undefined {
    if (this.props.validations && this.props.validations.service && this.props.serviceDetails) {
      return this.props.validations.service[this.props.serviceDetails.service.name];
    }
    return undefined;
  }

  render() {
    const workloads = this.props.serviceDetails?.workloads || [];
    const validationChecks = this.validationChecks();
    const getSeverityIcon: any = (severity: ValidationTypes = ValidationTypes.Error) => (
      <span className={tabIconStyle}>
        {' '}
        <Validation severity={severity} />
      </span>
    );

    const getValidationIcon = (keys: string[], types: string[]) => {
      let severity = ValidationTypes.Warning;
      keys.forEach(key => {
        types.forEach(type => {
          if (this.props.validations && this.props.validations[type]) {
            const validationsForIcon = (this.props.validations || {})![type][key];
            if (validationToSeverity(validationsForIcon) === ValidationTypes.Error) {
              severity = ValidationTypes.Error;
            }
          }
        });
      });
      return getSeverityIcon(severity);
    };

    let istioTabTitle: JSX.Element | undefined;
    if (this.props.serviceDetails) {
      let istioConfigIcon = undefined;
      if (validationChecks.hasVirtualServiceChecks || validationChecks.hasDestinationRuleChecks) {
        const names: string[] = [];
        this.props.serviceDetails.virtualServices?.items.forEach(vs => names.push(vs.metadata.name));
        this.props.serviceDetails.destinationRules?.items.forEach(dr => names.push(dr.metadata.name));
        istioConfigIcon = getValidationIcon(names, ['virtualservice', 'destinationrule']);
      }
      istioTabTitle = (
        <>
          Istio Config (
          {this.props.serviceDetails.virtualServices.items.length +
            this.props.serviceDetails.destinationRules.items.length}
          ){istioConfigIcon}
        </>
      );
    }

    const vsIstioConfigItems = this.props.serviceDetails?.virtualServices
      ? vsToIstioItems(this.props.serviceDetails.virtualServices.items, this.props.serviceDetails.validations)
      : [];
    const drIstioConfigItems = this.props.serviceDetails?.destinationRules
      ? drToIstioItems(this.props.serviceDetails.destinationRules.items, this.props.serviceDetails.validations)
      : [];
    const istioConfigItems = vsIstioConfigItems.concat(drIstioConfigItems);

    return (
      <>
        <RenderComponentScroll>
          <Grid gutter={'md'}>
            <GridItem span={12}>
              <ServiceInfoDescription
                name={this.props.serviceDetails?.service.name || ''}
                namespace={this.props.namespace}
                createdAt={this.props.serviceDetails?.service.createdAt || ''}
                resourceVersion={this.props.serviceDetails?.service.resourceVersion || ''}
                additionalDetails={this.props.serviceDetails?.additionalDetails || []}
                istioEnabled={this.props.serviceDetails?.istioSidecar}
                labels={this.props.serviceDetails?.service.labels}
                selectors={this.props.serviceDetails?.service.selectors}
                ports={this.props.serviceDetails?.service.ports}
                type={this.props.serviceDetails?.service.type}
                ip={this.props.serviceDetails?.service.ip}
                endpoints={this.props.serviceDetails?.endpoints}
                health={this.props.serviceDetails?.health}
                externalName={this.props.serviceDetails?.service.externalName}
                validations={this.getServiceValidation()}
                miniGraphDatasource={this.graphDataSource}
              />
            </GridItem>
            {this.props.serviceDetails && (
              <GridItem span={12}>
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
                      <ServiceInfoWorkload
                        service={this.props.serviceDetails}
                        workloads={workloads}
                        namespace={this.props.namespace}
                      />
                    </ErrorBoundaryWithMessage>
                  </Tab>
                  <Tab eventKey={1} title={istioTabTitle}>
                    <ErrorBoundaryWithMessage message={this.errorBoundaryMessage('Istio Config')}>
                      <IstioConfigSubList name={this.props.serviceDetails.service.name} items={istioConfigItems} />
                    </ErrorBoundaryWithMessage>
                  </Tab>
                </ParameterizedTabs>
              </GridItem>
            )}
          </Grid>
        </RenderComponentScroll>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  lastRefreshAt: state.globalState.lastRefreshAt
});

const ServiceInfoContainer = connect(mapStateToProps)(ServiceInfo);
export default ServiceInfoContainer;
