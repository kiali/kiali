import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import { Tab } from '@patternfly/react-core';

import * as API from '../../services/Api';
import { App, AppId } from '../../types/App';
import AppInfo from './AppInfo';
import * as AlertUtils from '../../utils/AlertUtils';
import IstioMetricsContainer from '../../components/Metrics/IstioMetrics';
import { MetricsObjectTypes } from '../../types/Metrics';
import CustomMetricsContainer from '../../components/Metrics/CustomMetrics';
import { RenderHeader } from '../../components/Nav/Page';
import TrafficDetails from '../../components/Metrics/TrafficDetails';
import { DurationInSeconds } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { durationSelector } from '../../store/Selectors';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';

type AppDetailsState = {
  app?: App;
  // currentTab is needed to (un)mount tab components
  // when the tab is not rendered.
  currentTab: string;
};

type ReduxProps = {
  duration: DurationInSeconds;
};

type AppDetailsProps = RouteComponentProps<AppId> & ReduxProps;

const tabName = 'tab';
const defaultTab = 'info';
const paramToTab: { [key: string]: number } = {
  info: 0,
  traffic: 1,
  in_metrics: 2,
  out_metrics: 3
};

class AppDetails extends React.Component<AppDetailsProps, AppDetailsState> {
  constructor(props: AppDetailsProps) {
    super(props);
    this.state = { currentTab: activeTab(tabName, defaultTab) };
  }

  componentDidMount(): void {
    this.fetchApp();
  }

  componentDidUpdate(prevProps: AppDetailsProps) {
    if (
      this.props.match.params.namespace !== prevProps.match.params.namespace ||
      this.props.match.params.app !== prevProps.match.params.app ||
      this.state.currentTab !== activeTab(tabName, defaultTab) ||
      this.props.duration !== prevProps.duration
    ) {
      this.setState({ currentTab: activeTab(tabName, defaultTab) });
      this.fetchApp();
    }
  }

  private fetchApp = () => {
    API.getApp(this.props.match.params.namespace, this.props.match.params.app)
      .then(details => this.setState({ app: details.data }))
      .catch(error => AlertUtils.addError('Could not fetch App Details.', error));
  };

  private runtimeTabs() {
    const staticTabsCount = 4;
    let dynamicTabsCount: number = 0;

    const tabs: JSX.Element[] = [];
    if (this.state.app) {
      this.state.app.runtimes.forEach(runtime => {
        runtime.dashboardRefs.forEach(dashboard => {
          const tabKey = dynamicTabsCount + staticTabsCount;
          paramToTab[dashboard.template] = tabKey;

          const tab = (
            <Tab title={dashboard.title} key={dashboard.template} eventKey={tabKey}>
              <CustomMetricsContainer
                namespace={this.props.match.params.namespace}
                app={this.props.match.params.app}
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

  private staticTabs() {
    const overTab = (
      <Tab title="Overview" eventKey={0} key={'Overview'}>
        <AppInfo app={this.state.app} duration={this.props.duration} onRefresh={this.fetchApp} />
      </Tab>
    );

    const trafficTab = (
      <Tab title="Traffic" eventKey={1} key={'Traffic'}>
        <TrafficDetails
          itemType={MetricsObjectTypes.APP}
          namespace={this.props.match.params.namespace}
          appName={this.props.match.params.app}
          duration={this.props.duration}
        />
      </Tab>
    );

    const inTab = (
      <Tab title="Inbound Metrics" eventKey={2} key={'Inbound Metrics'}>
        <IstioMetricsContainer
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
          namespace={this.props.match.params.namespace}
          object={this.props.match.params.app}
          objectType={MetricsObjectTypes.APP}
          direction={'outbound'}
        />
      </Tab>
    );

    return [overTab, trafficTab, inTab, outTab];
  }

  private renderTabs() {
    // PF4 Tabs doesn't support static tabs followed of an array of tabs created dynamically.
    return this.staticTabs().concat(this.runtimeTabs());
  }

  render() {
    return (
      <>
        <RenderHeader location={this.props.location}>
          {
            // This magic space will align details header width with Graph, List pages
          }
          <div style={{ paddingBottom: 14 }} />
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
          mountOnEnter={true}
          unmountOnExit={true}
        >
          {this.renderTabs()}
        </ParameterizedTabs>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state)
});

const AppDetailsContainer = connect(mapStateToProps)(AppDetails);

export default AppDetailsContainer;
