import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import { Tab } from '@patternfly/react-core';

import ServiceId from '../../types/ServiceId';
import IstioMetricsContainer from '../../components/Metrics/IstioMetrics';
import { MetricsObjectTypes } from '../../types/Metrics';
import { KialiAppState } from '../../store/Store';
import { DurationInSeconds, TimeInMilliseconds } from '../../types/Common';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import ServiceInfo from './ServiceInfo';
import TracesComponent from 'components/JaegerIntegration/TracesComponent';
import { JaegerInfo } from 'types/JaegerInfo';
import TrafficDetails from 'components/TrafficList/TrafficDetails';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { getServiceWizardLabel, ServiceDetailsInfo } from '../../types/ServiceInfo';
import {
  Gateway,
  K8sGateway,
  getGatewaysAsList,
  PeerAuthentication,
  Validations,
  getK8sGatewaysAsList
} from '../../types/IstioObjects';
import ServiceWizardDropdown from '../../components/IstioWizards/ServiceWizardDropdown';
import TimeControl from '../../components/Time/TimeControl';
import RenderHeaderContainer from '../../components/Nav/Page/RenderHeader';
import { ErrorMsg } from '../../types/ErrorMsg';
import ErrorSection from '../../components/ErrorSection/ErrorSection';
import connectRefresh from '../../components/Refresh/connectRefresh';

type ServiceDetailsState = {
  cluster?: string;
  currentTab: string;
  gateways: Gateway[];
  k8sGateways: K8sGateway[];
  serviceDetails?: ServiceDetailsInfo;
  peerAuthentications: PeerAuthentication[];
  validations: Validations;
  error?: ErrorMsg;
};

interface ServiceDetailsProps extends RouteComponentProps<ServiceId> {
  duration: DurationInSeconds;
  jaegerInfo?: JaegerInfo;
  lastRefreshAt: TimeInMilliseconds;
}

const tabName = 'tab';
const defaultTab = 'info';
const trafficTabName = 'traffic';

const tabIndex: { [tab: string]: number } = {
  info: 0,
  traffic: 1,
  metrics: 2,
  traces: 3
};

class ServiceDetails extends React.Component<ServiceDetailsProps, ServiceDetailsState> {
  private promises = new PromisesRegistry();

  constructor(props: ServiceDetailsProps) {
    super(props);
    const urlParams = new URLSearchParams(this.props.location.search);
    const cluster = urlParams.get('cluster') || undefined;
    this.state = {
      // Because null is not the same as undefined and urlParams.get(...) returns null.
      cluster: cluster,
      currentTab: activeTab(tabName, defaultTab),
      gateways: [],
      k8sGateways: [],
      validations: {},
      peerAuthentications: []
    };
  }

  componentDidMount(): void {
    this.fetchService();
  }

  componentDidUpdate(prevProps: ServiceDetailsProps, _prevState: ServiceDetailsState) {
    const currentTab = activeTab(tabName, defaultTab);
    if (
      prevProps.match.params.namespace !== this.props.match.params.namespace ||
      prevProps.match.params.service !== this.props.match.params.service ||
      currentTab !== this.state.currentTab ||
      prevProps.lastRefreshAt !== this.props.lastRefreshAt
    ) {
      if (currentTab === 'info') {
        this.fetchService();
      }
      if (currentTab !== this.state.currentTab) {
        this.setState({ currentTab: currentTab });
      }
    }
  }

  private fetchService = () => {
    this.promises.cancelAll();
    this.promises
      .register(
        'gateways',
        API.getAllIstioConfigs(
          [this.props.match.params.namespace],
          ['gateways', 'k8sgateways'],
          false,
          '',
          '',
          this.state.cluster
        )
      )
      .then(response => {
        const gws: Gateway[] = [];
        const k8sGws: K8sGateway[] = [];
        Object.values(response.data).forEach(item => {
          gws.push(...item.gateways);
          k8sGws.push(...item.k8sGateways);
        });
        this.setState({ gateways: gws });
        this.setState({ k8sGateways: k8sGws });
      })
      .catch(gwError => {
        AlertUtils.addError('Could not fetch Gateways list.', gwError);
      });

    // this.props.
    API.getServiceDetail(
      this.props.match.params.namespace,
      this.props.match.params.service,
      true,
      this.state.cluster,
      this.props.duration
    )
      .then(results => {
        this.setState({
          serviceDetails: results,
          validations: results.validations
        });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch Service Details.', error);
        const msg: ErrorMsg = {
          title: 'No Service is selected',
          description: this.props.match.params.service + ' is not found in the mesh'
        };
        this.setState({ error: msg });
      });

    API.getAllIstioConfigs(
      [this.props.match.params.namespace],
      ['peerauthentications'],
      false,
      '',
      '',
      this.state.cluster
    )
      .then(results => {
        this.setState({
          peerAuthentications: results.data[this.props.match.params.namespace].peerAuthentications
        });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch PeerAuthentications.', error);
      });
  };

