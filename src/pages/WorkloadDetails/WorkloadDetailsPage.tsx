import * as React from 'react';
import * as API from '../../services/Api';
import { RouteComponentProps } from 'react-router-dom';
import { emptyWorkload, Workload, WorkloadId } from '../../types/Workload';
import { ObjectCheck, Validations, ValidationTypes } from '../../types/IstioObjects';
import WorkloadInfo from './WorkloadInfo';
import * as AlertUtils from '../../utils/AlertUtils';
import IstioMetricsContainer from '../../components/Metrics/IstioMetrics';
import { WorkloadHealth } from '../../types/Health';
import { MetricsObjectTypes } from '../../types/Metrics';
import CustomMetricsContainer from '../../components/Metrics/CustomMetrics';
import { RenderHeader } from '../../components/Nav/Page';
import { isIstioNamespace, serverConfig } from '../../config/ServerConfig';
import PfTitle from '../../components/Pf/PfTitle';
import { EdgeLabelMode, GraphDefinition, GraphType, NodeType } from '../../types/Graph';
import TrafficDetails from '../../components/Metrics/TrafficDetails';
import WorkloadPodLogs from './WorkloadInfo/WorkloadPodLogs';
import { DurationInSeconds } from '../../types/Common';
import { connect } from 'react-redux';
import { KialiAppState } from '../../store/Store';
import { durationSelector } from '../../store/Selectors';
import { EmptyState, EmptyStateBody, EmptyStateVariant, Tab, Title } from '@patternfly/react-core';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import { DurationDropdownContainer } from '../../components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';
import GraphDataSource from '../../services/GraphDataSource';

type WorkloadDetailsState = {
  workload: Workload;
  validations: Validations;
  istioEnabled: boolean;
  health?: WorkloadHealth;
  trafficData: GraphDefinition | null;
  currentTab: string;
};

type WorkloadDetailsPageProps = RouteComponentProps<WorkloadId> & {
  duration: DurationInSeconds;
};

const tabName = 'tab';
const defaultTab = 'info';
const trafficTabName = 'traffic';

const paramToTab: { [key: string]: number } = {
  info: 0,
  traffic: 1,
  logs: 2,
  in_metrics: 3,
  out_metrics: 4
};

class WorkloadDetails extends React.Component<WorkloadDetailsPageProps, WorkloadDetailsState> {
  private graphDataSource: GraphDataSource;

  constructor(props: WorkloadDetailsPageProps) {
    super(props);
    this.state = {
      workload: emptyWorkload,
      validations: {},
      istioEnabled: true, // true until proven otherwise
      trafficData: null,
      currentTab: activeTab(tabName, defaultTab)
    };

    this.graphDataSource = new GraphDataSource();
  }

  componentDidMount(): void {
    this.doRefresh();

    this.graphDataSource.on('fetchSuccess', this.graphDsFetchSuccess);
    this.graphDataSource.on('fetchError', this.graphDsFetchError);
  }

  componentDidUpdate(prevProps: WorkloadDetailsPageProps) {
    const aTab = activeTab(tabName, defaultTab);
    if (
      this.props.match.params.namespace !== prevProps.match.params.namespace ||
      this.props.match.params.workload !== prevProps.match.params.workload ||
      this.state.currentTab !== aTab ||
      this.props.duration !== prevProps.duration
    ) {
      this.setState(
        {
          workload: emptyWorkload,
          validations: {},
          istioEnabled: true, // true until proven otherwise
          currentTab: aTab,
          health: undefined
        },
        () => this.doRefresh()
      );
    }
  }

  componentWillUnmount(): void {
    this.graphDataSource.removeListener('fetchSuccess', this.graphDsFetchSuccess);
    this.graphDataSource.removeListener('fetchError', this.graphDsFetchError);
  }

