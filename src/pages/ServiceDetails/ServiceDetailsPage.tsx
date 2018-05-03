import * as React from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { Col, Row } from 'patternfly-react';
import ServiceInfo from './ServiceInfo';
import ServiceMetrics from './ServiceMetrics';
import ServiceId from '../../types/ServiceId';
import {
  ToastNotification,
  ToastNotificationList,
  Nav,
  NavItem,
  TabContainer,
  TabContent,
  TabPane
} from 'patternfly-react';
import { NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { ActiveFilter } from '../../types/NamespaceFilter';
import * as API from '../../services/Api';
import { hasIstioSidecar, ServiceDetailsInfo } from '../../types/ServiceInfo';
import AceEditor, { AceOptions } from 'react-ace';
import 'brace/mode/yaml';
import 'brace/theme/eclipse';

const yaml = require('js-yaml');

type ServiceDetailsState = {
  jaegerUri: string;
  serviceDetailsInfo: ServiceDetailsInfo;
  error: boolean;
  errorMessage: string;
};

interface ParsedSearch {
  type?: string;
  name?: string;
}

const aceOptions: AceOptions = {
  readOnly: true,
  showPrintMargin: false,
  autoScrollEditorIntoView: true
};

const safeDumpOptions = {
  styles: {
    '!!null': 'canonical' // dump null as ~
  }
};

class ServiceDetails extends React.Component<RouteComponentProps<ServiceId>, ServiceDetailsState> {
  constructor(props: RouteComponentProps<ServiceId>) {
    super(props);
    this.state = {
      jaegerUri: '',
      serviceDetailsInfo: {
        type: '',
        name: '',
        created_at: '',
        istio_sidecar: false,
        resource_version: '',
        ip: ''
      },
      error: false,
      errorMessage: ''
    };
  }

  updateFilter = () => {
    let activeFilter: ActiveFilter = {
      label: 'Namespace: ' + this.props.match.params.namespace,
      category: 'Namespace',
      value: this.props.match.params.namespace.toString()
    };
    NamespaceFilterSelected.setSelected([activeFilter]);
  };

  parseServiceDetailsInfo = data => {
    let parsed: ServiceDetailsInfo = {
      labels: data.labels,
      name: data.name,
      created_at: data.created_at,
      resource_version: data.resource_version,
      type: data.type,
      ports: data.ports,
      endpoints: data.endpoints,
      istio_sidecar: hasIstioSidecar(data.deployments),
      deployments: data.deployments,
      dependencies: data.dependencies,
      routeRules: data.route_rules,
      destinationPolicies: data.destination_policies,
      virtualServices: data.virtual_services,
      destinationRules: data.destination_rules,
      ip: data.ip,
      health: data.health
    };
    return parsed;
  };

  validateParams(parsed: ParsedSearch): boolean {
    if (!parsed.type || !parsed.name) {
      return false;
    }
    // Check we have the right parameter
    let validateTypes = ['routerule', 'destinationpolicy', 'virtualservice', 'destinationrule'];
    if (parsed.type && validateTypes.indexOf(parsed.type) < 0) {
      return false;
    }
    if (parsed.type === 'routerule' && this.state.serviceDetailsInfo.routeRules) {
      for (let i = 0; i < this.state.serviceDetailsInfo.routeRules.length; i++) {
        if (parsed.name === this.state.serviceDetailsInfo.routeRules[i].name) {
          return true;
        }
      }
    } else if (parsed.type === 'destinationpolicy' && this.state.serviceDetailsInfo.destinationPolicies) {
      for (let i = 0; i < this.state.serviceDetailsInfo.destinationPolicies.length; i++) {
        if (parsed.name === this.state.serviceDetailsInfo.destinationPolicies[i].name) {
          return true;
        }
      }
    } else if (parsed.type === 'virtualservice' && this.state.serviceDetailsInfo.virtualServices) {
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
  // ?routerule=name or ?destinationpolicy=name or ?virtualservice=name or ?destinationrule=name
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

  editorContent(parsed: ParsedSearch) {
    if (parsed.type === 'routerule' && this.state.serviceDetailsInfo.routeRules) {
      for (let i = 0; i < this.state.serviceDetailsInfo.routeRules.length; i++) {
        if (parsed.name === this.state.serviceDetailsInfo.routeRules[i].name) {
          return yaml.safeDump(this.state.serviceDetailsInfo.routeRules[i], safeDumpOptions);
        }
      }
    } else if (parsed.type === 'destinationpolicy' && this.state.serviceDetailsInfo.destinationPolicies) {
      for (let i = 0; i < this.state.serviceDetailsInfo.destinationPolicies.length; i++) {
        if (parsed.name === this.state.serviceDetailsInfo.destinationPolicies[i].name) {
          return yaml.safeDump(this.state.serviceDetailsInfo.destinationPolicies[i], safeDumpOptions);
        }
      }
    } else if (parsed.type === 'virtualservice' && this.state.serviceDetailsInfo.virtualServices) {
      for (let i = 0; i < this.state.serviceDetailsInfo.virtualServices.length; i++) {
        if (parsed.name === this.state.serviceDetailsInfo.virtualServices[i].name) {
          return yaml.safeDump(this.state.serviceDetailsInfo.virtualServices[i], safeDumpOptions);
        }
      }
    } else if (parsed.type === 'destinationrule' && this.state.serviceDetailsInfo.destinationRules) {
      for (let i = 0; i < this.state.serviceDetailsInfo.destinationRules.length; i++) {
        if (parsed.name === this.state.serviceDetailsInfo.destinationRules[i].name) {
          return yaml.safeDump(this.state.serviceDetailsInfo.destinationRules[i], safeDumpOptions);
        }
      }
    }
    return '';
  }

  componentDidMount() {
    API.getJaegerInfo()
      .then(response => {
        this.setState({
          jaegerUri: `${response['data'].url}/search?service=${this.props.match.params.service}`
        });
      })
      .catch(error => {
        this.setState({
          error: true,
          errorMessage: API.getErrorMsg('Cannot fetch Jaeger info.', error)
        });
        console.log(error);
      });
    API.getServiceDetail(this.props.match.params.namespace, this.props.match.params.service)
      .then(response => {
        let data = response['data'];
        this.setState({
          serviceDetailsInfo: this.parseServiceDetailsInfo(data)
        });
      })
      .catch(error => {
        this.setState({
          error: true,
          errorMessage: API.getErrorMsg('Could not fetch Service Details.', error)
        });
        console.log(error);
      });
  }

  render() {
    let parsedSearch = this.parseSearch();
    let editorVisible = parsedSearch.name && parsedSearch.type;
    let to = '/namespaces/' + this.props.match.params.namespace + '/services/' + this.props.match.params.service;
    return (
      <div className="container-fluid container-pf-nav-pf-vertical">
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
        <div className="page-header">
          <h2>
            Service{' '}
            <Link to="/services" onClick={this.updateFilter}>
              {this.props.match.params.namespace}
            </Link>{' '}
            /
            {editorVisible ? (
              <span>
                <Link to={to}>{' ' + this.props.match.params.service}</Link> / {parsedSearch.type}
              </span>
            ) : (
              <span>{' ' + this.props.match.params.service}</span>
            )}
          </h2>
        </div>
        {editorVisible ? (
          <div className="container-fluid container-cards-pf">
            <Row className="row-cards-pf">
              <Col>
                <h1>{parsedSearch.type + ': ' + parsedSearch.name}</h1>
                <AceEditor
                  mode="yaml"
                  theme="eclipse"
                  readOnly={true}
                  width={'100%'}
                  height={'50vh'}
                  className={'istio-ace-editor'}
                  setOptions={aceOptions}
                  value={this.editorContent(parsedSearch)}
                />
              </Col>
            </Row>
          </div>
        ) : (
          <TabContainer id="basic-tabs" defaultActiveKey={1}>
            <div>
              <Nav bsClass="nav nav-tabs nav-tabs-pf">
                <NavItem eventKey={1}>
                  <div dangerouslySetInnerHTML={{ __html: 'Info' }} />
                </NavItem>
                <NavItem eventKey={2}>
                  <div dangerouslySetInnerHTML={{ __html: 'Metrics' }} />
                </NavItem>
                <li role="presentation">
                  <a href={this.state.jaegerUri} target="_blank">
                    <div dangerouslySetInnerHTML={{ __html: 'Traces' }} />
                  </a>
                </li>
              </Nav>
              <TabContent>
                <TabPane eventKey={1}>
                  <ServiceInfo
                    namespace={this.props.match.params.namespace}
                    service={this.props.match.params.service}
                    serviceDetails={this.state.serviceDetailsInfo}
                  />
                </TabPane>
                <TabPane eventKey={2} mountOnEnter={true} unmountOnExit={true}>
                  <ServiceMetrics
                    namespace={this.props.match.params.namespace}
                    service={this.props.match.params.service}
                  />
                </TabPane>
              </TabContent>
            </div>
          </TabContainer>
        )}
      </div>
    );
  }
}

export default ServiceDetails;
