import * as React from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { Breadcrumb, Nav, NavItem, TabContainer, TabContent, TabPane } from 'patternfly-react';
import ServiceId from '../../types/ServiceId';
import * as API from '../../services/Api';
import * as MessageCenter from '../../utils/MessageCenter';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { Validations } from '../../types/IstioObjects';
import { authentication } from '../../utils/Authentication';
import IstioObjectDetails from './IstioObjectDetails';
import ServiceMetricsContainer from '../../containers/ServiceMetricsContainer';
import ServiceInfo from './ServiceInfo';
import { TargetPage, ListPageLink } from '../../components/ListPage/ListPageLink';
import { MetricsObjectTypes, MetricsDirection } from '../../types/Metrics';

type ServiceDetailsState = {
  serviceDetailsInfo: ServiceDetailsInfo;
  validations: Validations;
};

interface ParsedSearch {
  type?: string;
  name?: string;
}

class ServiceDetails extends React.Component<RouteComponentProps<ServiceId>, ServiceDetailsState> {
  constructor(props: RouteComponentProps<ServiceId>) {
    super(props);
    this.state = {
      validations: {},
      serviceDetailsInfo: {
        istioSidecar: false,
        service: {
          type: '',
          name: '',
          createdAt: '',
          resourceVersion: '',
          ip: ''
        }
      }
    };
  }

  servicePageURL(parsedSearch?: ParsedSearch) {
    let url = '/namespaces/' + this.props.match.params.namespace + '/services/' + this.props.match.params.service;
    if (parsedSearch && parsedSearch.type) {
      url += `?list=${parsedSearch.type}s`;
    }
    return url;
  }

  validateParams(parsed: ParsedSearch): boolean {
    if (!parsed.type || !parsed.name) {
      return false;
    }
    // Check we have the right parameter
    let validateTypes = ['virtualservice', 'destinationrule'];
    if (parsed.type && validateTypes.indexOf(parsed.type) < 0) {
      return false;
    }
    if (parsed.type === 'virtualservice' && this.state.serviceDetailsInfo.virtualServices) {
      for (let i = 0; i < this.state.serviceDetailsInfo.virtualServices.length; i++) {
        if (parsed.name === this.state.serviceDetailsInfo.virtualServices[i].name) {
          return true;
        }
      }
    } else if (parsed.type === 'destinationrule' && this.state.serviceDetailsInfo.destinationRules) {
      for (let i = 0; i < this.state.serviceDetailsInfo.destinationRules.length; i++) {
        if (parsed.name === this.state.serviceDetailsInfo.destinationRules[i].name) {
          return true;
        }
      }
    }
    return false;
  }

  // Helper method to extract search urls with format
  // ?virtualservice=name or ?destinationrule=name
  parseSearch(): ParsedSearch {
    let parsed: ParsedSearch = {};
    if (this.props.location.search) {
      let firstParams = this.props.location.search
        .split('&')[0]
        .replace('?', '')
        .split('=');
      parsed.type = firstParams[0];
      parsed.name = firstParams[1];
    }
    if (this.validateParams(parsed)) {
      return parsed;
    }
    return {};
  }

  searchObject(parsed: ParsedSearch) {
    if (parsed.type === 'virtualservice' && this.state.serviceDetailsInfo.virtualServices) {
      for (let i = 0; i < this.state.serviceDetailsInfo.virtualServices.length; i++) {
        if (parsed.name === this.state.serviceDetailsInfo.virtualServices[i].name) {
          return this.state.serviceDetailsInfo.virtualServices[i];
        }
      }
    } else if (parsed.type === 'destinationrule' && this.state.serviceDetailsInfo.destinationRules) {
      for (let i = 0; i < this.state.serviceDetailsInfo.destinationRules.length; i++) {
        if (parsed.name === this.state.serviceDetailsInfo.destinationRules[i].name) {
          return this.state.serviceDetailsInfo.destinationRules[i];
        }
      }
    }
    return undefined;
  }

  searchValidation(parsedSearch: ParsedSearch) {
    let vals: Validations = {};

    if (
      this.state.validations &&
      parsedSearch.type &&
      parsedSearch.name &&
      this.state.validations[parsedSearch.type] &&
      this.state.validations[parsedSearch.type][parsedSearch.name]
    ) {
      vals[parsedSearch.type] = {};
      vals[parsedSearch.type][parsedSearch.name] = this.state.validations[parsedSearch.type][parsedSearch.name];
    }

    return vals;
  }

  componentDidMount() {
    this.fetchBackend();
  }

  componentDidUpdate(prevProps: RouteComponentProps<ServiceId>, prevState: ServiceDetailsState) {
    if (
      prevProps.match.params.namespace !== this.props.match.params.namespace ||
      prevProps.match.params.service !== this.props.match.params.service
    ) {
      this.fetchBackend();
    }
  }

