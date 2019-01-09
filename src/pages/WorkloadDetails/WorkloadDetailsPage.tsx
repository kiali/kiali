import * as React from 'react';
import * as API from '../../services/Api';
import { Link, RouteComponentProps } from 'react-router-dom';
import { emptyWorkload, Workload, WorkloadId } from '../../types/Workload';
import { ObjectCheck, Validations } from '../../types/IstioObjects';
import { authentication } from '../../utils/Authentication';
import { Breadcrumb, TabContainer, Nav, NavItem, TabContent, TabPane } from 'patternfly-react';
import WorkloadInfo from './WorkloadInfo';
import * as MessageCenter from '../../utils/MessageCenter';
import WorkloadMetricsContainer from '../../containers/WorkloadMetricsContainer';
import { WorkloadHealth } from '../../types/Health';
import { ListPageLink, TargetPage } from '../../components/ListPage/ListPageLink';
import { MetricsObjectTypes } from '../../types/Metrics';

type WorkloadDetailsState = {
  workload: Workload;
  validations: Validations;
  istioEnabled: boolean;
  health?: WorkloadHealth;
};
interface ParsedSearch {
  type?: string;
  name?: string;
}

class WorkloadDetails extends React.Component<RouteComponentProps<WorkloadId>, WorkloadDetailsState> {
  constructor(props: RouteComponentProps<WorkloadId>) {
    super(props);
    this.state = {
      workload: emptyWorkload,
      validations: {},
      istioEnabled: false
    };
    this.fetchWorkload();
  }

  workloadPageURL(parsedSearch?: ParsedSearch) {
    return '/namespaces/' + this.props.match.params.namespace + '/workloads/' + this.props.match.params.workload;
  }

  // All information for validations is fetched in the workload, no need to add another call
  workloadValidations(workload: Workload): Validations {
    const noIstiosidecar: ObjectCheck = { message: 'Pod has no Istio sidecar', severity: 'warning', path: '' };
    const noAppLabel: ObjectCheck = { message: 'Pod has no app label', severity: 'warning', path: '' };
    const noVersionLabel: ObjectCheck = { message: 'Pod has no version label', severity: 'warning', path: '' };

    const validations: Validations = {};
    if (workload.pods.length > 0) {
      validations['pod'] = {};
      workload.pods.forEach(pod => {
        validations['pod'][pod.name] = {
          name: pod.name,
          objectType: 'pod',
          valid: true,
          checks: []
        };
        if (!pod.istioContainers || pod.istioContainers.length === 0) {
          validations['pod'][pod.name].checks.push(noIstiosidecar);
        }
        if (!pod.labels) {
          validations['pod'][pod.name].checks.push(noAppLabel);
          validations['pod'][pod.name].checks.push(noVersionLabel);
        } else {
          if (!pod.appLabel) {
            validations['pod'][pod.name].checks.push(noAppLabel);
          }
          if (!pod.versionLabel) {
            validations['pod'][pod.name].checks.push(noVersionLabel);
          }
        }
        validations['pod'][pod.name].valid = validations['pod'][pod.name].checks.length === 0;
      });
    }
    return validations;
  }

  fetchWorkload = () => {
    let promiseDetails = API.getWorkload(
      authentication(),
      this.props.match.params.namespace,
      this.props.match.params.workload
    );

    let promiseHealth = API.getWorkloadHealth(
      authentication(),
      this.props.match.params.namespace,
      this.props.match.params.workload,
      600
    );

    Promise.all([promiseDetails, promiseHealth])
      .then(([resultDetails, resultHealth]) => {
        this.setState({
          workload: resultDetails.data,
          validations: this.workloadValidations(resultDetails.data),
          istioEnabled: resultDetails.data.istioSidecar,
          health: resultHealth
        });
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not fetch Workload', error));
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
    let tab: string;
    switch (urlParams.get('tab')) {
      case 'info':
        tab = 'Info';
        break;
      case 'in_metrics':
        tab = 'Inbound Metrics';
        break;
      case 'out_metrics':
        tab = 'Outbound Metrics';
        break;
      default:
        tab = 'Info';
    }
    return (
      <Breadcrumb title={true}>
        <Breadcrumb.Item componentClass="span">
          <ListPageLink target={TargetPage.WORKLOADS}>Workloads</ListPageLink>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass="span">
          <ListPageLink target={TargetPage.WORKLOADS} namespaces={[{ name: this.props.match.params.namespace }]}>
            Namespace: {this.props.match.params.namespace}
          </ListPageLink>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass="span">
          <Link to={to}>Workload: {this.props.match.params.workload}</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item active={true}>Workload {tab}</Breadcrumb.Item>
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
              <NavItem eventKey="in_metrics">
                <div>Inbound Metrics</div>
              </NavItem>
              <NavItem eventKey="out_metrics">
                <div>Outbound Metrics</div>
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
                  health={this.state.health}
                />
              </TabPane>
              <TabPane eventKey="in_metrics" mountOnEnter={true} unmountOnExit={true}>
                <WorkloadMetricsContainer
                  namespace={this.props.match.params.namespace}
                  object={this.props.match.params.workload}
                  objectType={MetricsObjectTypes.WORKLOAD}
                  direction={'inbound'}
                />
              </TabPane>
              <TabPane eventKey="out_metrics" mountOnEnter={true} unmountOnExit={true}>
                <WorkloadMetricsContainer
                  namespace={this.props.match.params.namespace}
                  object={this.props.match.params.workload}
                  objectType={MetricsObjectTypes.WORKLOAD}
                  direction={'outbound'}
                />
              </TabPane>
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

      const urlParams = new URLSearchParams('');
      urlParams.set(tabName, tabKey);

      this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
    };
  };
}

export default WorkloadDetails;
