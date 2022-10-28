import * as React from 'react';
import { connect } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { namespaceItemsSelector } from 'store/Selectors';
import Namespace from 'types/Namespace';
import { RenderComponentScroll } from 'components/Nav/Page';
import {TimeInMilliseconds} from "../../types/Common";
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Grid,
  GridItem,
  Tab, Tabs,
  Title,
  TitleSizes
} from "@patternfly/react-core";
import WorkloadInfo from "../../pages/WorkloadDetails/WorkloadInfo";
import {serverConfig} from "../../config";
import {WorkloadPodLogs} from "../../pages/WorkloadDetails/WorkloadPodLogs";
import * as API from "../../services/Api";
import {WorkloadHealth} from "../../types/Health";
import * as AlertUtils from "../../utils/AlertUtils";
import {ErrorMsg} from "../../types/ErrorMsg";
import {Workload} from "../../types/Workload";
import {
  defaultTab as workloadDefaultTab,
  tabName as workloadTabName,
  tabName
} from "../../pages/WorkloadDetails/WorkloadDetailsPage";
import history from "../../app/History";
import {activeTab} from "../Tab/Tabs";

const waypointTabs = ['Details', 'Logs'];
const defaultTab = "Details";

type ReduxProps = {
  kiosk: string;
  namespaces: Namespace[];
};

type WaypointDetailsProps = ReduxProps & {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  workloadName: string;
  duration: number;
};

type WaypointDetailsState = {
  workload: Workload | null;
  health?: WorkloadHealth;
  currentTab: string;
  error?: ErrorMsg;
  tabHeight?: number;
  activeKey: number;
}

class WaypointDetails extends React.Component<WaypointDetailsProps, WaypointDetailsState> {

  _fetchRequest: Promise<void> | null;

  constructor(props: WaypointDetailsProps) {
    super(props);
    this._fetchRequest = this.fetchWorkload();
    this.state = {
      workload: null,
      currentTab: waypointTabs[0],
      activeKey: 0,
    }
  }

  componentDidUpdate(_prevProps: WaypointDetailsProps) {
    const currentTabIndex = waypointTabs.indexOf(activeTab(tabName, defaultTab));
    if (currentTabIndex !== this.state.activeKey && currentTabIndex !== -1) {
      this.setState({ activeKey: currentTabIndex });
    }
  }

  private fetchWorkload = async () => {
    const params: { [key: string]: string } = {
      validate: 'true',
      health: 'true'
    };
    await API.getWorkload(this.props.namespace, this.props.workloadName, params)
      .then(details => {
        this.setState({
          workload: details.data,
          health: WorkloadHealth.fromJson(
            this.props.namespace,
            this.props.workloadName,
            details.data.health,
            { rateInterval: this.props.duration, hasSidecar: details.data.istioSidecar, hasAmbient: details.data.istioAmbient }
          )
        });
        this._fetchRequest = null;
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch Workload.', error);
        const msg : ErrorMsg = {title: 'No Workload is selected', description: this.props.workloadName +" is not found in the mesh"};
        this.setState({error: msg});
      });
  };

  private renderTabs() {
    const tabsArray: JSX.Element[] = [];

    if (this.state.workload) {
      const overTab = (
        <Tab title="Details" eventKey={0} key={'Details'} style={{ backgroundColor: 'white' }}>
          <WorkloadInfo
            workload={this.state.workload}
            duration={this.props.duration}
            health={this.state.health}
            namespace={this.props.namespace}
            refreshWorkload={this.fetchWorkload}
          />
        </Tab>
      );
      tabsArray.push(overTab);
    }

    if (!serverConfig.kialiFeatureFlags.disabledFeatures?.includes('logs-tab') && this.state.workload != null) {
      const logTab = (
        <Tab title="Logs" eventKey={1} key={'Logs'} style={{ backgroundColor: 'white' }}>
          {this.state.workload.pods ? (
            <WorkloadPodLogs
              lastRefreshAt={this.props.lastRefreshAt}
              namespace={this.props.namespace}
              workload={this.props.workloadName}
              pods={this.state.workload.pods}
              kiosk={""}
              timeRange={ {rangeDuration: 120 }}
             />
          ) : (
            <EmptyState variant={EmptyStateVariant.full}>
              <Title headingLevel="h5" size={TitleSizes.lg}>
                No logs for Workload {this.props.workloadName}
              </Title>
              <EmptyStateBody>There are no logs to display because the waypoint proxy has no pods.</EmptyStateBody>
            </EmptyState>
          )}
        </Tab>
      );
      tabsArray.push(logTab);
    }

    return tabsArray;
  }

  handleTabChange = (_event, tabIndex) => {
    const resourceIdx: number = +tabIndex;
    const targetResource: string = waypointTabs[resourceIdx];
    if (resourceIdx !== this.state.activeKey) {
      this.setState({
        activeKey: tabIndex
      });
      const mainTab = new URLSearchParams(history.location.search).get(workloadTabName) || workloadDefaultTab
      const urlParams = new URLSearchParams('');
      urlParams.set(tabName, targetResource);
      urlParams.set(workloadTabName, mainTab);
      history.push(history.location.pathname + '?' + urlParams.toString());
    }
  };

  render() {

    return (
      <RenderComponentScroll onResize={height => this.setState({ tabHeight: height })}>
        <Grid>
          <GridItem span={12}>
            <Tabs
              id="waypoint-details"
              activeKey={this.state.activeKey}
              onSelect={this.handleTabChange}
              mountOnEnter={true}
              unmountOnExit={true}
            >
              {this.renderTabs()}
            </Tabs>
          </GridItem>
        </Grid>
      </RenderComponentScroll>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  kiosk: state.globalState.kiosk,
  namespaces: namespaceItemsSelector(state)!
});

const WaypointDetailsContainer = connect(mapStateToProps)(WaypointDetails);

export default WaypointDetailsContainer;
