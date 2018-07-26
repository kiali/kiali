import * as React from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { Breadcrumb, Nav, NavItem, TabContainer, TabContent, TabPane } from 'patternfly-react';
import ServiceId from '../../types/ServiceId';
import { NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { ActiveFilter } from '../../types/NamespaceFilter';
import * as API from '../../services/Api';
import * as MessageCenter from '../../utils/MessageCenter';
import { hasIstioSidecar, ServiceDetailsInfo, Validations } from '../../types/ServiceInfo';
import { authentication } from '../../utils/Authentication';
import IstioObjectDetails from './IstioObjectDetails';
import ServiceMetrics from './ServiceMetrics';
import ServiceInfo from './ServiceInfo';

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
        type: '',
        name: '',
        createdAt: '',
        istioSidecar: false,
        resourceVersion: '',
        ip: ''
      }
    };
  }

  servicePageURL() {
    return '/namespaces/' + this.props.match.params.namespace + '/services/' + this.props.match.params.service;
  }

  cleanFilter = () => {
    NamespaceFilterSelected.setSelected([]);
  };

  updateFilter = () => {
    const activeFilter: ActiveFilter = {
      label: 'Namespace: ' + this.props.match.params.namespace,
      category: 'Namespace',
      value: this.props.match.params.namespace.toString()
    };
    NamespaceFilterSelected.setSelected([activeFilter]);
  };

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
        const details = resultDetails.data;
        details.istioSidecar = hasIstioSidecar(details.pods);
        this.setState({
          serviceDetailsInfo: details,
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
    const toDetails = to + '?' + parsedSearch.type + '=' + parsedSearch.name;
    return (
      <Breadcrumb title={true}>
        <Breadcrumb.Item>
          <Link to="/services" onClick={this.cleanFilter}>
            Services
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to="/services" onClick={this.updateFilter}>
            Namespace: {this.props.match.params.namespace}
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to={to}>Service: {this.props.match.params.service}</Link>
        </Breadcrumb.Item>
        {!showingDetails ? (
          <Breadcrumb.Item active={true}>
            Service {(urlParams.get('tab') || 'info') === 'info' ? 'Info' : 'Metrics'}
          </Breadcrumb.Item>
        ) : (
          <>
            <Breadcrumb.Item>
              <Link to={to}>Service Info</Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item>
              <Link to={toDetails}>
                {parsedSearchTypeHuman}: {parsedSearch.name}
              </Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item active={true}>
              {parsedSearchTypeHuman} {(urlParams.get('detail') || 'overview') === 'overview' ? 'Overview' : 'YAML'}
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
            servicePageURL={this.servicePageURL()}
          />
        ) : (
          <TabContainer id="basic-tabs" activeKey={this.activeTab('tab', 'info')} onSelect={this.mainTabSelectHandler}>
            <div>
              <Nav bsClass="nav nav-tabs nav-tabs-pf">
                <NavItem eventKey="info">
                  <div>Info</div>
                </NavItem>
                <NavItem eventKey="metrics">
                  <div>Metrics</div>
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
                  />
                </TabPane>
                <TabPane eventKey="metrics" mountOnEnter={true} unmountOnExit={true}>
                  <ServiceMetrics
                    namespace={this.props.match.params.namespace}
                    service={this.props.match.params.service}
                  />
                </TabPane>
              </TabContent>
            </div>
          </TabContainer>
        )}
      </>
    );
  }

  private tabSelectHandler = (tabName: string, tabKey?: string) => {
    if (!tabKey) {
      return;
    }

    const urlParams = new URLSearchParams(this.props.location.search);
    urlParams.set(tabName, tabKey);

    this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
  };

  private mainTabSelectHandler = (tabKey?: string) => {
    this.tabSelectHandler('tab', tabKey);
  };

  private activeTab = (tabName: string, whenEmpty: string): string => {
    return new URLSearchParams(this.props.location.search).get(tabName) || whenEmpty;
  };

  private navigateToJaeger = () => {
    this.props.history.push('/jaeger?path=' + encodeURIComponent(`/search?service=${this.props.match.params.service}`));
  };
}

export default ServiceDetails;
