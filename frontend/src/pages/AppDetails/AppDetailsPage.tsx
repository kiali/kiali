import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { Tab } from '@patternfly/react-core';

import * as API from '../../services/Api';
import { App, AppId } from '../../types/App';
import AppInfo from './AppInfo';
import * as AlertUtils from '../../utils/AlertUtils';
import IstioMetricsContainer from '../../components/Metrics/IstioMetrics';
import { MetricsObjectTypes } from '../../types/Metrics';
import CustomMetricsContainer from '../../components/Metrics/CustomMetrics';
import { DurationInSeconds, TimeInMilliseconds, TimeRange } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { durationSelector } from '../../store/Selectors';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import { JaegerInfo } from '../../types/JaegerInfo';
import TracesComponent from '../../components/JaegerIntegration/TracesComponent';
import TrafficDetails from 'components/TrafficList/TrafficDetails';
import TimeControl from '../../components/Time/TimeControl';
import { AppHealth } from 'types/Health';
import RenderHeaderContainer from "../../components/Nav/Page/RenderHeader";

type AppDetailsState = {
  app?: App;
  health?: AppHealth;
  // currentTab is needed to (un)mount tab components
  // when the tab is not rendered.
  currentTab: string;
};

type ReduxProps = {
  duration: DurationInSeconds;
  jaegerInfo?: JaegerInfo;
  lastRefreshAt: TimeInMilliseconds;
  timeRange: TimeRange;
};

type AppDetailsProps = RouteComponentProps<AppId> & ReduxProps;

const tabName = 'tab';
const defaultTab = 'info';
const tracesTabName = 'traces';
const paramToTab: { [key: string]: number } = {
  info: 0,
  traffic: 1,
  in_metrics: 2,
  out_metrics: 3,
  traces: 4
};
const nextTabIndex = 5;

class AppDetails extends React.Component<AppDetailsProps, AppDetailsState> {
  constructor(props: AppDetailsProps) {
    super(props);
    this.state = { currentTab: activeTab(tabName, defaultTab) };
  }

  componentDidMount(): void {
    this.fetchApp();
  }

  componentDidUpdate(prevProps: AppDetailsProps) {
    const currentTab = activeTab(tabName, defaultTab);
    if (
      this.props.match.params.namespace !== prevProps.match.params.namespace ||
      this.props.match.params.app !== prevProps.match.params.app ||
      this.props.lastRefreshAt !== prevProps.lastRefreshAt ||
      currentTab !== this.state.currentTab ||
      this.props.duration !== prevProps.duration
    ) {
      if (currentTab === 'info') {
        this.fetchApp();
      }
      if (currentTab !== this.state.currentTab) {
        this.setState({ currentTab: currentTab });
      }
    }
  }

  private fetchApp = () => {
    const params: { [key: string]: string } = { rateInterval: String(this.props.duration) + 's', health: 'true' };
    API.getApp(this.props.match.params.namespace, this.props.match.params.app, params)
      .then(details => {
        this.setState({
          app: details.data,
          health: AppHealth.fromJson(
            this.props.match.params.namespace,
            this.props.match.params.app,
            details.data.health,
            { rateInterval: this.props.duration, hasSidecar: details.data.workloads.some(w => w.istioSidecar) }
          )
        });
      })
      .catch(error => AlertUtils.addError('Could not fetch App Details.', error));
  };

  private runtimeTabs() {
    let tabOffset = 0;

    const tabs: JSX.Element[] = [];
    if (this.state.app) {
      this.state.app.runtimes.forEach(runtime => {
        runtime.dashboardRefs.forEach(dashboard => {
          if (dashboard.template !== 'envoy') {
            const tabKey = tabOffset + nextTabIndex;
            paramToTab['cd-' + dashboard.template] = tabKey;

            const tab = (
              <Tab title={dashboard.title} key={'cd-' + dashboard.template} eventKey={tabKey}>
                <CustomMetricsContainer
                  namespace={this.props.match.params.namespace}
                  app={this.props.match.params.app}
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

    return tabs;
  }

  private staticTabs() {
    const overTab = (
      <Tab title="Overview" eventKey={0} key={'Overview'}>
        <AppInfo app={this.state.app} duration={this.props.duration} health={this.state.health} />
      </Tab>
    );

    const trafficTab = (
      <Tab title="Traffic" eventKey={1} key={'Traffic'}>
        <TrafficDetails
          itemName={this.props.match.params.app}
          itemType={MetricsObjectTypes.APP}
          namespace={this.props.match.params.namespace}
        />
      </Tab>
    );

    const inTab = (
      <Tab title="Inbound Metrics" eventKey={2} key={'Inbound Metrics'}>
        <IstioMetricsContainer
          data-test="inbound-metrics-component"
          namespace={this.props.match.params.namespace}
          object={this.props.match.params.app}
          objectType={MetricsObjectTypes.APP}
          direction={'inbound'}
        />
      </Tab>
    );

    const outTab = (
      <Tab title="Outbound Metrics" eventKey={3} key={'Outbound Metrics'}>
        <IstioMetricsContainer
          data-test="outbound-metrics-component"
          namespace={this.props.match.params.namespace}
          object={this.props.match.params.app}
          objectType={MetricsObjectTypes.APP}
          direction={'outbound'}
        />
      </Tab>
    );

    // Default tabs
    const tabsArray: JSX.Element[] = [overTab, trafficTab, inTab, outTab];

    // Conditional Traces tab
    if (this.props.jaegerInfo && this.props.jaegerInfo.enabled) {
      if (this.props.jaegerInfo.integration) {
        tabsArray.push(
          <Tab eventKey={4} style={{ textAlign: 'center' }} title={'Traces'} key={tracesTabName}>
            <TracesComponent
              namespace={this.props.match.params.namespace}
              target={this.props.match.params.app}
              targetKind={'app'}
            />
          </Tab>
        );
      } else {
        const service = this.props.jaegerInfo.namespaceSelector
          ? this.props.match.params.app + '.' + this.props.match.params.namespace
          : this.props.match.params.app;
        tabsArray.push(
          <Tab
            eventKey={4}
            href={this.props.jaegerInfo.url + `/search?service=${service}`}
            target="_blank"
            title={
              <>
                Traces <ExternalLinkAltIcon />
              </>
            }
          />
        );
      }
    }

    return tabsArray;
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
      case 'traces':
        useCustomTime = true;
        break;
    }
    return (
      <>
        <RenderHeaderContainer location={this.props.location} rightToolbar={<TimeControl customDuration={useCustomTime} />} />
        {this.state.app && (
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
  lastRefreshAt: state.globalState.lastRefreshAt
});

const AppDetailsContainer = connect(mapStateToProps)(AppDetails);
export default AppDetailsContainer;
