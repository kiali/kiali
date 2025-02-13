import * as React from 'react';
import { connect } from 'react-redux';
import { EmptyState, EmptyStateBody, EmptyStateVariant, Tab, EmptyStateHeader } from '@patternfly/react-core';
import * as API from '../../services/Api';
import { Workload, WorkloadId, WorkloadQuery } from '../../types/Workload';
import { WorkloadInfo } from './WorkloadInfo';
import * as AlertUtils from '../../utils/AlertUtils';
import { IstioMetrics } from '../../components/Metrics/IstioMetrics';
import { MetricsObjectTypes } from '../../types/Metrics';
import { CustomMetrics } from '../../components/Metrics/CustomMetrics';
import { getAppLabelName, getVersionLabelName, serverConfig } from '../../config/ServerConfig';
import { WorkloadPodLogs } from './WorkloadPodLogs';
import { DurationInSeconds, TimeInMilliseconds, TimeRange } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { durationSelector, timeRangeSelector } from '../../store/Selectors';
import { ParameterizedTabs, activeTab } from '../../components/Tab/Tabs';
import { TracesComponent } from 'components/TracingIntegration/TracesComponent';
import { TracingInfo } from 'types/TracingInfo';
import { TrafficDetails } from 'components/TrafficList/TrafficDetails';
import { WorkloadWizardDropdown } from '../../components/IstioWizards/WorkloadWizardDropdown';
import { TimeControl } from '../../components/Time/TimeControl';
import { EnvoyDetails } from 'components/Envoy/EnvoyDetails';
import { WorkloadHealth } from 'types/Health';
import { RenderHeader } from '../../components/Nav/Page/RenderHeader';
import { ErrorSection } from '../../components/ErrorSection/ErrorSection';
import { ErrorMsg } from '../../types/ErrorMsg';
import { connectRefresh } from '../../components/Refresh/connectRefresh';
import { HistoryManager } from 'app/History';
import { basicTabStyle } from 'styles/TabStyles';
import { ZtunnelConfig } from '../../components/Ambient/ZtunnelConfig';
import { WaypointConfig } from '../../components/Ambient/WaypointConfig';
import { isGVKSupported } from '../../utils/IstioConfigUtils';

type WorkloadDetailsState = {
  cluster?: string;
  currentTab: string;
  error?: ErrorMsg;
  health?: WorkloadHealth;
  waypointServiceFilter?: string;
  workload?: Workload;
};

type ReduxProps = {
  duration: DurationInSeconds;
  rangeDuration: TimeRange;
  tracingInfo?: TracingInfo;
};

type WorkloadDetailsPageProps = ReduxProps & {
  lastRefreshAt: TimeInMilliseconds;
  workloadId: WorkloadId;
};

export const tabName = 'tab';
export const defaultTab = 'info';
export const istioProxyName = 'istio-proxy';

const paramToTab: { [key: string]: number } = {
  info: 0,
  traffic: 1,
  logs: 2,
  in_metrics: 3,
  out_metrics: 4,
  traces: 5,
  waypoint: 7,
  ztunnel: 8
};

let nextTabIndex = 6;

class WorkloadDetailsPageComponent extends React.Component<WorkloadDetailsPageProps, WorkloadDetailsState> {
  constructor(props: WorkloadDetailsPageProps) {
    super(props);
    const cluster = HistoryManager.getClusterName();
    this.state = { currentTab: activeTab(tabName, defaultTab), cluster: cluster };
  }

  componentDidMount(): void {
    this.fetchWorkload();
  }

  componentDidUpdate(prevProps: WorkloadDetailsPageProps): void {
    // when linking from one cluster's workload to another cluster's workload, cluster in state should be changed
    const cluster = HistoryManager.getClusterName() ?? this.state.cluster;
    const currentTab = activeTab(tabName, defaultTab);

    const mustFetch =
      cluster !== this.state.cluster ||
      this.props.workloadId.namespace !== prevProps.workloadId.namespace ||
      this.props.workloadId.workload !== prevProps.workloadId.workload ||
      this.props.lastRefreshAt !== prevProps.lastRefreshAt ||
      this.props.duration !== prevProps.duration;

    if (mustFetch || currentTab !== this.state.currentTab) {
      if (
        mustFetch ||
        currentTab === 'envoy' ||
        currentTab === 'info' ||
        currentTab === 'logs' ||
        currentTab === 'waypoint' ||
        currentTab === 'ztunnel'
      ) {
        this.fetchWorkload(cluster).then(() => {
          this.setState({ currentTab: currentTab, cluster: cluster });
        });
      } else {
        this.setState({ currentTab: currentTab, cluster: cluster });
      }
    }
    // @TODO set the cluster in tab url
    //HistoryManager.setParam(URLParam.CLUSTER, this.state.cluster);
  }

