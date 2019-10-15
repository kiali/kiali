import * as React from 'react';
import * as API from '../../services/Api';
import { RouteComponentProps } from 'react-router-dom';
import { App, AppId } from '../../types/App';
import { Tab } from '@patternfly/react-core';
import AppInfo from './AppInfo';
import * as MessageCenter from '../../utils/MessageCenter';
import IstioMetricsContainer from '../../components/Metrics/IstioMetrics';
import { AppHealth } from '../../types/Health';
import { MetricsObjectTypes } from '../../types/Metrics';
import CustomMetricsContainer from '../../components/Metrics/CustomMetrics';
import BreadcrumbView from '../../components/BreadcrumbView/BreadcrumbView';
import { GraphDefinition, GraphType, NodeParamsType, NodeType } from '../../types/Graph';
import { fetchTrafficDetails } from '../../helpers/TrafficDetailsHelper';
import TrafficDetails from '../../components/Metrics/TrafficDetails';
import MetricsDuration from '../../components/MetricsOptions/MetricsDuration';
import PfTitle from '../../components/Pf/PfTitle';
import { DurationInSeconds } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { durationSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import { DurationDropdownContainer } from '../../components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';

type AppDetailsState = {
  app: App;
  health?: AppHealth;
  trafficData: GraphDefinition | null;
  // currentTab is needed to (un)mount tab components
  // when the tab is not rendered.
  currentTab: string;
};

type ReduxProps = {
  duration: DurationInSeconds;
};

type AppDetailsProps = RouteComponentProps<AppId> & ReduxProps;

const emptyApp = {
  namespace: { name: '' },
  name: '',
  workloads: [],
  serviceNames: [],
  runtimes: []
};

const tabName = 'tab';
const defaultTab = 'info';
const trafficTabName = 'traffic';
const paramToTab: { [key: string]: number } = {
  info: 0,
  traffic: 1,
  in_metrics: 2,
  out_metrics: 3
};

class AppDetails extends React.Component<AppDetailsProps, AppDetailsState> {
  constructor(props: AppDetailsProps) {
    super(props);
    this.state = {
      app: emptyApp,
      trafficData: null,
      currentTab: activeTab(tabName, defaultTab)
    };
  }

  componentDidMount(): void {
    this.doRefresh();
  }

  componentDidUpdate(prevProps: AppDetailsProps) {
    if (
      this.props.match.params.namespace !== prevProps.match.params.namespace ||
      this.props.match.params.app !== prevProps.match.params.app ||
      this.state.currentTab !== activeTab(tabName, defaultTab) ||
      this.props.duration !== prevProps.duration
    ) {
      this.setState(
        {
          app: emptyApp,
          health: undefined,
          currentTab: activeTab(tabName, defaultTab)
        },
        () => this.doRefresh()
      );
    }
  }

  fetchTrafficDataOnTabChange = (tabValue: string): void => {
    if (tabValue === trafficTabName && this.state.trafficData == null) {
      this.fetchTrafficData();
    }
  };

  doRefresh = () => {
    const currentTab = this.state.currentTab;

    if (this.state.app === emptyApp || currentTab === defaultTab) {
      this.setState({ trafficData: null });
      this.fetchApp();
    }

    if (currentTab === trafficTabName) {
      this.fetchTrafficData();
    }
  };

  fetchApp = () => {
    API.getApp(this.props.match.params.namespace, this.props.match.params.app)
      .then(details => {
        this.setState({ app: details.data });
        const hasSidecar = details.data.workloads.some(w => w.istioSidecar);
        return API.getAppHealth(
          this.props.match.params.namespace,
          this.props.match.params.app,
          this.props.duration,
          hasSidecar
        );
      })
      .then(health => this.setState({ health: health }))
      .catch(error => {
        MessageCenter.addError('Could not fetch App Details.', error);
      });
  };

  fetchTrafficData = () => {
    const node: NodeParamsType = {
      app: this.props.match.params.app,
      namespace: { name: this.props.match.params.namespace },
      nodeType: NodeType.APP,

      // unneeded
      workload: '',
      service: '',
      version: ''
    };
    const restParams = {
      duration: `${MetricsDuration.initialDuration()}s`,
      graphType: GraphType.APP,
      injectServiceNodes: true,
      appenders: 'deadNode,serviceEntry'
    };

    fetchTrafficDetails(node, restParams).then(trafficData => {
      if (trafficData !== undefined) {
        this.setState({ trafficData: trafficData });
      }
    });
  };

  istioSidecar() {
    let istioSidecar = true; // assume true until proven otherwise
    this.state.app.workloads.forEach(wkd => {
      istioSidecar = istioSidecar && wkd.istioSidecar;
    });
    return istioSidecar;
  }

  runtimeTabs() {
    const staticTabsCount = 4;
    let dynamicTabsCount: number = 0;

    const tabs: JSX.Element[] = [];
    this.state.app.runtimes.forEach(runtime => {
      runtime.dashboardRefs.forEach(dashboard => {
        const tabKey = dynamicTabsCount + staticTabsCount;
        paramToTab[dashboard.template] = tabKey;

        const tab = (
          <Tab title={dashboard.title} key={dashboard.template} eventKey={tabKey}>
            {this.state.currentTab === dashboard.template ? (
              <CustomMetricsContainer
                namespace={this.props.match.params.namespace}
                app={this.props.match.params.app}
                template={dashboard.template}
              />
            ) : (
              undefined
            )}
          </Tab>
        );
        tabs.push(tab);
        dynamicTabsCount = dynamicTabsCount + 1;
      });
    });

    return tabs;
  }

  staticTabs() {
    const overTab = (
      <Tab title="Overview" eventKey={0} key={'Overview'}>
        {this.state.currentTab === 'info' ? (
          <AppInfo app={this.state.app} namespace={this.props.match.params.namespace} health={this.state.health} />
        ) : (
          undefined
        )}
      </Tab>
    );

    const trafficTab = (
      <Tab title="Traffic" eventKey={1} key={'Traffic'}>
        {this.state.currentTab === 'traffic' ? (
          <TrafficDetails
            trafficData={this.state.trafficData}
            itemType={MetricsObjectTypes.APP}
            namespace={this.state.app.namespace.name}
            appName={this.state.app.name}
            onDurationChanged={this.fetchTrafficData}
            onRefresh={this.doRefresh}
          />
        ) : (
          undefined
        )}
      </Tab>
    );

    const inTab = (
      <Tab title="Inbound Metrics" eventKey={2} key={'Inbound Metrics'}>
        {this.state.currentTab === 'in_metrics' ? (
          <IstioMetricsContainer
            namespace={this.props.match.params.namespace}
            object={this.props.match.params.app}
            objectType={MetricsObjectTypes.APP}
            direction={'inbound'}
          />
        ) : (
          undefined
        )}
      </Tab>
    );

    const outTab = (
      <Tab title="Outbound Metrics" eventKey={3} key={'Outbound Metrics'}>
        {this.state.currentTab === 'out_metrics' ? (
          <IstioMetricsContainer
            namespace={this.props.match.params.namespace}
            object={this.props.match.params.app}
            objectType={MetricsObjectTypes.APP}
            direction={'outbound'}
          />
        ) : (
          undefined
        )}
      </Tab>
    );

    return [overTab, trafficTab, inTab, outTab];
  }

  renderActions = () => {
    return (
      <span style={{ position: 'absolute', right: '50px', zIndex: 1 }}>
        <DurationDropdownContainer id="app-info-duration-dropdown" />
        <RefreshButtonContainer handleRefresh={this.doRefresh} />
      </span>
    );
  };

  renderTabs() {
    // PF4 Tabs doesn't support static tabs followed of an array of tabs created dynamically.
    return this.staticTabs().concat(this.runtimeTabs());
  }

  render() {
    const istioSidecar = this.istioSidecar();

    return (
      <>
        <BreadcrumbView location={this.props.location} />
        <PfTitle location={this.props.location} istio={istioSidecar} />
        {this.state.currentTab === 'info' && this.renderActions()}
        <ParameterizedTabs
          id="basic-tabs"
          onSelect={tabValue => {
            this.setState({ currentTab: tabValue });
          }}
          tabMap={paramToTab}
          tabName={tabName}
          defaultTab={defaultTab}
          postHandler={this.fetchTrafficDataOnTabChange}
          activeTab={this.state.currentTab}
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
