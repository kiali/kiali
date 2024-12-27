import * as React from 'react';
import { connect } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { IRow, ThProps } from '@patternfly/react-table';
import { Workload } from 'types/Workload';
import { Card, CardBody, Grid, GridItem, Tab, Tabs, Title, TitleSizes } from '@patternfly/react-core';
import { activeTab } from '../../components/Tab/Tabs';
import { RenderComponentScroll } from 'components/Nav/Page';
import { location, router } from '../../app/History';
import {
  tabName as workloadTabName,
  defaultTab as workloadDefaultTab
} from '../../pages/WorkloadDetails/WorkloadDetailsPage';
import { TimeInMilliseconds } from '../../types/Common';
import { subTabStyle } from 'styles/TabStyles';
import { kialiStyle } from '../../styles/StyleUtils';
import { t } from 'i18next';
import { SimpleTable } from '../Table/SimpleTable';
import { WaypointWorkloadsTable } from './WaypointWorkloadsTable';
import { waypintForLabel, WaypointType } from '../../types/Ambient';
import { PodStatus } from '../../pages/WorkloadDetails/PodStatus';

const resources: string[] = ['service', 'workload', 'information'];

const waypointTabs = ['service', 'workload', 'information'];
const tabName = 'waypointTab';

type ReduxProps = {
  kiosk: string;
};

type WaypointConfigProps = ReduxProps & {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  workload: Workload;
};

type WaypointConfigState = {
  activeKey: number;
  fetch: boolean;
  resource: string;
  tabHeight: number;
};

const fullHeightStyle = kialiStyle({
  height: '100%'
});

export const isWaypointFor = (wk: Workload): string => {
  if (wk.labels[waypintForLabel] === WaypointType.Workload) {
    return WaypointType.Workload;
  }
  if (wk.labels[waypintForLabel] === WaypointType.All) {
    return WaypointType.All;
  }
  return WaypointType.Service;
};

const showProxyStatus = (workload: Workload): React.ReactNode => {
  const cols: ThProps[] = [
    { title: 'Pod Name' },
    { title: 'CDS' },
    { title: 'LDS' },
    { title: 'EDS' },
    { title: 'RDS' }
  ];

  const rows: IRow[] = workload.pods.map(pod => {
    const podDetails = (
      <>
        <span style={{ marginRight: '1em' }}>{pod.name}</span> <PodStatus proxyStatus={pod.proxyStatus} />
      </>
    );
    return {
      cells: [podDetails, pod.proxyStatus?.CDS, pod.proxyStatus?.LDS, pod.proxyStatus?.EDS, pod.proxyStatus?.RDS]
    };
  });

  return <SimpleTable label={'Proxy Status'} columns={cols} rows={rows} />;
};

class WaypointConfigComponent extends React.Component<WaypointConfigProps, WaypointConfigState> {
  private waypointFor = isWaypointFor(this.props.workload);
  private defaultTab = this.waypointFor === WaypointType.Workload ? WaypointType.Workload : WaypointType.Service;

  constructor(props: WaypointConfigProps) {
    super(props);
    this.state = {
      tabHeight: 300,
      fetch: true,
      activeKey: waypointTabs.indexOf(activeTab(tabName, this.defaultTab)),
      resource: activeTab(tabName, this.defaultTab)
    };
  }

  componentDidUpdate(_prevProps: WaypointConfigProps, prevState: WaypointConfigState): void {
    const currentTabIndex = waypointTabs.indexOf(activeTab(tabName, this.defaultTab));

    if (this.state.resource !== prevState.resource) {
      if (currentTabIndex !== this.state.activeKey) {
        this.setState({ activeKey: currentTabIndex });
      }
    }
  }

  waypointHandleTabClick = (_event: React.MouseEvent, tabIndex: string | number): void => {
    const resourceIdx: number = +tabIndex;
    const targetResource: string = resources[resourceIdx];

    if (targetResource !== this.state.resource) {
      this.setState({
        fetch: true,
        resource: targetResource,
        activeKey: resourceIdx
      });

      const mainTab = new URLSearchParams(location.getSearch()).get(workloadTabName) ?? workloadDefaultTab;
      const urlParams = new URLSearchParams(location.getSearch());
      urlParams.set(tabName, targetResource);
      urlParams.set(workloadTabName, mainTab);
      router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
    }
  };

  render(): React.ReactNode {
    const tabs: JSX.Element[] = [];

    if (this.waypointFor === WaypointType.Service || this.waypointFor === WaypointType.All) {
      const servicesTab = (
        <Tab title={t('Services')} eventKey={0} key={this.waypointFor}>
          <Card className={fullHeightStyle}>
            <CardBody>
              <div className={fullHeightStyle}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <WaypointWorkloadsTable
                    workloads={this.props.workload.waypointServices ? this.props.workload.waypointServices : []}
                    type={WaypointType.Service}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </Tab>
      );
      tabs.push(servicesTab);
    }

    if (this.waypointFor === WaypointType.Workload || this.waypointFor === WaypointType.All) {
      const workloadsTab = (
        <Tab title={t('Workloads')} eventKey={1} key={this.waypointFor}>
          <Card className={fullHeightStyle}>
            <CardBody>
              <div className={fullHeightStyle}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <WaypointWorkloadsTable
                    workloads={this.props.workload.waypointWorkloads ? this.props.workload.waypointWorkloads : []}
                    type={WaypointType.Workload}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </Tab>
      );
      tabs.push(workloadsTab);
    }

    const infoTab = (
      <Tab title={t('Info')} eventKey={2} key={t('information')}>
        <Card className={fullHeightStyle}>
          <CardBody>
            <div className={fullHeightStyle}>
              <div style={{ marginBottom: '1.25rem' }}>
                <Title headingLevel="h5" size={TitleSizes.md} style={{ marginBottom: '1em' }}>
                  Waypoint for: {this.waypointFor}
                </Title>
                {showProxyStatus(this.props.workload)}
              </div>
            </div>
          </CardBody>
        </Card>
      </Tab>
    );
    tabs.push(infoTab);

    return (
      <RenderComponentScroll onResize={height => this.setState({ tabHeight: height })}>
        <Grid>
          <GridItem span={12}>
            <Tabs
              id="waypoint-details"
              className={subTabStyle}
              activeKey={this.state.activeKey}
              onSelect={this.waypointHandleTabClick}
              mountOnEnter={true}
              unmountOnExit={true}
            >
              {tabs}
            </Tabs>
          </GridItem>
        </Grid>
      </RenderComponentScroll>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

export const WaypointConfig = connect(mapStateToProps)(WaypointConfigComponent);
