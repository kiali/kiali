import * as React from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
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

type ServiceDetailsState = {
  jaegerUri: string;
  error: boolean;
  errorMessage: string;
};

class ServiceDetails extends React.Component<RouteComponentProps<ServiceId>, ServiceDetailsState> {
  constructor(props: RouteComponentProps<ServiceId>) {
    super(props);
    this.state = {
      jaegerUri: '',
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
          errorMessage: API.GetErrorMsg('Cannot fetch Jaeger info.', error)
        });
        console.log(error);
      });
  }

  render() {
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
            / {this.props.match.params.service}
          </h2>
        </div>
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
                <ServiceInfo namespace={this.props.match.params.namespace} service={this.props.match.params.service} />
              </TabPane>
              <TabPane eventKey={2}>
                <ServiceMetrics
                  namespace={this.props.match.params.namespace}
                  service={this.props.match.params.service}
                />
              </TabPane>
            </TabContent>
          </div>
        </TabContainer>
      </div>
    );
  }
}

export default ServiceDetails;
