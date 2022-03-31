import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import { EmptyState, EmptyStateBody, EmptyStateVariant, Tab, Title } from '@patternfly/react-core';
import * as API from '../../services/Api';
import { Workload, WorkloadId } from '../../types/Workload';
import WorkloadInfo from './WorkloadInfo';
import * as AlertUtils from '../../utils/AlertUtils';
import IstioMetricsContainer from '../../components/Metrics/IstioMetrics';
import { MetricsObjectTypes } from '../../types/Metrics';
import CustomMetricsContainer from '../../components/Metrics/CustomMetrics';
import { RenderHeader } from '../../components/Nav/Page';
import { serverConfig } from '../../config/ServerConfig';
import WorkloadPodLogs from './WorkloadPodLogs';
import { DurationInSeconds, TimeInMilliseconds } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { durationSelector } from '../../store/Selectors';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import TracesComponent from 'components/JaegerIntegration/TracesComponent';
import { JaegerInfo } from 'types/JaegerInfo';
import TrafficDetails from 'components/TrafficList/TrafficDetails';
import WorkloadWizardDropdown from '../../components/IstioWizards/WorkloadWizardDropdown';
import TimeControl from '../../components/Time/TimeControl';
import EnvoyDetailsContainer from 'components/Envoy/EnvoyDetails';
import { StatusState } from '../../types/StatusState';
import { WorkloadHealth } from 'types/Health';

type WorkloadDetailsState = {
  workload?: Workload;
  health?: WorkloadHealth;
  currentTab: string;
};

type ReduxProps = {
  duration: DurationInSeconds;
  jaegerInfo?: JaegerInfo;
  lastRefreshAt: TimeInMilliseconds;
  statusState: StatusState;
};

type WorkloadDetailsPageProps = ReduxProps & RouteComponentProps<WorkloadId>;

const tabName = 'tab';
const defaultTab = 'info';

const paramToTab: { [key: string]: number } = {
  info: 0,
  traffic: 1,
  logs: 2,
  in_metrics: 3,
  out_metrics: 4,
  traces: 5
};
var nextTabIndex = 6;

class WorkloadDetails extends React.Component<WorkloadDetailsPageProps, WorkloadDetailsState> {
  constructor(props: WorkloadDetailsPageProps) {
    super(props);
    this.state = { currentTab: activeTab(tabName, defaultTab) };
  }

  componentDidMount(): void {
    this.fetchWorkload();
  }

  componentDidUpdate(prevProps: WorkloadDetailsPageProps) {
    const currentTab = activeTab(tabName, defaultTab);
    if (
      this.props.match.params.namespace !== prevProps.match.params.namespace ||
      this.props.match.params.workload !== prevProps.match.params.workload ||
      this.props.lastRefreshAt !== prevProps.lastRefreshAt ||
      currentTab !== this.state.currentTab ||
      this.props.duration !== prevProps.duration
    ) {
      if (currentTab === 'info' || currentTab === 'logs' || currentTab === 'envoy') {
        this.fetchWorkload();
      }
      if (currentTab !== this.state.currentTab) {
        this.setState({ currentTab: currentTab });
      }
    }
  }

  private fetchWorkload = () => {
    const params: { [key: string]: string } = {
      validate: 'true',
      rateInterval: String(this.props.duration) + 's',
      health: 'true'
    };
    API.getWorkload(this.props.match.params.namespace, this.props.match.params.workload, params)
      .then(details => {
        this.setState({
          workload: details.data,
          health: WorkloadHealth.fromJson(
            this.props.match.params.namespace,
            this.props.match.params.workload,
            details.data.health,
            { rateInterval: this.props.duration, hasSidecar: details.data.istioSidecar }
          )
        });
      })
      .catch(error => AlertUtils.addError('Could not fetch Workload.', error));
  };

