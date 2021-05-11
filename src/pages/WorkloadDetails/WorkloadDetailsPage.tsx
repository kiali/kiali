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
import { TimeInMilliseconds } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import TracesComponent from 'components/JaegerIntegration/TracesComponent';
import { JaegerInfo } from 'types/JaegerInfo';
import TrafficDetails from 'components/TrafficList/TrafficDetails';
import WorkloadWizardDropdown from '../../components/IstioWizards/WorkloadWizardDropdown';
import TimeControl from '../../components/Time/TimeControl';

type WorkloadDetailsState = {
  workload?: Workload;
  currentTab: string;
};

type WorkloadDetailsPageProps = RouteComponentProps<WorkloadId> & {
  jaegerInfo?: JaegerInfo;
  lastRefreshAt: TimeInMilliseconds;
};

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
const nextTabIndex = 6;

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
      currentTab !== this.state.currentTab
    ) {
      if (currentTab === 'info' || currentTab === 'logs') {
        this.fetchWorkload();
      }
      if (currentTab !== this.state.currentTab) {
        this.setState({ currentTab: currentTab });
      }
    }
  }

  private fetchWorkload = () => {
    API.getWorkload(this.props.match.params.namespace, this.props.match.params.workload)
      .then(details => {
        this.setState({
          workload: details.data
        });
      })
      .catch(error => AlertUtils.addError('Could not fetch Workload.', error));
  };

  private staticTabs() {
    const hasPods = this.state.workload?.pods.length;

    const overTab = (
      <Tab title="Overview" eventKey={0} key={'Overview'}>
        <WorkloadInfo
          workload={this.state.workload}
          namespace={this.props.match.params.namespace}
          refreshWorkload={this.fetchWorkload}
        />
      </Tab>
    );
    const trafficTab = (
      <Tab title="Traffic" eventKey={1} key={'Traffic'}>
        <TrafficDetails
          itemName={this.props.match.params.workload}
          itemType={MetricsObjectTypes.WORKLOAD}
          namespace={this.props.match.params.namespace}
        />
      </Tab>
    );
    const logTab = (
      <Tab title="Logs" eventKey={2} key={'Logs'}>
        {hasPods ? (
          <WorkloadPodLogs namespace={this.props.match.params.namespace} pods={this.state.workload!.pods} />
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

    const tabsArray: JSX.Element[] = [overTab, trafficTab, logTab, inTab, outTab];

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

    return tabsArray;
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
            const tabKey = tabOffset + nextTabIndex;
            paramToTab[dashboard.template] = tabKey;
            const tab = (
              <Tab key={dashboard.template} title={dashboard.title} eventKey={tabKey}>
                <CustomMetricsContainer
                  namespace={this.props.match.params.namespace}
                  app={app}
                  version={version}
                  workload={this.state.workload!.name}
                  template={dashboard.template}
                />
              </Tab>
            );
            tabs.push(tab);
            tabOffset++;
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
  jaegerInfo: state.jaegerState.info,
  lastRefreshAt: state.globalState.lastRefreshAt
});

const WorkloadDetailsContainer = connect(mapStateToProps)(WorkloadDetails);

export default WorkloadDetailsContainer;
