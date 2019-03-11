import * as React from 'react';
import * as API from '../../services/Api';
import { RouteComponentProps } from 'react-router-dom';
import { emptyWorkload, Workload, WorkloadId } from '../../types/Workload';
import { ObjectCheck, Validations } from '../../types/IstioObjects';
import { TabContainer, Nav, NavItem, TabContent, TabPane } from 'patternfly-react';
import WorkloadInfo from './WorkloadInfo';
import * as MessageCenter from '../../utils/MessageCenter';
import WorkloadMetricsContainer from '../../containers/WorkloadMetricsContainer';
import { WorkloadHealth } from '../../types/Health';
import { MetricsObjectTypes } from '../../types/Metrics';
import CustomMetricsContainer from '../../components/Metrics/CustomMetrics';
import { serverConfig } from '../../config/serverConfig';
import BreadcrumbView from '../../components/BreadcrumbView/BreadcrumbView';
import { GraphDefinition, GraphType, NodeParamsType, NodeType } from '../../types/Graph';
import { fetchTrafficDetails } from '../../helpers/TrafficDetailsHelper';
import TrafficDetails from '../../components/Metrics/TrafficDetails';
import MetricsDuration from '../../components/MetricsOptions/MetricsDuration';

type WorkloadDetailsState = {
  workload: Workload;
  validations: Validations;
  istioEnabled: boolean;
  health?: WorkloadHealth;
  trafficData: GraphDefinition | null;
};

class WorkloadDetails extends React.Component<RouteComponentProps<WorkloadId>, WorkloadDetailsState> {
  constructor(props: RouteComponentProps<WorkloadId>) {
    super(props);
    this.state = {
      workload: emptyWorkload,
      validations: {},
      istioEnabled: false,
      trafficData: null
    };
    this.doRefresh();
  }

  componentDidUpdate(prevProps: RouteComponentProps<WorkloadId>) {
    if (
      this.props.match.params.namespace !== prevProps.match.params.namespace ||
      this.props.match.params.workload !== prevProps.match.params.workload
    ) {
      this.setState(
        {
          workload: emptyWorkload,
          validations: {},
          istioEnabled: false,
          health: undefined
        },
        () => this.doRefresh()
      );
    }
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

  doRefresh = () => {
    const currentTab = this.activeTab('tab', 'info');

    if (this.state.workload === emptyWorkload || currentTab === 'info') {
      this.setState({ trafficData: null });
      this.fetchWorkload();
    }

    if (currentTab === 'traffic') {
      this.fetchTrafficData();
    }
  };

  fetchTrafficData = () => {
    const node: NodeParamsType = {
      workload: this.props.match.params.workload,
      namespace: { name: this.props.match.params.namespace },
      nodeType: NodeType.WORKLOAD,

      // unneeded
      app: '',
      service: '',
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

  fetchWorkload = () => {
    API.getWorkload(this.props.match.params.namespace, this.props.match.params.workload)
      .then(details => {
        this.setState({
          workload: details.data,
          validations: this.workloadValidations(details.data),
          istioEnabled: details.data.istioSidecar
        });
        return API.getWorkloadHealth(
          this.props.match.params.namespace,
          this.props.match.params.workload,
          600,
          details.data.istioSidecar
        );
      })
      .then(health => this.setState({ health: health }))
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

  render() {
    const app = this.state.workload.labels[serverConfig.istioLabels.appLabelName];
    const version = this.state.workload.labels[serverConfig.istioLabels.versionLabelName];
    const isLabeled = app && version;

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
              <NavItem eventKey="in_metrics">
                <div>Inbound Metrics</div>
              </NavItem>
              <NavItem eventKey="out_metrics">
                <div>Outbound Metrics</div>
              </NavItem>
              {isLabeled &&
                this.state.workload.runtimes.map(runtime => {
                  return runtime.dashboardRefs.map(dashboard => {
                    return (
                      <NavItem key={dashboard.template} eventKey={dashboard.template}>
                        <div>{dashboard.title}</div>
                      </NavItem>
                    );
                  });
                })}
            </Nav>
            <TabContent>
              <TabPane eventKey="info">
                <WorkloadInfo
                  workload={this.state.workload}
                  namespace={this.props.match.params.namespace}
                  validations={this.state.validations}
                  onRefresh={this.doRefresh}
                  activeTab={this.activeTab}
                  onSelectTab={this.tabSelectHandler}
                  istioEnabled={this.state.istioEnabled}
                  health={this.state.health}
                />
              </TabPane>
              <TabPane eventKey={'traffic'}>
                <TrafficDetails
                  duration={MetricsDuration.initialDuration()}
                  trafficData={this.state.trafficData}
                  itemType={MetricsObjectTypes.WORKLOAD}
                  namespace={this.props.match.params.namespace}
                  workloadName={this.state.workload.name}
                  onDurationChanged={this.handleTrafficDurationChange}
                  onRefresh={this.doRefresh}
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
              {isLabeled &&
                this.state.workload.runtimes.map(runtime => {
                  return runtime.dashboardRefs.map(dashboard => {
                    return (
                      <TabPane
                        key={dashboard.template}
                        eventKey={dashboard.template}
                        mountOnEnter={true}
                        unmountOnExit={true}
                      >
                        <CustomMetricsContainer
                          namespace={this.props.match.params.namespace}
                          app={app}
                          version={version}
                          template={dashboard.template}
                        />
                      </TabPane>
                    );
                  });
                })}
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
      urlParams.set(tabName, tabKey);

      this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());

      if (postHandler) {
        postHandler(tabKey);
      }
    };
  };
}

export default WorkloadDetails;
