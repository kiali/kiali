import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { Tab } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import ServiceId from '../../types/ServiceId';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { Validations } from '../../types/IstioObjects';
import IstioMetricsContainer from '../../components/Metrics/IstioMetrics';
import { RenderHeader } from '../../components/Nav/Page';
import ServiceTraces from './ServiceTraces';
import ServiceInfo from './ServiceInfo';
import { EdgeLabelMode, GraphDefinition, GraphType, NodeType } from '../../types/Graph';
import { MetricsObjectTypes } from '../../types/Metrics';
import { default as DestinationRuleValidator } from './ServiceInfo/types/DestinationRuleValidator';
import { fetchTrace, fetchTraces } from '../../helpers/TracesHelper';
import TrafficDetails from '../../components/Metrics/TrafficDetails';
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
import { JaegerErrors, JaegerTrace, JaegerInfo } from '../../types/JaegerInfo';
import { getQueryJaeger } from '../../components/JaegerIntegration/RouteHelper';
import RefreshContainer from '../../components/Refresh/Refresh';
import { PfColors } from '../../components/Pf/PfColors';
import TimeRangeComponent from 'components/Time/TimeRangeComponent';
import { serverConfig } from '../../config';
import GraphDataSource from '../../services/GraphDataSource';

type ServiceDetailsState = {
  serviceDetailsInfo: ServiceDetailsInfo;
  nbErrorTraces: number;
  gateways: string[];
  trafficData: GraphDefinition | null;
  validations: Validations;
  threeScaleInfo: ThreeScaleInfo;
  threeScaleServiceRule?: ThreeScaleServiceRule;
  currentTab: string;
  traces: JaegerTrace[];
  errorTraces?: JaegerErrors[];
  selectedTrace?: JaegerTrace;
  errorSelectedTrace?: JaegerErrors[];
};

interface ServiceDetailsProps extends RouteComponentProps<ServiceId> {
  duration: DurationInSeconds;
  jaegerInfo?: JaegerInfo;
}

interface ParsedSearch {
  type?: string;
  name?: string;
}

const emptyService: ServiceDetailsInfo = {
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
  additionalDetails: []
};

const tabName = 'tab';
const defaultTab = 'info';
const trafficTabName = 'traffic';
const tracesTabName = 'traces';

const tabIndex: { [tab: string]: number } = {
  info: 0,
  traffic: 1,
  metrics: 2,
  traces: 3
};

class ServiceDetails extends React.Component<ServiceDetailsProps, ServiceDetailsState> {
  private promises = new PromisesRegistry();
  private lastFetchTracesError = false;
  private graphDataSource: GraphDataSource;

  constructor(props: ServiceDetailsProps) {
    super(props);
    this.state = {
      currentTab: activeTab(tabName, defaultTab),
      serviceDetailsInfo: emptyService,
      nbErrorTraces: 0,
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
      },
      traces: []
    };

