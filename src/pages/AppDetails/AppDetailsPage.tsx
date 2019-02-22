import * as React from 'react';
import * as API from '../../services/Api';
import { RouteComponentProps } from 'react-router-dom';
import { AppId, App } from '../../types/App';
import { authentication } from '../../utils/Authentication';
import { TabContainer, Nav, NavItem, TabContent, TabPane } from 'patternfly-react';
import AppInfo from './AppInfo';
import * as MessageCenter from '../../utils/MessageCenter';
import AppMetricsContainer from '../../containers/AppMetricsContainer';
import { AppHealth } from '../../types/Health';
import { MetricsObjectTypes } from '../../types/Metrics';
import CustomMetricsContainer from '../../components/Metrics/CustomMetrics';
import BreadcrumbView from '../../components/BreadcrumbView/BreadcrumbView';
import { GraphDefinition, GraphType, NodeParamsType, NodeType } from '../../types/Graph';
import { fetchTrafficDetails } from '../../helpers/TrafficDetailsHelper';
import TrafficDetails from '../../components/Metrics/TrafficDetails';

type AppDetailsState = {
  app: App;
  health?: AppHealth;
  trafficData: GraphDefinition | null;
};

const emptyApp = {
  namespace: { name: '' },
  name: '',
  workloads: [],
  serviceNames: [],
  runtimes: []
};

class AppDetails extends React.Component<RouteComponentProps<AppId>, AppDetailsState> {
  constructor(props: RouteComponentProps<AppId>) {
    super(props);
    this.state = {
      app: emptyApp,
      trafficData: null
    };
    this.doRefresh();
  }

  componentDidUpdate(prevProps: RouteComponentProps<AppId>) {
    if (
      this.props.match.params.namespace !== prevProps.match.params.namespace ||
      this.props.match.params.app !== prevProps.match.params.app
    ) {
      this.setState(
        {
          app: emptyApp,
          health: undefined
        },
        () => this.doRefresh()
      );
    }
  }

  doRefresh = () => {
    const currentTab = this.activeTab('tab', 'info');

    if (this.state.app === emptyApp || currentTab === 'info') {
      this.setState({ trafficData: null });
      this.fetchApp();
    }

    if (currentTab === 'traffic') {
      this.fetchTrafficData();
    }
  };

  fetchApp = () => {
    API.getApp(authentication(), this.props.match.params.namespace, this.props.match.params.app)
      .then(details => {
        this.setState({ app: details.data });
        const hasSidecar = details.data.workloads.some(w => w.istioSidecar);
        return API.getAppHealth(
          authentication(),
          this.props.match.params.namespace,
          this.props.match.params.app,
          600,
          hasSidecar
        );
      })
      .then(health => this.setState({ health: health }))
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not fetch App Details', error));
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
      duration: `${TrafficDetails.defaultDuration}s`,
      graphType: GraphType.APP,
      injectServiceNodes: true,
      appenders: 'deadNode'
    };

    fetchTrafficDetails(node, restParams).then(trafficData => {
      if (trafficData !== undefined) {
        this.setState({ trafficData: trafficData });
      }
    });
  };

  render() {
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
              {this.state.app.runtimes.map(runtime => {
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
                <AppInfo
                  app={this.state.app}
                  namespace={this.props.match.params.namespace}
                  onRefresh={this.doRefresh}
                  activeTab={this.activeTab}
                  onSelectTab={this.tabSelectHandler}
                  health={this.state.health}
                />
              </TabPane>
              <TabPane eventKey="traffic">
                <TrafficDetails
                  duration={TrafficDetails.defaultDuration}
                  trafficData={this.state.trafficData}
                  itemType={MetricsObjectTypes.APP}
                  namespace={this.state.app.namespace.name}
                  appName={this.state.app.name}
                  onRefresh={this.doRefresh}
                />
              </TabPane>
              <TabPane eventKey="in_metrics" mountOnEnter={true} unmountOnExit={true}>
                <AppMetricsContainer
                  namespace={this.props.match.params.namespace}
                  object={this.props.match.params.app}
                  objectType={MetricsObjectTypes.APP}
                  direction={'inbound'}
                />
              </TabPane>
              <TabPane eventKey="out_metrics" mountOnEnter={true} unmountOnExit={true}>
                <AppMetricsContainer
                  namespace={this.props.match.params.namespace}
                  object={this.props.match.params.app}
                  objectType={MetricsObjectTypes.APP}
                  direction={'outbound'}
                />
              </TabPane>
              {this.state.app.runtimes.map(runtime => {
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
                        app={this.props.match.params.app}
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

export default AppDetails;
