import * as React from 'react';
import * as API from '../../services/Api';
import { Link, RouteComponentProps } from 'react-router-dom';
import { WorkloadId } from '../../types/Workload';
import { Deployment, Validations } from '../../types/IstioObjects';
import { authentication } from '../../utils/Authentication';
import { Breadcrumb, TabContainer, Nav, NavItem, TabContent, TabPane } from 'patternfly-react';
import WorkloadInfo from './WorkloadInfo';
import * as MessageCenter from '../../utils/MessageCenter';

type WorkloadDetailsState = {
  workload: Deployment;
  validations: Validations;
  istioEnabled: boolean;
};
interface ParsedSearch {
  type?: string;
  name?: string;
}

class WorkloadDetails extends React.Component<RouteComponentProps<WorkloadId>, WorkloadDetailsState> {
  constructor(props: RouteComponentProps<WorkloadId>) {
    super(props);
    this.state = {
      workload: {
        name: '',
        type: '',
        createdAt: '',
        resourceVersion: '',
        replicas: 0,
        availableReplicas: 0,
        unavailableReplicas: 0,
        autoscaler: {
          name: '',
          createdAt: '',
          minReplicas: 0,
          maxReplicas: 0,
          targetCPUUtilizationPercentage: 0
        }
      },
      validations: {},
      istioEnabled: false
    };
    this.fetchWorkload();
  }

  workloadPageURL(parsedSearch?: ParsedSearch) {
    return '/namespaces/' + this.props.match.params.namespace + '/workloads/' + this.props.match.params.workload;
  }

  fetchWorkload = () => {
    let promiseDetails = API.getWorkload(
      authentication(),
      this.props.match.params.namespace,
      this.props.match.params.workload
    );
    let promiseValidations = API.getWorkloadValidations(
      authentication(),
      this.props.match.params.namespace,
      this.props.match.params.workload
    );

    Promise.all([promiseDetails, promiseValidations])
      .then(([resultDetails, resultValidations]) => {
        this.setState({
          workload: resultDetails.data,
          validations: resultValidations.data,
          istioEnabled: this.checkIstioEnabled(resultValidations.data)
        });
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not fetch Service Details.', error));
      });
  };

  checkIstioEnabled = (validations: Validations) => {
    let istioEnabled = true;
    Object.keys(validations)
      .map(key => validations[key])
      .forEach(obj => {
        Object.keys(obj).forEach(key => {
          istioEnabled = obj[key].checks.filter(check => check.message === 'Pod has no Istio sidecar').length < 1;
        });
      });
    return istioEnabled;
  };

  renderBreadcrumbs = () => {
    const urlParams = new URLSearchParams(this.props.location.search);
    const to = this.workloadPageURL();
    return (
      <Breadcrumb title={true}>
        <Breadcrumb.Item componentClass="span">
          <Link to="/workloads">Workloads</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass="span">
          <Link to={`/workloads?namespace=${encodeURIComponent(this.props.match.params.namespace)}`}>
            Namespace: {this.props.match.params.namespace}
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass="span">
          <Link to={to}>Workload: {this.props.match.params.workload}</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item active={true}>
          Workload {(urlParams.get('tab') || 'info') === 'info' ? 'Info' : 'Inbound Metrics'}
        </Breadcrumb.Item>
      </Breadcrumb>
    );
  };

  render() {
    return (
      <>
        {this.renderBreadcrumbs()}
        <TabContainer id="basic-tabs" activeKey={this.activeTab('tab', 'info')} onSelect={this.tabSelectHandler('tab')}>
          <div>
            <Nav bsClass="nav nav-tabs nav-tabs-pf">
              <NavItem eventKey="info">
                <div>Info</div>
              </NavItem>
              <NavItem eventKey="metrics" disabled={true}>
                <div>Inbound Metrics</div>
              </NavItem>
            </Nav>
            <TabContent>
              <TabPane eventKey="info">
                <WorkloadInfo
                  workload={this.state.workload}
                  namespace={this.props.match.params.namespace}
                  validations={this.state.validations}
                  onRefresh={this.fetchWorkload}
                  activeTab={this.activeTab}
                  onSelectTab={this.tabSelectHandler}
                  istioEnabled={this.state.istioEnabled}
                />
              </TabPane>
              <TabPane eventKey="metrics" />
            </TabContent>
          </div>
        </TabContainer>
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

      const urlParams = new URLSearchParams(this.props.location.search);
      urlParams.set(tabName, tabKey);

      this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
    };
  };
}

export default WorkloadDetails;
