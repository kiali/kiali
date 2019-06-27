import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import { Nav, NavItem, TabContainer, TabContent, TabPane, Icon } from 'patternfly-react';
import ServiceId from '../../types/ServiceId';
import * as API from '../../services/Api';
import * as MessageCenter from '../../utils/MessageCenter';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { ObjectValidation, Validations } from '../../types/IstioObjects';
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

import { ThreeScaleInfo, ThreeScaleServiceRule } from '../../types/ThreeScale';
import { KialiAppState } from '../../store/Store';
import PfTitle from '../../components/Pf/PfTitle';
import { DurationInSeconds } from '../../types/Common';
import { durationSelector } from '../../store/Selectors';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import Namespace from '../../types/Namespace';
import { MessageType } from '../../types/MessageCenter';

type ServiceDetailsState = {
  serviceDetailsInfo: ServiceDetailsInfo;
  gateways: string[];
  trafficData: GraphDefinition | null;
  validations: Validations;
  threeScaleInfo: ThreeScaleInfo;
  threeScaleServiceRule?: ThreeScaleServiceRule;
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
  validations: {}
};

class ServiceDetails extends React.Component<ServiceDetailsProps, ServiceDetailsState> {
  private promises = new PromisesRegistry();

  constructor(props: ServiceDetailsProps) {
    super(props);
    this.state = {
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

  searchValidation(parsedSearch: ParsedSearch) {
    let vals;

    if (
      this.state.serviceDetailsInfo.validations &&
      parsedSearch.type &&
      parsedSearch.name &&
      this.state.serviceDetailsInfo.validations[parsedSearch.type] &&
      this.state.serviceDetailsInfo.validations[parsedSearch.type][parsedSearch.name]
    ) {
      vals = this.state.serviceDetailsInfo.validations[parsedSearch.type][parsedSearch.name];
    } else {
      vals = {} as ObjectValidation;
    }

    return vals;
  }

  componentDidMount() {
    this.doRefresh();
  }

  componentDidUpdate(prevProps: ServiceDetailsProps, _prevState: ServiceDetailsState) {
    if (
      prevProps.match.params.namespace !== this.props.match.params.namespace ||
      prevProps.match.params.service !== this.props.match.params.service ||
      prevProps.duration !== this.props.duration
    ) {
      this.setState(
        {
          serviceDetailsInfo: emptyService,
          trafficData: null,
          validations: {}
        },
        () => this.doRefresh()
      );
    }
  }

  doRefresh = () => {
    const currentTab = this.activeTab('tab', 'info');

    if (this.state.serviceDetailsInfo === emptyService || currentTab === 'info') {
      this.setState({ trafficData: null });
      this.fetchBackend();
    }

    if (currentTab === 'traffic') {
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
            MessageCenter.add(API.getErrorMsg('Could not fetch Namespaces list', gwError));
          });
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not fetch Namespaces list', error));
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
        MessageCenter.add(API.getErrorMsg('Could not fetch Service Details', error));
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
                MessageCenter.add(API.getErrorMsg('Could not fetch ThreeScaleServiceRule', error));
              }
            });
        }
      })
      .catch(error => {
        MessageCenter.add(
          API.getInfoMsg('Could not fetch 3scale info. Turning off 3scale integration.', error),
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

  navigateToJaeger = () => {
    window.open(
      this.props.jaegerUrl + `/search?service=${this.props.match.params.service}.${this.props.match.params.namespace}`,
      '_blank'
    );
  };

  render() {
    const errorTraces = this.state.serviceDetailsInfo.errorTraces;
    return (
      <>
        <BreadcrumbView location={this.props.location} />
        <PfTitle location={this.props.location} istio={this.state.serviceDetailsInfo.istioSidecar} />
        <TabContainer
          id="basic-tabs"
          activeKey={this.activeTab('tab', 'info')}
          onSelect={this.tabSelectHandler('tab', this.tabChangeHandler)}
        >
          <div>
            <Nav bsClass="nav nav-tabs nav-tabs-pf">
              <NavItem eventKey="info">Overview</NavItem>
              <NavItem eventKey="traffic">Traffic</NavItem>
              <NavItem eventKey="metrics">Inbound Metrics</NavItem>
              {errorTraces !== undefined &&
                this.props.jaegerUrl !== '' &&
                (this.props.jaegerIntegration ? (
                  <NavItem eventKey="traces">
                    {errorTraces > 0 ? (
                      <>
                        Error Traces{' '}
                        <span>
                          ({errorTraces}
                          {errorTraces > 0 && (
                            <Icon type={'fa'} name={'exclamation-circle'} style={{ color: 'red', marginLeft: '2px' }} />
                          )}
                          )
                        </span>
                      </>
                    ) : (
                      'Traces'
                    )}
                  </NavItem>
                ) : (
                  <NavItem onClick={this.navigateToJaeger}>
                    <>
                      Traces <Icon type={'fa'} name={'external-link'} />
                    </>
                  </NavItem>
                ))}
            </Nav>
            <TabContent>
              <TabPane eventKey="info" mountOnEnter={true} unmountOnExit={true}>
                <ServiceInfo
                  namespace={this.props.match.params.namespace}
                  service={this.props.match.params.service}
                  serviceDetails={this.state.serviceDetailsInfo}
                  gateways={this.state.gateways}
                  validations={this.state.validations}
                  onRefresh={this.doRefresh}
                  activeTab={this.activeTab}
                  onSelectTab={this.tabSelectHandler}
                  threeScaleInfo={this.state.threeScaleInfo}
                  threeScaleServiceRule={this.state.threeScaleServiceRule}
                />
              </TabPane>
              <TabPane eventKey="traffic" mountOnEnter={true} unmountOnExit={true}>
                <TrafficDetails
                  trafficData={this.state.trafficData}
                  itemType={MetricsObjectTypes.SERVICE}
                  namespace={this.props.match.params.namespace}
                  serviceName={this.props.match.params.service}
                  onDurationChanged={this.handleTrafficDurationChange}
                  onRefresh={this.doRefresh}
                />
              </TabPane>
              <TabPane eventKey="metrics" mountOnEnter={true} unmountOnExit={true}>
                <IstioMetricsContainer
                  namespace={this.props.match.params.namespace}
                  object={this.props.match.params.service}
                  objectType={MetricsObjectTypes.SERVICE}
                  direction={'inbound'}
                />
              </TabPane>
              {this.props.jaegerIntegration && (
                <TabPane eventKey="traces" mountOnEnter={true} unmountOnExit={true}>
                  <ServiceTraces
                    namespace={this.props.match.params.namespace}
                    service={this.props.match.params.service}
                    errorTags={errorTraces ? errorTraces > -1 : false}
                  />
                </TabPane>
              )}
            </TabContent>
          </div>
        </TabContainer>
      </>
    );
  }

  private activeTab = (tabName: string, whenEmpty: string) => {
    return new URLSearchParams(this.props.location.search).get(tabName) || whenEmpty;
  };

  private handleTrafficDurationChange = () => {
    this.fetchTrafficData();
  };

  private tabChangeHandler = (tabName: string) => {
    if (tabName === 'traffic' && this.state.trafficData === null) {
      this.fetchTrafficData();
    }
  };

  private tabSelectHandler = (tabName: string, postHandler?: (tabName: string) => void) => {
    return (tabKey?: string) => {
      if (!tabKey) {
        return;
      }

      const urlParams = new URLSearchParams('');
      const parsedSearch = this.parseSearch();
      if (parsedSearch.type && parsedSearch.name) {
        urlParams.set(parsedSearch.type, parsedSearch.name);
      }
      urlParams.set(tabName, tabKey);

      this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());

      if (postHandler) {
        postHandler(tabKey);
      }
    };
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  jaegerUrl: state.jaegerState ? state.jaegerState.jaegerURL : '',
  jaegerIntegration: state.jaegerState ? state.jaegerState.enableIntegration : false
});

const ServiceDetailsPageContainer = connect(mapStateToProps)(ServiceDetails);
export default ServiceDetailsPageContainer;
