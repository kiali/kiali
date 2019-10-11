import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import { Icon } from 'patternfly-react';
import { Tab } from '@patternfly/react-core';
import ServiceId from '../../types/ServiceId';
import * as API from '../../services/Api';
import * as MessageCenter from '../../utils/MessageCenter';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { Validations } from '../../types/IstioObjects';
import IstioMetricsContainer from '../../components/Metrics/IstioMetrics';
import ServiceTraces from './ServiceTraces';
import ServiceInfo from './ServiceInfo';
import { GraphDefinition, GraphType, NodeParamsType, NodeType } from '../../types/Graph';
import { MetricsObjectTypes } from '../../types/Metrics';
import { default as DestinationRuleValidator } from './ServiceInfo/types/DestinationRuleValidator';
import BreadcrumbView from '../../components/BreadcrumbView/BreadcrumbView';
import MetricsDuration from '../../components/MetricsOptions/MetricsDuration';
import { fetchTrafficDetails } from '../../helpers/TrafficDetailsHelper';
import TrafficDetails from '../../components/Metrics/TrafficDetails';
import { ApiDocumentation } from '../../components/ApiDocumentation/ApiDocumentation';
import { ThreeScaleInfo, ThreeScaleServiceRule } from '../../types/ThreeScale';
import { KialiAppState } from '../../store/Store';
import PfTitle from '../../components/Pf/PfTitle';
import { DurationInSeconds } from '../../types/Common';
import { durationSelector } from '../../store/Selectors';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import Namespace from '../../types/Namespace';
import { MessageType } from '../../types/MessageCenter';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import { DurationDropdownContainer } from '../../components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';
import IstioWizardDropdown from '../../components/IstioWizards/IstioWizardDropdown';

type ServiceDetailsState = {
  serviceDetailsInfo: ServiceDetailsInfo;
  gateways: string[];
  trafficData: GraphDefinition | null;
  validations: Validations;
  threeScaleInfo: ThreeScaleInfo;
  threeScaleServiceRule?: ThreeScaleServiceRule;
  currentTab: string;
};

interface ServiceDetailsProps extends RouteComponentProps<ServiceId> {
  duration: DurationInSeconds;
  jaegerUrl: string;
  jaegerIntegration: boolean;
}

interface ParsedSearch {
  type?: string;
  name?: string;
}