  private fetchWorkload = async (cluster?: string): Promise<void> => {
    if (!cluster) {
      cluster = this.state.cluster;
    }

    const params: WorkloadQuery = {
      validate: 'true',
      rateInterval: `${String(this.props.duration)}s`,
      health: 'true'
    };

    return API.getWorkload(this.props.workloadId.namespace, this.props.workloadId.workload, params, cluster)
      .then(details => {
        if (details.data.services && details.data.services.length > 0) {
          this.setState({ waypointServiceFilter: details.data.services[0].name });
        }

        this.setState({
          workload: details.data,
          health: WorkloadHealth.fromJson(
            this.props.workloadId.namespace,
            this.props.workloadId.workload,
            details.data.health,
            {
              rateInterval: this.props.duration,
              hasSidecar: details.data.istioSidecar,
              hasAmbient: details.data.isAmbient
            }
          )
        });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch Workload.', error);

        const msg: ErrorMsg = {
          title: 'No Workload is selected',
          description: `${this.props.workloadId.workload} is not found in the mesh`
        };

        this.setState({ error: msg });
      });
  };

  private staticTabs(): React.ReactNode[] {
    const hasPods = this.state.workload?.pods.length;
    const tabsArray: React.ReactNode[] = [];

    const overTab = (
      <Tab title="Overview" eventKey={0} key="Overview">
        <WorkloadInfo
          workload={this.state.workload}
          duration={this.props.duration}
          health={this.state.health}
          namespace={this.props.workloadId.namespace}
          refreshWorkload={this.fetchWorkload}
        />
      </Tab>
    );
    tabsArray.push(overTab);

    if (this.state.workload && isGVKSupported(this.state.workload.gvk)) {
      const trafficTab = (
        <Tab title="Traffic" eventKey={1} key="Traffic">
          <TrafficDetails
            itemName={this.props.workloadId.workload}
            itemType={MetricsObjectTypes.WORKLOAD}
            lastRefreshAt={this.props.lastRefreshAt}
            namespace={this.props.workloadId.namespace}
            cluster={this.state.cluster}
          />
        </Tab>
      );
      tabsArray.push(trafficTab);

      if (!serverConfig.kialiFeatureFlags.disabledFeatures?.includes('logs-tab')) {
        const logTab = (
          <Tab title="Logs" eventKey={2} key="Logs" data-test="workload-details-logs-tab">
            {hasPods ? (
              <WorkloadPodLogs
                lastRefreshAt={this.props.lastRefreshAt}
                namespace={this.props.workloadId.namespace}
                workload={this.props.workloadId.workload}
                pods={this.state.workload!.pods}
                cluster={this.state.cluster}
                waypoints={this.state.workload!.waypointWorkloads}
                waypointServiceFilter={this.state.waypointServiceFilter}
              />
            ) : (
              <EmptyState variant={EmptyStateVariant.full}>
                <EmptyStateHeader
                  titleText={<>No logs for Workload{this.props.workloadId.workload}</>}
                  headingLevel="h5"
                />
                <EmptyStateBody>There are no logs to display because the workload has no pods.</EmptyStateBody>
              </EmptyState>
            )}
          </Tab>
        );
        tabsArray.push(logTab);
      }

      const inTab = (
        <Tab title="Inbound Metrics" eventKey={3} key="Inbound Metrics">
          <IstioMetrics
            data-test="inbound-metrics-component"
            direction="inbound"
            includeAmbient={!!this.state.workload?.isAmbient}
            lastRefreshAt={this.props.lastRefreshAt}
            namespace={this.props.workloadId.namespace}
            object={this.props.workloadId.workload}
            cluster={this.state.cluster}
            objectType={MetricsObjectTypes.WORKLOAD}
          />
        </Tab>
      );
      tabsArray.push(inTab);

      const outTab = (
        <Tab title="Outbound Metrics" eventKey={4} key="Outbound Metrics">
          <IstioMetrics
            data-test="outbound-metrics-component"
            direction="outbound"
            includeAmbient={!!this.state.workload?.isAmbient}
            lastRefreshAt={this.props.lastRefreshAt}
            namespace={this.props.workloadId.namespace}
            object={this.props.workloadId.workload}
            cluster={this.state.cluster}
            objectType={MetricsObjectTypes.WORKLOAD}
          />
        </Tab>
      );
      tabsArray.push(outTab);

      if (this.props.tracingInfo && this.props.tracingInfo.enabled && this.props.tracingInfo.integration) {
        const fromWaypoint =
          this.state.workload?.waypointWorkloads && this.state.workload.waypointWorkloads.length > 0 ? true : false;
        tabsArray.push(
          <Tab eventKey={5} title="Traces" key="Traces">
            <TracesComponent
              lastRefreshAt={this.props.lastRefreshAt}
              namespace={this.props.workloadId.namespace}
              cluster={this.state.cluster}
              target={this.props.workloadId.workload}
              targetKind="workload"
              fromWaypoint={fromWaypoint}
              waypointServiceFilter={this.state.waypointServiceFilter}
            />
          </Tab>
        );
      }
    }

    if (this.state.workload && (this.hasIstioSidecars(this.state.workload) || this.state.workload.isWaypoint)) {
      const envoyTab = (
        <Tab title="Envoy" eventKey={10} key="Envoy">
          {this.state.workload && (
            <EnvoyDetails
              lastRefreshAt={this.props.lastRefreshAt}
              namespace={this.props.workloadId.namespace}
              workload={this.state.workload}
            />
          )}
        </Tab>
      );
      tabsArray.push(envoyTab);
      paramToTab['envoy'] = 10;
    }

    if (this.state.workload && this.state.workload.isZtunnel) {
      const ztunnelTab = (
        <Tab title="Ztunnel" eventKey={11} key="Ztunnel">
          {this.state.workload && (
            <ZtunnelConfig
              lastRefreshAt={this.props.lastRefreshAt}
              rangeDuration={this.props.rangeDuration}
              namespace={this.props.workloadId.namespace}
              workload={this.state.workload}
            />
          )}
        </Tab>
      );
      tabsArray.push(ztunnelTab);
      paramToTab['ztunnel'] = 11;
    }

    if (this.state.workload && this.state.workload.isWaypoint) {
      const waypointTab = (
        <Tab title="Waypoint" eventKey={12} key="Waypoint">
          {this.state.workload && <WaypointConfig workload={this.state.workload} />}
        </Tab>
      );
      tabsArray.push(waypointTab);
      paramToTab['waypoint'] = 12;
    }

    // Used by the runtimes tabs
    nextTabIndex = tabsArray.length + 1;

    return tabsArray;
  }