  private staticTabs() {
    const hasPods = this.state.workload?.pods.length;
    const tabsArray: JSX.Element[] = [];

    const overTab = (
      <Tab title="Overview" eventKey={0} key={'Overview'}>
        <WorkloadInfo
          workload={this.state.workload}
          duration={this.props.duration}
          health={this.state.health}
          namespace={this.props.match.params.namespace}
          refreshWorkload={this.fetchWorkload}
        />
      </Tab>
    );
    tabsArray.push(overTab);

    const trafficTab = (
      <Tab title="Traffic" eventKey={1} key={'Traffic'}>
        <TrafficDetails
          itemName={this.props.match.params.workload}
          itemType={MetricsObjectTypes.WORKLOAD}
          namespace={this.props.match.params.namespace}
        />
      </Tab>
    );
    tabsArray.push(trafficTab);

    if (!serverConfig.kialiFeatureFlags.disabledFeatures || !serverConfig.kialiFeatureFlags.disabledFeatures.includes('logs-tab')) {
      const logTab = (
        <Tab title="Logs" eventKey={2} key={'Logs'}>
          {hasPods ? (
            <WorkloadPodLogs
              namespace={this.props.match.params.namespace}
              workload={this.props.match.params.workload}
              pods={this.state.workload!.pods}
            />
          ) : (
            <EmptyState variant={EmptyStateVariant.full}>
              <Title headingLevel="h5" size="lg">
                No logs for Workload {this.props.match.params.workload}
              </Title>
              <EmptyStateBody>There are no logs to display because the workload has no pods.</EmptyStateBody>
            </EmptyState>
          )}
        </Tab>
      );
      tabsArray.push(logTab);
    }

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
    tabsArray.push(inTab);

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
    tabsArray.push(outTab);

    if (this.props.jaegerInfo && this.props.jaegerInfo.enabled && this.props.jaegerInfo.integration) {
      tabsArray.push(
        <Tab eventKey={5} title="Traces" key="Traces">
          <TracesComponent
            namespace={this.props.match.params.namespace}
            target={this.props.match.params.workload}
            targetKind={'workload'}
          />
        </Tab>
      );
    }
    if (this.state.workload && this.hasIstioSidecars(this.state.workload)) {
      const envoyTab = (
        <Tab title="Envoy" eventKey={10} key={'Envoy'}>
          {this.state.workload && (
            <EnvoyDetailsContainer namespace={this.props.match.params.namespace} workload={this.state.workload} />
          )}
        </Tab>
      );
      tabsArray.push(envoyTab);
      paramToTab['envoy'] = 10;
    }

    // Used by the runtimes tabs
    nextTabIndex = tabsArray.length + 1;

    return tabsArray;
  }

  private hasIstioSidecars(workload: Workload): boolean {
    var hasIstioSidecars: boolean = false;

    if (workload.pods.length > 0) {
      workload.pods.forEach(pod => {
        if (pod.istioContainers && pod.istioContainers.length > 0) {
          hasIstioSidecars = true;
        } else {
          hasIstioSidecars =
            hasIstioSidecars || (!!pod.containers && pod.containers.some(cont => cont.name === 'istio-proxy'));
        }
      });
    }
    return hasIstioSidecars;
  }

  private runtimeTabs() {
    const tabs: JSX.Element[] = [];

    if (this.state.workload) {
      const app = this.state.workload.labels[serverConfig.istioLabels.appLabelName];
      const version = this.state.workload.labels[serverConfig.istioLabels.versionLabelName];
      const isLabeled = app && version;
      if (isLabeled) {
        let tabOffset = 0;
        this.state.workload.runtimes.forEach(runtime => {
          runtime.dashboardRefs.forEach(dashboard => {
            if (dashboard.template !== 'envoy') {
              const tabKey = tabOffset + nextTabIndex;
              paramToTab[dashboard.template] = tabKey;
              const tab = (
                <Tab key={dashboard.template} title={dashboard.title} eventKey={tabKey}>
                  <CustomMetricsContainer
                    namespace={this.props.match.params.namespace}
                    app={app}
                    version={version}
                    workload={this.state.workload!.name}
                    workloadType={this.state.workload!.type}
                    template={dashboard.template}
                  />
                </Tab>
              );
              tabs.push(tab);
              tabOffset++;
            }
          });
        });
      }
    }

    return tabs;
  }

  private renderTabs() {
    // PF4 Tabs doesn't support static tabs followed of an array of tabs created dynamically.
    return this.staticTabs().concat(this.runtimeTabs());
  }

  render() {
    // set default to true: all dynamic tabs (unlisted below) are for runtimes dashboards, which uses custom time
    let useCustomTime = true;
    switch (this.state.currentTab) {
      case 'info':
      case 'traffic':
        useCustomTime = false;
        break;
      case 'in_metrics':
      case 'out_metrics':
      case 'logs':
      case 'traces':
        useCustomTime = true;
        break;
    }
    const actionsToolbar =
      this.state.currentTab === 'info' && this.state.workload ? (
        <WorkloadWizardDropdown
          namespace={this.props.match.params.namespace}
          workload={this.state.workload}
          onChange={this.fetchWorkload}
          statusState={this.props.statusState}
        />
      ) : undefined;
    return (
      <>
        <RenderHeader
          location={this.props.location}
          rightToolbar={<TimeControl customDuration={useCustomTime} />}
          actionsToolbar={actionsToolbar}
        />
        {this.state.workload && (
          <ParameterizedTabs
            id="basic-tabs"
            onSelect={tabValue => {
              this.setState({ currentTab: tabValue });
            }}
            tabMap={paramToTab}
            tabName={tabName}
            defaultTab={defaultTab}
            activeTab={this.state.currentTab}
            mountOnEnter={true}
            unmountOnExit={true}
          >
            {this.renderTabs()}
          </ParameterizedTabs>
        )}
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  jaegerInfo: state.jaegerState.info,
  lastRefreshAt: state.globalState.lastRefreshAt,
  statusState: state.statusState
});

const WorkloadDetailsContainer = connect(mapStateToProps)(WorkloadDetails);

export default WorkloadDetailsContainer;
