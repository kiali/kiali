import * as React from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { Col, Row } from 'patternfly-react';
import ServiceInfo from './ServiceInfo';
import ServiceMetrics from './ServiceMetrics';
import ServiceId from '../../types/ServiceId';
import { Nav, NavItem, TabContainer, TabContent, TabPane } from 'patternfly-react';
import { NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { ActiveFilter } from '../../types/NamespaceFilter';
import * as API from '../../services/Api';
import * as MessageCenter from '../../utils/MessageCenter';
import { hasIstioSidecar, ServiceDetailsInfo, Validations } from '../../types/ServiceInfo';
import AceEditor, { AceOptions, Annotation, Marker } from 'react-ace';
import 'brace/mode/yaml';
import 'brace/theme/eclipse';
import { authentication } from '../../utils/Authentication';
import { parseAceValidations } from '../../types/AceValidations';
import { kialiRoute } from '../../routes';

const yaml = require('js-yaml');

type ServiceDetailsState = {
  serviceDetailsInfo: ServiceDetailsInfo;
  validations: Validations;
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

  editorContent(parsed: ParsedSearch) {
    if (parsed.type === 'virtualservice' && this.state.serviceDetailsInfo.virtualServices) {
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

  render() {
    const urlParams = new URLSearchParams(this.props.location.search);
    let parsedSearch = this.parseSearch();
    let editorVisible = parsedSearch.name && parsedSearch.type;
    let yamlEditor = '';
    let aceMarkers: Array<Marker> = [];
    let aceAnnotations: Array<Annotation> = [];
    if (editorVisible) {
      yamlEditor = this.editorContent(parsedSearch);
      if (
        this.state.validations &&
        parsedSearch.type &&
        parsedSearch.name &&
        this.state.validations[parsedSearch.type] &&
        this.state.validations[parsedSearch.type][parsedSearch.name]
      ) {
        let vals: Validations = {};
        vals[parsedSearch.type] = {};
        vals[parsedSearch.type][parsedSearch.name] = this.state.validations[parsedSearch.type][parsedSearch.name];
        let aceValidations = parseAceValidations(yamlEditor, vals);
        aceMarkers = aceValidations.markers;
        aceAnnotations = aceValidations.annotations;
      }
    }
    let to = '/namespaces/' + this.props.match.params.namespace + '/services/' + this.props.match.params.service;
    return (
      <>
        <div className="page-header">
          <h2>
            Service{' '}
            <Link to={kialiRoute('/services')} onClick={this.updateFilter}>
              {this.props.match.params.namespace}
            </Link>{' '}
            /
            {editorVisible ? (
              <span>
                <Link to={kialiRoute(to)}>{' ' + this.props.match.params.service}</Link> / {parsedSearch.type}
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
                  value={yamlEditor}
                  markers={aceMarkers}
                  annotations={aceAnnotations}
                />
              </Col>
            </Row>
          </div>
        ) : (
          <TabContainer id="basic-tabs" activeKey={urlParams.get('tab') || 'info'} onSelect={this.mainTabSelectHandler}>
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

  private mainTabSelectHandler = (tabKey?: string) => {
    if (!tabKey) {
      return;
    }

    const urlParams = new URLSearchParams(this.props.location.search);
    urlParams.set('tab', tabKey);

    this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
  };

  private navigateToJaeger = () => {
    this.props.history.push(
      kialiRoute('/jaeger?path=' + encodeURIComponent(`/search?service=${this.props.match.params.service}`))
    );
  };
}

export default ServiceDetails;
