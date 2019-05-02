import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { Nav, NavItem, TabContainer, TabContent, TabPane, Icon } from 'patternfly-react';
import ServiceId from '../../types/ServiceId';
import * as API from '../../services/Api';
import * as MessageCenter from '../../utils/MessageCenter';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { ObjectValidation, Validations } from '../../types/IstioObjects';
import ServiceMetricsContainer from '../../containers/ServiceMetricsContainer';
import ServiceTraces from './ServiceTraces';
import ServiceInfo from './ServiceInfo';
import { GraphDefinition, GraphType, NodeParamsType, NodeType } from '../../types/Graph';
import { MetricsObjectTypes } from '../../types/Metrics';
import { default as DestinationRuleValidator } from './ServiceInfo/types/DestinationRuleValidator';
import BreadcrumbView from '../../components/BreadcrumbView/BreadcrumbView';
import MetricsDuration from '../../components/MetricsOptions/MetricsDuration';
import { fetchTrafficDetails } from '../../helpers/TrafficDetailsHelper';
import TrafficDetails from '../../components/Metrics/TrafficDetails';

type ServiceDetailsState = {
  serviceDetailsInfo: ServiceDetailsInfo;
  trafficData: GraphDefinition | null;
  validations: Validations;
};

interface ServiceDetailsProps extends RouteComponentProps<ServiceId> {
  jaegerUrl: string;
  jaegerIntegration: boolean;
}

interface ParsedSearch {
  type?: string;
  name?: string;
}

const emptyService = {
  istioSidecar: false,
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
  constructor(props: ServiceDetailsProps) {
    super(props);
    this.state = {
      serviceDetailsInfo: emptyService,
      trafficData: null,
      validations: {}
    };
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

  componentDidUpdate(prevProps: RouteComponentProps<ServiceId>, prevState: ServiceDetailsState) {
    if (
      prevProps.match.params.namespace !== this.props.match.params.namespace ||
      prevProps.match.params.service !== this.props.match.params.service
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
    const promiseDetails = API.getServiceDetail(
      this.props.match.params.namespace,
      this.props.match.params.service,
      true
    );
    promiseDetails
      .then(resultDetails => {
        this.setState({
          serviceDetailsInfo: resultDetails,
          validations: this.addFormatValidation(resultDetails, resultDetails.validations)
        });
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not fetch Service Details', error));
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
    details.destinationRules.items.forEach((destinationRule, index, ary) => {
      const dr = new DestinationRuleValidator(destinationRule);
      const formatValidation = dr.formatValidation();

      if (validations.destinationrule) {
        const objectValidations = validations.destinationrule[destinationRule.metadata.name];
        if (
          formatValidation !== null &&
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
        <TabContainer
          id="basic-tabs"
          activeKey={this.activeTab('tab', 'info')}
          onSelect={this.tabSelectHandler('tab', this.tabChangeHandler)}
        >
          <div>
            <Nav bsClass="nav nav-tabs nav-tabs-pf">
              <NavItem eventKey="info">
                <div>Info</div>
              </NavItem>
              <NavItem eventKey="traffic">
                <div>Traffic</div>
              </NavItem>
              <NavItem eventKey="metrics">
                <div>Inbound Metrics</div>
              </NavItem>
              {errorTraces !== undefined &&
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
              <TabPane eventKey="info">
                <ServiceInfo
                  namespace={this.props.match.params.namespace}
                  service={this.props.match.params.service}
                  serviceDetails={this.state.serviceDetailsInfo}
                  validations={this.state.validations}
                  onRefresh={this.doRefresh}
                  activeTab={this.activeTab}
                  onSelectTab={this.tabSelectHandler}
                />
              </TabPane>
              <TabPane eventKey="traffic">
                <TrafficDetails
                  duration={MetricsDuration.initialDuration()}
                  trafficData={this.state.trafficData}
                  itemType={MetricsObjectTypes.SERVICE}
                  namespace={this.props.match.params.namespace}
                  serviceName={this.props.match.params.service}
                  onDurationChanged={this.handleTrafficDurationChange}
                  onRefresh={this.doRefresh}
                />
              </TabPane>
              <TabPane eventKey="metrics" mountOnEnter={true} unmountOnExit={true}>
                <ServiceMetricsContainer
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

export default ServiceDetails;
