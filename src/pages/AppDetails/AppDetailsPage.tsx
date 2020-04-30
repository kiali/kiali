import * as React from 'react';
import * as API from '../../services/Api';
import { RouteComponentProps } from 'react-router-dom';
import { App, AppId } from '../../types/App';
import { Tab } from '@patternfly/react-core';
import AppInfo from './AppInfo';
import * as AlertUtils from '../../utils/AlertUtils';
import IstioMetricsContainer from '../../components/Metrics/IstioMetrics';
import { AppHealth } from '../../types/Health';
import { MetricsObjectTypes } from '../../types/Metrics';
import CustomMetricsContainer from '../../components/Metrics/CustomMetrics';
import { RenderHeader } from '../../components/Nav/Page';
import { EdgeLabelMode, GraphDefinition, GraphType, NodeType } from '../../types/Graph';
import TrafficDetails from '../../components/Metrics/TrafficDetails';
import { DurationInSeconds } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { durationSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import { DurationDropdownContainer } from '../../components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';
import GraphDataSource from '../../services/GraphDataSource';

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
  private graphDataSource: GraphDataSource;

  constructor(props: AppDetailsProps) {
    super(props);
    this.state = {
      app: emptyApp,
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

  componentWillUnmount(): void {
    this.graphDataSource.removeListener('fetchSuccess', this.graphDsFetchSuccess);
    this.graphDataSource.removeListener('fetchError', this.graphDsFetchError);
  }

  doRefresh = () => {
    const currentTab = this.state.currentTab;

    if (this.state.app === emptyApp || currentTab === defaultTab) {
      this.setState({ trafficData: null });
      this.fetchApp();
      this.loadMiniGraphData();
    }

    if (currentTab === trafficTabName) {
      // Since traffic tab shares data with mini-graph, we reload mini-graph data.
      this.loadMiniGraphData();
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
        AlertUtils.addError('Could not fetch App Details.', error);
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

    return tabs;
  }

  staticTabs() {
    const overTab = (
      <Tab title="Overview" eventKey={0} key={'Overview'}>
        <AppInfo
          app={this.state.app}
          namespace={this.props.match.params.namespace}
          health={this.state.health}
          miniGraphDataSource={this.graphDataSource}
        />
      </Tab>
    );

    const trafficTab = (
      <Tab title="Traffic" eventKey={1} key={'Traffic'}>
        <TrafficDetails
          trafficData={this.state.trafficData}
          itemType={MetricsObjectTypes.APP}
          namespace={this.state.app.namespace.name}
          appName={this.state.app.name}
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

  renderActions = () => {
    let component;
    switch (this.state.currentTab) {
      case 'info':
        component = <DurationDropdownContainer id="app-info-duration-dropdown" prefix="Last" />;
        break;
      case 'traffic':
        component = <DurationDropdownContainer id="app-traffic-duration-dropdown" prefix="Last" />;
        break;
      default:
        return undefined;
    }
    // Align actions style with other pages
    return (
      <span style={{ position: 'absolute', right: '18px', zIndex: 1 }}>
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
          {
            // This magic space will align details header width with Graph, List pages
          }
          <div style={{ paddingBottom: 14 }} />
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
      graphType: GraphType.APP,
      injectServiceNodes: true,
      edgeLabelMode: EdgeLabelMode.NONE,
      showSecurity: false,
      showUnusedNodes: false,
      node: {
        app: this.props.match.params.app,
        namespace: { name: this.props.match.params.namespace },
        nodeType: NodeType.APP,
        service: '',
        version: '',
        workload: ''
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

const AppDetailsContainer = connect(mapStateToProps)(AppDetails);

export default AppDetailsContainer;