  // All information for validations is fetched in the workload, no need to add another call
  workloadValidations(workload: Workload): Validations {
    const noIstiosidecar: ObjectCheck = {
      message: 'Pod has no Istio sidecar',
      severity: ValidationTypes.Warning,
      path: ''
    };
    const noAppLabel: ObjectCheck = { message: 'Pod has no app label', severity: ValidationTypes.Warning, path: '' };
    const noVersionLabel: ObjectCheck = {
      message: 'Pod has no version label',
      severity: ValidationTypes.Warning,
      path: ''
    };
    const pendingPod: ObjectCheck = { message: 'Pod is in Pending Phase', severity: ValidationTypes.Warning, path: '' };
    const unknownPod: ObjectCheck = { message: 'Pod is in Unknown Phase', severity: ValidationTypes.Warning, path: '' };
    const failedPod: ObjectCheck = { message: 'Pod is in Failed Phase', severity: ValidationTypes.Error, path: '' };

    const validations: Validations = {};
    if (workload.pods.length > 0) {
      validations.pod = {};
      workload.pods.forEach(pod => {
        validations.pod[pod.name] = {
          name: pod.name,
          objectType: 'pod',
          valid: true,
          checks: []
        };
        if (!isIstioNamespace(this.props.match.params.namespace)) {
          if (!pod.istioContainers || pod.istioContainers.length === 0) {
            validations.pod[pod.name].checks.push(noIstiosidecar);
          }
          if (!pod.labels) {
            validations.pod[pod.name].checks.push(noAppLabel);
            validations.pod[pod.name].checks.push(noVersionLabel);
          } else {
            if (!pod.appLabel) {
              validations.pod[pod.name].checks.push(noAppLabel);
            }
            if (!pod.versionLabel) {
              validations.pod[pod.name].checks.push(noVersionLabel);
            }
          }
        }
        switch (pod.status) {
          case 'Pending':
            validations.pod[pod.name].checks.push(pendingPod);
            break;
          case 'Unknown':
            validations.pod[pod.name].checks.push(unknownPod);
            break;
          case 'Failed':
            validations.pod[pod.name].checks.push(failedPod);
            break;
          default:
          // Pod healthy
        }
        validations.pod[pod.name].valid = validations.pod[pod.name].checks.length === 0;
      });
    }
    return validations;
  }