    this.graphDataSource = new GraphDataSource();
  }

  componentWillUnmount() {
    this.promises.cancelAll();

    this.graphDataSource.removeListener('fetchSuccess', this.graphDsFetchSuccess);
    this.graphDataSource.removeListener('fetchError', this.graphDsFetchError);
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

    this.graphDataSource.on('fetchSuccess', this.graphDsFetchSuccess);
    this.graphDataSource.on('fetchError', this.graphDsFetchError);
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
    if (tabValue === defaultTab && this.state.serviceDetailsInfo === emptyService) {
      this.fetchBackend();
    }
  };

  doRefresh = () => {
    const currentTab = this.state.currentTab;

    if (currentTab === defaultTab) {
      this.setState({ trafficData: null });
      this.fetchBackend();
      this.loadMiniGraphData();
    }

    if (currentTab === trafficTabName) {
      // Since traffic tab shares data with mini-graph, we reload mini-graph data.
      this.loadMiniGraphData();
    }

    if (currentTab === tracesTabName) {
      this.fetchTracesData();
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
            AlertUtils.addError('Could not fetch Namespaces list.', gwError);
          });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch Namespaces list.', error);
      });

    API.getServiceDetail(this.props.match.params.namespace, this.props.match.params.service, true, this.props.duration)
      .then(results => {
        this.setState({
          serviceDetailsInfo: results,
          validations: this.addFormatValidation(results, results.validations)
        });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch Service Details.', error);
      });

    if (this.props.jaegerInfo && this.props.jaegerInfo.integration) {
      API.getJaegerErrorTraces(this.props.match.params.namespace, this.props.match.params.service, this.props.duration)
        .then(inError => {
          this.setState({ nbErrorTraces: inError.data });
        })
        .catch(error => {
          AlertUtils.addError('Could not fetch Jaeger errors.', error);
        });
    }

    if (serverConfig.extensions!.threescale!.enabled) {
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
                  AlertUtils.addError('Could not fetch ThreeScaleServiceRule.', error);
                }
              });
          }
        })
        .catch(error => {
          AlertUtils.addError(
            'Could not fetch 3scale info. Turning off 3scale integration.',
            error,
            'default',
            MessageType.INFO
          );
        });
    }
  };

  fetchTracesData = (cleanTrace: boolean = false, traceId?: string) => {
    if (cleanTrace) {
      this.setState({ selectedTrace: undefined });
    }
    if (traceId) {
      fetchTrace(this.props.match.params.namespace, this.props.match.params.service, traceId)
        .then(trace => {
          this.lastFetchTracesError = false;
          let myState = {};
          if (trace && trace.data) {
            myState['selectedTrace'] = trace.data[0];
          }
          myState['errorSelectedTrace'] = trace ? trace.errors : [{ msg: 'Error Getting Trace ' + traceId }];
          this.setState(myState);
        })
        .catch(error => {
          if (!this.lastFetchTracesError) {
            AlertUtils.addError('Could not fetch traces.', error);
            this.lastFetchTracesError = true;
            throw error;
          }
        });
    } else {
      fetchTraces(this.props.match.params.namespace, this.props.match.params.service, getQueryJaeger())
        .then(traces => {
          this.lastFetchTracesError = false;
          let myState = {};
          if (traces && traces.data) {
            myState['traces'] = traces.data;
            if (traces.data.length === 0) {
              myState['selectedTrace'] = undefined;
            }
          }
          myState['errorTraces'] = traces
            ? traces.errors
            : [
                {
                  msg:
                    'Error Getting Traces of service ' +
                    this.props.match.params.service +
                    ' in namespace ' +
                    this.props.match.params.namespace
                }
              ];
          this.setState(myState);
        })
        .catch(error => {
          if (!this.lastFetchTracesError) {
            AlertUtils.addError('Could not fetch traces.', error);
            this.lastFetchTracesError = true;
            throw error;
          }
        });
    }
  };

  addFormatValidation(details: ServiceDetailsInfo, validations: Validations): Validations {
    details.destinationRules.items.forEach(destinationRule => {
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
    return validations ? validations : {};
  }

  renderActions() {
    let component;
    switch (this.state.currentTab) {
      case defaultTab:
        component = <DurationDropdownContainer id="service-info-duration-dropdown" />;
        break;
      case trafficTabName:
        component = <DurationDropdownContainer id="service-traffic-duration-dropdown" />;
        break;
      case tracesTabName:
        component = (
          <TimeRangeComponent
            onChanged={() => this.fetchTracesData()}
            allowCustom={false}
            tooltip={'Time range for traces'}
          />
        );
        break;
      default:
        return undefined;
    }
    const serviceDetails = this.state.serviceDetailsInfo;
    const workloads = serviceDetails.workloads || [];
    const virtualServices = serviceDetails.virtualServices || [];
    const destinationRules = serviceDetails.destinationRules || [];
    return (
      <span style={{ position: 'absolute', right: '50px', zIndex: 1 }}>
        {component}
        {this.state.currentTab !== tracesTabName ? (
          <RefreshButtonContainer handleRefresh={this.doRefresh} />
        ) : (
          <RefreshContainer id="metrics-refresh" handleRefresh={this.doRefresh} hideLabel={true} />
        )}
        {this.state.currentTab === defaultTab && (
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
        )}
      </span>
    );
  }

  render() {
    const overviewTab = (
      <Tab eventKey={0} title="Overview" key="Overview">
        <ServiceInfo
          namespace={this.props.match.params.namespace}
          service={this.props.match.params.service}
          serviceDetails={this.state.serviceDetailsInfo}
          gateways={this.state.gateways}
          validations={this.state.validations}
          onRefresh={this.doRefresh}
          threeScaleInfo={this.state.threeScaleInfo}
          threeScaleServiceRule={this.state.threeScaleServiceRule}
          miniGraphDataSource={this.graphDataSource}
        />
      </Tab>
    );
    const trafficTab = (
      <Tab eventKey={1} title="Traffic" key="Traffic">
        <TrafficDetails
          trafficData={this.state.trafficData}
          itemType={MetricsObjectTypes.SERVICE}
          namespace={this.props.match.params.namespace}
          serviceName={this.props.match.params.service}
        />
      </Tab>
    );
    const inboundMetricsTab = (
      <Tab eventKey={2} title="Inbound Metrics" key="Inbound Metrics">
        <IstioMetricsContainer
          namespace={this.props.match.params.namespace}
          object={this.props.match.params.service}
          objectType={MetricsObjectTypes.SERVICE}
          direction={'inbound'}
        />
      </Tab>
    );

    // Default tabs
    const tabsArray: any[] = [overviewTab, trafficTab, inboundMetricsTab];

    // Conditional Traces tab
    if (this.props.jaegerInfo && this.props.jaegerInfo.enabled) {
      let jaegerTag: any = undefined;
      if (this.props.jaegerInfo.integration) {
        const jaegerTitle =
          this.state.nbErrorTraces > 0 ? (
            <>
              Traces <ExclamationCircleIcon color={PfColors.Red200} />{' '}
            </>
          ) : (
            'Traces'
          );
        jaegerTag = (
          <Tab eventKey={3} style={{ textAlign: 'center' }} title={jaegerTitle} key="traces">
            <ServiceTraces
              namespace={this.props.match.params.namespace}
              service={this.props.match.params.service}
              errorTags={this.state.nbErrorTraces > 0}
              duration={this.props.duration}
              traces={this.state.traces}
              errorTraces={this.state.errorTraces}
              selectedTrace={this.state.selectedTrace}
              selectedErrorTrace={this.state.errorSelectedTrace}
              onRefresh={this.fetchTracesData}
            />
          </Tab>
        );
      } else {
        const jaegerTitle: any = (
          <>
            Traces <ExternalLinkAltIcon />
          </>
        );
        const service = this.props.jaegerInfo.namespaceSelector
          ? this.props.match.params.service + '.' + this.props.match.params.namespace
          : this.props.match.params.service;
        jaegerTag = (
          <Tab
            eventKey={3}
            href={this.props.jaegerInfo.url + `/search?service=${service}`}
            target="_blank"
            title={jaegerTitle}
          />
        );
      }
      tabsArray.push(jaegerTag);
    }

    return (
      <>
        <RenderHeader location={this.props.location}>
          <PfTitle location={this.props.location} istio={this.state.serviceDetailsInfo.istioSidecar} />
          {this.renderActions()}
        </RenderHeader>
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
          mountOnEnter={false}
          unmountOnExit={true}
        >
          {tabsArray}
        </ParameterizedTabs>
      </>
    );
  }

  private loadMiniGraphData = () => {
    this.graphDataSource.fetchGraphData({
      namespaces: [{ name: this.props.match.params.namespace }],
      duration: this.props.duration,
      graphType: GraphType.WORKLOAD,
      injectServiceNodes: true,
      edgeLabelMode: EdgeLabelMode.NONE,
      showSecurity: false,
      showUnusedNodes: false,
      node: {
        app: '',
        namespace: { name: this.props.match.params.namespace },
        nodeType: NodeType.SERVICE,
        service: this.props.match.params.service,
        version: '',
        workload: ''
      }
    });
  };

  private graphDsFetchSuccess = () => {
    this.setState({
      trafficData: this.graphDataSource.graphDefinition
    });
  };

  private graphDsFetchError = (errorMessage: string | null) => {
    if (this.state.currentTab === trafficTabName) {
      if (errorMessage !== '') {
        errorMessage = 'Could not fetch traffic data: ' + errorMessage;
      } else {
        errorMessage = 'Could not fetch traffic data.';
      }

      AlertUtils.addError(errorMessage);
    }
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  jaegerInfo: state.jaegerState || undefined
});

const ServiceDetailsPageContainer = connect(mapStateToProps)(ServiceDetails);
export default ServiceDetailsPageContainer;