  private renderTabs() {
    const overTab = (
      <Tab eventKey={0} title="Overview" key="Overview">
        <ServiceInfo
          cluster={this.state.cluster ? this.state.cluster : ''}
          namespace={this.props.match.params.namespace}
          service={this.props.match.params.service}
          serviceDetails={this.state.serviceDetails}
          gateways={this.state.gateways}
          k8sGateways={this.state.k8sGateways}
          peerAuthentications={this.state.peerAuthentications}
          validations={this.state.validations}
        />
      </Tab>
    );
    const trafficTab = (
      <Tab eventKey={1} title="Traffic" key={trafficTabName}>
        <TrafficDetails
          itemName={this.props.match.params.service}
          itemType={MetricsObjectTypes.SERVICE}
          lastRefreshAt={this.props.lastRefreshAt}
          namespace={this.props.match.params.namespace}
          cluster={this.state.cluster}
        />
      </Tab>
    );

    const inTab = (
      <Tab eventKey={2} title="Inbound Metrics" key="Inbound Metrics">
        <IstioMetricsContainer
          lastRefreshAt={this.props.lastRefreshAt}
          namespace={this.props.match.params.namespace}
          object={this.props.match.params.service}
          objectType={MetricsObjectTypes.SERVICE}
          cluster={this.state.cluster}
          direction={'inbound'}
        />
      </Tab>
    );

    const tabsArray: JSX.Element[] = [overTab, trafficTab, inTab];

    if (this.props.jaegerInfo && this.props.jaegerInfo.enabled && this.props.jaegerInfo.integration) {
      tabsArray.push(
        <Tab eventKey={3} title="Traces" key="Traces">
          <TracesComponent
            lastRefreshAt={this.props.lastRefreshAt}
            namespace={this.props.match.params.namespace}
            cluster={this.state.cluster}
            target={this.props.match.params.service}
            targetKind={'service'}
          />
        </Tab>
      );
    }

    return tabsArray;
  }

  render() {
    let useCustomTime = false;
    switch (this.state.currentTab) {
      case 'info':
      case 'traffic':
        useCustomTime = false;
        break;
      case 'metrics':
      case 'traces':
        useCustomTime = true;
        break;
    }
    const actionsToolbar = this.state.serviceDetails ? (
      <ServiceWizardDropdown
        namespace={this.props.match.params.namespace}
        serviceName={this.state.serviceDetails.service.name}
        annotations={this.state.serviceDetails.service.annotations}
        show={false}
        readOnly={getServiceWizardLabel(this.state.serviceDetails.service) !== ''}
        workloads={this.state.serviceDetails.workloads || []}
        subServices={this.state.serviceDetails.subServices || []}
        virtualServices={this.state.serviceDetails.virtualServices}
        k8sHTTPRoutes={this.state.serviceDetails.k8sHTTPRoutes}
        destinationRules={this.state.serviceDetails.destinationRules}
        istioPermissions={this.state.serviceDetails.istioPermissions}
        gateways={getGatewaysAsList(this.state.gateways)}
        k8sGateways={getK8sGatewaysAsList(this.state.k8sGateways)}
        peerAuthentications={this.state.peerAuthentications}
        tlsStatus={this.state.serviceDetails.namespaceMTLS}
        onChange={this.fetchService}
      />
    ) : undefined;

    return (
      <>
        <RenderHeaderContainer
          location={this.props.location}
          rightToolbar={<TimeControl customDuration={useCustomTime} />}
          actionsToolbar={actionsToolbar}
        />
        {this.state.error && <ErrorSection error={this.state.error} />}
        {!this.state.error && (
          <ParameterizedTabs
            id="basic-tabs"
            onSelect={tabValue => {
              this.setState({ currentTab: tabValue });
            }}
            tabMap={tabIndex}
            tabName={tabName}
            defaultTab={defaultTab}
            activeTab={this.state.currentTab}
            mountOnEnter={true}
            unmountOnExit={true}
          >
            {this.renderTabs()}
          </ParameterizedTabs>
        )}
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  jaegerInfo: state.jaegerState.info
});

const ServiceDetailsPageContainer = connectRefresh(connect(mapStateToProps)(ServiceDetails));
export default ServiceDetailsPageContainer;