  fetchBackend = () => {
    let promiseDetails = API.getServiceDetail(
      authentication(),
      this.props.match.params.namespace,
      this.props.match.params.service
    );
    let promiseValidations = API.getServiceValidations(
      authentication(),
      this.props.match.params.namespace,
      this.props.match.params.service
    );
    Promise.all([promiseDetails, promiseValidations])
      .then(([resultDetails, resultValidations]) => {
        this.setState({
          serviceDetailsInfo: resultDetails,
          validations: resultValidations.data
        });
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not fetch Service Details.', error));
      });
  };

  renderBreadcrumbs = (parsedSearch: ParsedSearch, showingDetails: boolean) => {
    const urlParams = new URLSearchParams(this.props.location.search);
    const parsedSearchTypeHuman = parsedSearch.type === 'virtualservice' ? 'Virtual Service' : 'Destination Rule';
    const to = this.servicePageURL();
    const toDetailsTab = to + '?list=' + parsedSearch.type + 's';
    const toDetails = to + '?' + parsedSearch.type + '=' + parsedSearch.name;
    const defaultDetailTab = parsedSearch.type === 'virtualservice' ? 'overview' : 'yaml';
    return (
      <Breadcrumb title={true}>
        <Breadcrumb.Item componentClass={'span'}>
          <ListPageLink target={TargetPage.SERVICES}>Services</ListPageLink>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass={'span'}>
          <ListPageLink target={TargetPage.SERVICES} namespace={this.props.match.params.namespace}>
            Namespace: {this.props.match.params.namespace}
          </ListPageLink>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass={'span'}>
          <Link to={to}>Service: {this.props.match.params.service}</Link>
        </Breadcrumb.Item>
        {!showingDetails ? (
          <Breadcrumb.Item active={true}>
            Service {(urlParams.get('tab') || 'info') === 'info' ? 'Info' : 'Metrics'}
          </Breadcrumb.Item>
        ) : (
          <>
            <Breadcrumb.Item componentClass={'span'}>
              <Link to={toDetailsTab}>Service Info</Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item componentClass={'span'}>
              <Link to={toDetails}>
                {parsedSearchTypeHuman}: {parsedSearch.name}
              </Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item active={true}>
              {parsedSearchTypeHuman}{' '}
              {(urlParams.get('detail') || defaultDetailTab) === 'overview' ? 'Overview' : 'YAML'}
            </Breadcrumb.Item>
          </>
        )}
      </Breadcrumb>
    );
  };

  render() {
    const parsedSearch = this.parseSearch();
    const istioObject = this.searchObject(parsedSearch);
    const editorVisible = parsedSearch.name && parsedSearch.type;
    return (
      <>
        {this.renderBreadcrumbs(parsedSearch, !!(editorVisible && istioObject))}
        {editorVisible && istioObject ? (
          <IstioObjectDetails
            object={istioObject}
            validations={this.searchValidation(parsedSearch)}
            onSelectTab={this.tabSelectHandler}
            activeTab={this.activeTab}
            servicePageURL={this.servicePageURL(parsedSearch)}
          />
        ) : (
          <TabContainer
            id="basic-tabs"
            activeKey={this.activeTab('tab', 'info')}
            onSelect={this.tabSelectHandler('tab')}
          >
            <div>
              <Nav bsClass="nav nav-tabs nav-tabs-pf">
                <NavItem eventKey="info">
                  <div>Info</div>
                </NavItem>
                <NavItem eventKey="metrics">
                  <div>Inbound Metrics</div>
                </NavItem>
                <NavItem onClick={this.navigateToJaeger}>
                  <div>Traces</div>
                </NavItem>
              </Nav>
              <TabContent>
                <TabPane eventKey="info">
                  <ServiceInfo
                    namespace={this.props.match.params.namespace}
                    service={this.props.match.params.service}
                    serviceDetails={this.state.serviceDetailsInfo}
                    validations={this.state.validations}
                    onRefresh={this.fetchBackend}
                    activeTab={this.activeTab}
                    onSelectTab={this.tabSelectHandler}
                  />
                </TabPane>
                <TabPane eventKey="metrics" mountOnEnter={true} unmountOnExit={true}>
                  <ServiceMetricsContainer
                    namespace={this.props.match.params.namespace}
                    object={this.props.match.params.service}
                    objectType={MetricsObjectTypes.SERVICE}
                    direction={MetricsDirection.INBOUND}
                  />
                </TabPane>
              </TabContent>
            </div>
          </TabContainer>
        )}
      </>
    );
  }

  private activeTab = (tabName: string, whenEmpty: string) => {
    return new URLSearchParams(this.props.location.search).get(tabName) || whenEmpty;
  };

  private tabSelectHandler = (tabName: string) => {
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
    };
  };

  private navigateToJaeger = () => {
    API.getJaegerInfo(authentication())
      .then(response => {
        let data = response['data'];
        window.open(data.url + `/search?service=${this.props.match.params.service}`, '_blank');
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not fetch Jaeger info', error));
        console.log(error);
      });
  };
}

export default ServiceDetails;