  doRefresh = () => {
    const currentTab = this.state.currentTab;
    if (this.state.workload === emptyWorkload || currentTab === 'info') {
      this.setState({ trafficData: null });
      this.fetchWorkload();
      this.loadMiniGraphData();
    }

    if (currentTab === trafficTabName) {
      // Since traffic tab shares data with mini-graph, we reload mini-graph data.
      this.loadMiniGraphData();
    }
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
          this.props.duration,
          details.data.istioSidecar
        );
      })
      .then(health => this.setState({ health: health }))
      .catch(error => {
        AlertUtils.addError('Could not fetch Workload.', error);
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

  staticTabs() {
    const hasPods = this.state.workload.pods && this.state.workload.pods.length > 0;

    const overTab = (
      <Tab title="Overview" eventKey={0} key={'Overview'}>
        <WorkloadInfo
          workload={this.state.workload}
          namespace={this.props.match.params.namespace}
          validations={this.state.validations}
          istioEnabled={this.state.istioEnabled}
          health={this.state.health}
          miniGraphDataSource={this.graphDataSource}
        />
      </Tab>
    );
    const trafficTab = (
      <Tab title="Traffic" eventKey={1} key={'Traffic'}>
        <TrafficDetails
          trafficData={this.state.trafficData}
          itemType={MetricsObjectTypes.WORKLOAD}
          namespace={this.props.match.params.namespace}
          workloadName={this.state.workload.name}
        />
      </Tab>
    );

    const logTab = (
      <Tab title="Logs" eventKey={2} key={'Logs'}>
        {hasPods ? (
          <WorkloadPodLogs namespace={this.props.match.params.namespace} pods={this.state.workload.pods} />
        ) : (
          <EmptyState variant={EmptyStateVariant.full}>
            <Title headingLevel="h5" size="lg">
              No logs for Workload {this.state.workload.name}
            </Title>
            <EmptyStateBody>There are no logs to display because the workload has no pods.</EmptyStateBody>
          </EmptyState>
        )}
      </Tab>
    );

    const inTab = (
      <Tab title="Inbound Metrics" eventKey={3} key={'Inbound Metrics'}>
        <IstioMetricsContainer
          namespace={this.props.match.params.namespace}
          object={this.props.match.params.workload}
          objectType={MetricsObjectTypes.WORKLOAD}
          direction={'inbound'}
        />
      </Tab>
    );

    const outTab = (
      <Tab title="Outbound Metrics" eventKey={4} key={'Outbound Metrics'}>
        <IstioMetricsContainer
          namespace={this.props.match.params.namespace}
          object={this.props.match.params.workload}
          objectType={MetricsObjectTypes.WORKLOAD}
          direction={'outbound'}
        />
      </Tab>
    );

    return [overTab, trafficTab, logTab, inTab, outTab];
  }

  runtimeTabs() {
    const app = this.state.workload.labels[serverConfig.istioLabels.appLabelName];
    const version = this.state.workload.labels[serverConfig.istioLabels.versionLabelName];
    const isLabeled = app && version;
    const staticTabsCount = 5;

    const tabs: JSX.Element[] = [];
    if (isLabeled) {
      let dynamicTabsCount: number = 0;
      this.state.workload.runtimes.forEach(runtime => {
        runtime.dashboardRefs.forEach(dashboard => {
          const tabKey = dynamicTabsCount + staticTabsCount;
          paramToTab[dashboard.template] = tabKey;
          const tab = (
            <Tab key={dashboard.template} title={dashboard.title} eventKey={tabKey}>
              <CustomMetricsContainer
                namespace={this.props.match.params.namespace}
                app={app}
                version={version}
                template={dashboard.template}
              />
            </Tab>
          );
          tabs.push(tab);
          dynamicTabsCount = dynamicTabsCount + 1;
        });
      });
    }

    return tabs;
  }

  renderActions = () => {
    let component;
    switch (this.state.currentTab) {
      case 'info':
        component = <DurationDropdownContainer id="workload-info-duration-dropdown" />;
        break;
      case 'traffic':
        component = <DurationDropdownContainer id="workload-traffic-duration-dropdown" />;
        break;
      default:
        return undefined;
    }
    return (
      <span style={{ position: 'absolute', right: '50px', zIndex: 1 }}>
        {component}
        <RefreshButtonContainer handleRefresh={this.doRefresh} />
        &nbsp;
      </span>
    );
  };

  renderTabs() {
    // PF4 Tabs doesn't support static tabs followed of an array of tabs created dynamically.
    return this.staticTabs().concat(this.runtimeTabs());
  }

  render() {
    return (
      <>
        <RenderHeader location={this.props.location}>
          <PfTitle location={this.props.location} istio={this.state.istioEnabled} />
          {this.renderActions()}
        </RenderHeader>
        <ParameterizedTabs
          id="basic-tabs"
          onSelect={tabValue => {
            this.setState({ currentTab: tabValue });
          }}
          tabMap={paramToTab}
          tabName={tabName}
          defaultTab={defaultTab}
          activeTab={this.state.currentTab}
          mountOnEnter={false}
          unmountOnExit={true}
        >
          {this.renderTabs()}
        </ParameterizedTabs>
      </>
    );
  }

  private loadMiniGraphData = () => {
    this.graphDataSource.fetchGraphData({
      namespaces: [{ name: this.props.match.params.namespace }],
      duration: this.props.duration,
      graphType: GraphType.WORKLOAD,
      injectServiceNodes: true,
      edgeLabelMode: EdgeLabelMode.NONE,
      showSecurity: false,
      showUnusedNodes: false,
      node: {
        app: '',
        namespace: { name: this.props.match.params.namespace },
        nodeType: NodeType.WORKLOAD,
        service: '',
        version: '',
        workload: this.props.match.params.workload
      }
    });
  };

  private graphDsFetchSuccess = () => {
    this.setState({
      trafficData: this.graphDataSource.graphDefinition
    });
  };

  private graphDsFetchError = (errorMessage: string | null) => {
    if (this.state.currentTab === trafficTabName) {
      if (errorMessage !== '') {
        errorMessage = 'Could not fetch traffic data: ' + errorMessage;
      } else {
        errorMessage = 'Could not fetch traffic data.';
      }

      AlertUtils.addError(errorMessage);
    }
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state)
});

const WorkloadDetailsContainer = connect(mapStateToProps)(WorkloadDetails);

export default WorkloadDetailsContainer;