  private hasIstioSidecars(workload: Workload): boolean {
    let hasIstioSidecars = false;

    if (workload.pods.length > 0) {
      workload.pods.forEach(pod => {
        if (pod.istioContainers && pod.istioContainers.length > 0) {
          hasIstioSidecars = true;
        } else if (pod.istioInitContainers && pod.istioInitContainers.some(cont => cont.name === istioProxyName)) {
          hasIstioSidecars = true;
        } else {
          // Ztunnel doesn't have Envoy
          hasIstioSidecars =
            hasIstioSidecars ||
            (!!pod.containers && pod.containers.some(cont => cont.name === istioProxyName && !workload.isZtunnel));
        }
      });
    }

    return hasIstioSidecars;
  }

  private runtimeTabs(): React.ReactNode[] {
    const tabs: React.ReactNode[] = [];

    if (this.state.workload) {
      const appLabelName = getAppLabelName(this.state.workload.labels);
      const verLabelName = getVersionLabelName(this.state.workload.labels);
      const app = appLabelName ? this.state.workload.labels[appLabelName] : undefined;
      const version = verLabelName ? this.state.workload.labels[verLabelName] : undefined;
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
                  <CustomMetrics
                    app={app}
                    appLabelName={appLabelName}
                    lastRefreshAt={this.props.lastRefreshAt}
                    namespace={this.props.workloadId.namespace}
                    template={dashboard.template}
                    version={version}
                    versionLabelName={verLabelName}
                    workload={this.state.workload!.name}
                    workloadType={this.state.workload!.gvk.Kind}
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

  private renderTabs(): React.ReactNode[] {
    // PF4 Tabs doesn't support static tabs followed of an array of tabs created dynamically.
    return this.staticTabs().concat(this.runtimeTabs());
  }

  render(): React.ReactNode {
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
          namespace={this.props.workloadId.namespace}
          workload={this.state.workload}
          onChange={this.fetchWorkload}
        />
      ) : undefined;

    return (
      <>
        <RenderHeader rightToolbar={<TimeControl customDuration={useCustomTime} />} actionsToolbar={actionsToolbar} />

        {this.state.error && <ErrorSection error={this.state.error} />}

        {this.state.workload && (
          <ParameterizedTabs
            id="basic-tabs"
            className={basicTabStyle}
            onSelect={tabValue => {
              this.setState({ currentTab: tabValue, cluster: this.state.cluster });
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

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  duration: durationSelector(state),
  rangeDuration: timeRangeSelector(state),
  tracingInfo: state.tracingState.info
});

export const WorkloadDetailsPage = connectRefresh(connect(mapStateToProps)(WorkloadDetailsPageComponent));