const emptyService = {
  istioSidecar: true, // true until proven otherwise (workload with missing sidecar exists)
  service: {
    type: '',
    name: '',
    createdAt: '',
    resourceVersion: '',
    ip: '',
    externalName: ''
  },
  virtualServices: {
    items: [],
    permissions: {
      create: false,
      update: false,
      delete: false
    }
  },
  destinationRules: {
    items: [],
    permissions: {
      create: false,
      update: false,
      delete: false
    }
  },
  validations: {},
  apiDocumentation: {
    type: '',
    hasSpec: false
  }
};

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
    this.state = {
      currentTab: activeTab(tabName, defaultTab),
      serviceDetailsInfo: emptyService,
      gateways: [],
      trafficData: null,
      validations: {},
      threeScaleInfo: {
        enabled: false,
        permissions: {
          create: false,
          update: false,
          delete: false
        }
      }
    };
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  servicePageURL(parsedSearch?: ParsedSearch) {
    let url = '/namespaces/' + this.props.match.params.namespace + '/services/' + this.props.match.params.service;
    if (parsedSearch && parsedSearch.type) {
      url += `?list=${parsedSearch.type}s`;
    }
    return url;
  }

  // Helper method to extract search urls with format
  // ?virtualservice=name or ?destinationrule=name
  parseSearch(): ParsedSearch {
    const parsed: ParsedSearch = {};
    if (this.props.location.search) {
      const firstParams = this.props.location.search
        .split('&')[0]
        .replace('?', '')
        .split('=');
      parsed.type = firstParams[0];
      parsed.name = firstParams[1];
    }
    return {};
  }

  componentDidMount() {
    this.doRefresh();
  }

  componentDidUpdate(prevProps: ServiceDetailsProps, _prevState: ServiceDetailsState) {
    if (
      prevProps.match.params.namespace !== this.props.match.params.namespace ||
      prevProps.match.params.service !== this.props.match.params.service ||
      this.state.currentTab !== activeTab(tabName, defaultTab) ||
      prevProps.duration !== this.props.duration
    ) {
      this.setState(
        {
          serviceDetailsInfo: emptyService,
          trafficData: null,
          currentTab: activeTab(tabName, defaultTab),
          validations: {}
        },
        () => this.doRefresh()
      );
    }
  }

  fetchTrafficDataOnTabChange = (tabValue: string): void => {
    if (tabValue === trafficTabName && this.state.trafficData == null) {
      this.fetchTrafficData();
    }
  };

  doRefresh = () => {
    const currentTab = this.state.currentTab;

    if (this.state.serviceDetailsInfo === emptyService || currentTab === 'info') {
      this.setState({ trafficData: null });
      this.fetchBackend();
    }

    if (currentTab === trafficTabName) {
      this.fetchTrafficData();
    }
  };

  fetchBackend = () => {
    this.promises.cancelAll();
    this.promises
      .register('namespaces', API.getNamespaces())
      .then(namespacesResponse => {
        const namespaces: Namespace[] = namespacesResponse.data;
        this.promises
          .registerAll('gateways', namespaces.map(ns => API.getIstioConfig(ns.name, ['gateways'], false)))
          .then(responses => {
            let gatewayList: string[] = [];
            responses.forEach(response => {
              const ns = response.data.namespace;
              response.data.gateways.forEach(gw => {
                gatewayList = gatewayList.concat(ns.name + '/' + gw.metadata.name);
              });
            });
            this.setState({
              gateways: gatewayList
            });
          })
          .catch(gwError => {
            MessageCenter.addError('Could not fetch Namespaces list.', gwError);
          });
      })
      .catch(error => {
        MessageCenter.addError('Could not fetch Namespaces list.', error);
      });

    API.getServiceDetail(this.props.match.params.namespace, this.props.match.params.service, true, this.props.duration)
      .then(results => {
        this.setState({
          serviceDetailsInfo: results,
          validations: this.addFormatValidation(results, results.validations)
        });
        if (results.errorTraces === -1 && this.props.jaegerUrl !== '') {
          MessageCenter.add(
            'Could not fetch Traces in the service ' +
              this.props.match.params.service +
              ' in namespace ' +
              this.props.match.params.namespace +
              '. Check if ' +
              this.props.jaegerUrl +
              ' is available.'
          );
        }
      })
      .catch(error => {
        MessageCenter.addError('Could not fetch Service Details.', error);
      });

    API.getThreeScaleInfo()
      .then(results => {
        this.setState({
          threeScaleInfo: results.data
        });
        if (results.data.enabled) {
          API.getThreeScaleServiceRule(this.props.match.params.namespace, this.props.match.params.service)
            .then(result => {
              this.setState({
                threeScaleServiceRule: result.data
              });
            })
            .catch(error => {
              this.setState({
                threeScaleServiceRule: undefined
              });
              // Only log 500 errors. 404 response is a valid response on this composition case
              if (error.response && error.response.status >= 500) {
                MessageCenter.addError('Could not fetch ThreeScaleServiceRule.', error);
              }
            });
        }
      })
      .catch(error => {
        MessageCenter.addError(
          'Could not fetch 3scale info. Turning off 3scale integration.',
          error,
          'default',
          MessageType.INFO
        );
      });
  };

  fetchTrafficData = () => {
    const node: NodeParamsType = {
      service: this.props.match.params.service,
      namespace: { name: this.props.match.params.namespace },
      nodeType: NodeType.SERVICE,

      // unneeded
      workload: '',
      app: '',
      version: ''
    };
    const restParams = {
      duration: `${MetricsDuration.initialDuration()}s`,
      graphType: GraphType.WORKLOAD,
      injectServiceNodes: true,
      appenders: 'deadNode'
    };

    fetchTrafficDetails(node, restParams).then(trafficData => {
      if (trafficData !== undefined) {
        this.setState({ trafficData: trafficData });
      }
    });
  };

  addFormatValidation(details: ServiceDetailsInfo, validations: Validations): Validations {
    details.destinationRules.items.forEach((destinationRule, _index, _ary) => {
      const dr = new DestinationRuleValidator(destinationRule);
      const formatValidation = dr.formatValidation();

      if (validations.destinationrule) {
        const objectValidations = validations.destinationrule[destinationRule.metadata.name];
        if (
          formatValidation !== null &&
          objectValidations.checks &&
          !objectValidations.checks.some(check => check.message === formatValidation.message)
        ) {
          objectValidations.checks.push(formatValidation);
          objectValidations.valid = false;
        }
      }
    });
    return validations ? validations : ({} as Validations);
  }

  renderActions() {
    const serviceDetails = this.state.serviceDetailsInfo;
    const workloads = serviceDetails.workloads || [];
    const virtualServices = serviceDetails.virtualServices || [];
    const destinationRules = serviceDetails.destinationRules || [];
    return (
      <span style={{ position: 'absolute', right: '50px', zIndex: 1 }}>
        <DurationDropdownContainer id="service-info-duration-dropdown" />
        <RefreshButtonContainer handleRefresh={this.doRefresh} />
        &nbsp;
        <IstioWizardDropdown
          namespace={this.props.match.params.namespace}
          serviceName={serviceDetails.service.name}
          show={false}
          workloads={workloads}
          virtualServices={virtualServices}
          destinationRules={destinationRules}
          gateways={this.state.gateways}
          tlsStatus={serviceDetails.namespaceMTLS}
          onChange={this.doRefresh}
          threeScaleInfo={this.state.threeScaleInfo}
          threeScaleServiceRule={this.state.threeScaleServiceRule}
        />
      </span>
    );
  }

  render() {
    const currentTab = this.state.currentTab;
    const errorTraces = this.state.serviceDetailsInfo.errorTraces;
    const overviewTab = (
      <Tab eventKey={0} title="Overview" key="Overview">
        {currentTab === 'info' && (
          <ServiceInfo
            namespace={this.props.match.params.namespace}
            service={this.props.match.params.service}
            serviceDetails={this.state.serviceDetailsInfo}
            gateways={this.state.gateways}
            validations={this.state.validations}
            onRefresh={this.doRefresh}
            threeScaleInfo={this.state.threeScaleInfo}
            threeScaleServiceRule={this.state.threeScaleServiceRule}
          />
        )}
      </Tab>
    );
    const trafficTab = (
      <Tab eventKey={1} title="Traffic" key="Traffic">
        {currentTab === 'traffic' && (
          <TrafficDetails
            trafficData={this.state.trafficData}
            itemType={MetricsObjectTypes.SERVICE}
            namespace={this.props.match.params.namespace}
            serviceName={this.props.match.params.service}
            onDurationChanged={this.fetchTrafficData}
            onRefresh={this.doRefresh}
          />
        )}
      </Tab>
    );
    const inboundMetricsTab = (
      <Tab eventKey={2} title="Inbound Metrics" key="Inbound Metrics">
        {currentTab === 'metrics' && (
          <IstioMetricsContainer
            namespace={this.props.match.params.namespace}
            object={this.props.match.params.service}
            objectType={MetricsObjectTypes.SERVICE}
            direction={'inbound'}
          />
        )}
      </Tab>
    );

    // Default tabs
    const tabsArray: any[] = [overviewTab, trafficTab, inboundMetricsTab];

    // Conditional Traces tab
    if (errorTraces !== undefined && this.props.jaegerUrl !== '') {
      let jaegerTag: any = undefined;
      if (this.props.jaegerIntegration) {
        const jaegerTitle: string = errorTraces > 0 ? 'Error Traces (' + errorTraces + ')' : 'Traces';
        jaegerTag = (
          <Tab eventKey={3} style={{ textAlign: 'center' }} title={jaegerTitle} key="traces">
            {currentTab === 'traces' && (
              <ServiceTraces
                namespace={this.props.match.params.namespace}
                service={this.props.match.params.service}
                errorTags={errorTraces ? errorTraces > -1 : false}
              />
            )}
          </Tab>
        );
      } else {
        const jaegerTitle: any = (
          <>
            Traces <Icon type={'fa'} name={'external-link'} />
          </>
        );
        jaegerTag = (
          <Tab
            eventKey={3}
            href={
              this.props.jaegerUrl +
              `/search?service=${this.props.match.params.service}.${this.props.match.params.namespace}`
            }
            target="_blank"
            title={jaegerTitle}
          />
        );
      }
      tabsArray.push(jaegerTag);
    }

    if (this.state.serviceDetailsInfo.apiDocumentation && this.state.serviceDetailsInfo.apiDocumentation.hasSpec) {
      const docTabIndex = tabsArray.length;
      const docTab: any = (
        <Tab eventKey={docTabIndex} title={'API Doc'} key="API Doc">
          <ApiDocumentation
            apiType={this.state.serviceDetailsInfo.apiDocumentation.type}
            namespace={this.props.match.params.namespace}
            service={this.props.match.params.service}
          />
        </Tab>
      );
      tabsArray.push(docTab);
    }

    return (
      <>
        <BreadcrumbView location={this.props.location} />
        <PfTitle location={this.props.location} istio={this.state.serviceDetailsInfo.istioSidecar} />
        {this.state.currentTab === 'info' && this.renderActions()}
        <ParameterizedTabs
          id="basic-tabs"
          onSelect={tabValue => {
            this.setState({ currentTab: tabValue });
          }}
          tabMap={tabIndex}
          tabName={tabName}
          defaultTab={defaultTab}
          postHandler={this.fetchTrafficDataOnTabChange}
          activeTab={this.state.currentTab}
        >
          {tabsArray}
        </ParameterizedTabs>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  jaegerUrl: state.jaegerState ? state.jaegerState.jaegerURL : '',
  jaegerIntegration: state.jaegerState ? state.jaegerState.enableIntegration : false
});

const ServiceDetailsPageContainer = connect(mapStateToProps)(ServiceDetails);
export default ServiceDetailsPageContainer;
