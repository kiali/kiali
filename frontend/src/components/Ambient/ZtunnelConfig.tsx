import * as React from 'react';
import { connect } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { Workload } from 'types/Workload';
import { Pod, ZtunnelConfigDump } from 'types/IstioObjects';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { Card, CardBody, Grid, GridItem, Tab, Tabs, TooltipPosition } from '@patternfly/react-core';
import { activeTab } from '../../components/Tab/Tabs';
import { RenderComponentScroll } from 'components/Nav/Page';
import { location, router } from '../../app/History';
import {
  tabName as workloadTabName,
  defaultTab as workloadDefaultTab
} from '../../pages/WorkloadDetails/WorkloadDetailsPage';
import { TimeInMilliseconds } from '../../types/Common';
import { subTabStyle } from 'styles/TabStyles';
import { ToolbarDropdown } from '../Dropdown/ToolbarDropdown';
import { PFBadge, PFBadges } from '../Pf/PfBadges';
import { kialiStyle } from '../../styles/StyleUtils';
import { ZtunnelServicesTable } from './ZtunnelServicesTable';
import { ZtunnelWorkloadsTable } from './ZtunnelWorkloadsTable';
import { t } from 'i18next';
import { SortableTh } from '../Table/SimpleTable';

const resources: string[] = ['services', 'workloads'];

const ztunnelTabs = ['services', 'workloads'];
const tabName = 'ztunnelTab';
const defaultTab = 'services';

type ReduxProps = {
  kiosk: string;
};

type ZtunnelConfigProps = ReduxProps & {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  workload: Workload;
};

type ZtunnelConfigState = {
  activeKey: number;
  config: ZtunnelConfigDump;
  fetch: boolean;
  pod: Pod;
  resource: string;
  tabHeight: number;
};

const fullHeightStyle = kialiStyle({
  height: '100%'
});

const iconStyle = kialiStyle({
  display: 'inline-block',
  alignSelf: 'center'
});

export interface SortableCompareTh<T> extends SortableTh {
  compare?: (a: T, b: T) => number;
}

class ZtunnelConfigComponent extends React.Component<ZtunnelConfigProps, ZtunnelConfigState> {
  constructor(props: ZtunnelConfigProps) {
    super(props);

    this.state = {
      pod: this.sortedPods()[0],
      config: {},
      tabHeight: 300,
      fetch: true,
      activeKey: ztunnelTabs.indexOf(activeTab(tabName, defaultTab)),
      resource: activeTab(tabName, defaultTab)
    };
  }

  componentDidMount(): void {
    this.fetchContent();
  }

  componentDidUpdate(_prevProps: ZtunnelConfigProps, prevState: ZtunnelConfigState): void {
    const currentTabIndex = ztunnelTabs.indexOf(activeTab(tabName, defaultTab));

    if (this.state.pod.name !== prevState.pod.name || this.state.resource !== prevState.resource) {
      this.fetchContent();

      if (currentTabIndex !== this.state.activeKey) {
        this.setState({ activeKey: currentTabIndex });
      }
    }
  }

  ztunnelHandleTabClick = (_event: React.MouseEvent, tabIndex: string | number): void => {
    const resourceIdx: number = +tabIndex;
    const targetResource: string = resources[resourceIdx];

    if (targetResource !== this.state.resource) {
      this.setState({
        config: {},
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

  fetchZtunnelConfig = (): void => {
    API.getPodZtunnelConfig(this.props.namespace, this.state.pod.name, this.props.workload.cluster)
      .then(resultConfig => {
        this.setState({
          config: resultConfig.data,
          fetch: false
        });
      })
      .catch(error => {
        AlertUtils.addError(`Could not fetch ztunnel config for ${this.state.pod.name}.`, error);
      });
  };

  fetchContent = (): void => {
    if (this.state.fetch === true) {
      this.fetchZtunnelConfig();
    }
  };

  setPod = (podName: string): void => {
    const podIdx: number = +podName;
    const targetPod: Pod = this.sortedPods()[podIdx];

    if (targetPod.name !== this.state.pod.name) {
      this.setState({
        config: {},
        pod: targetPod,
        fetch: true
      });
    }
  };

  sortedPods = (): Pod[] => {
    return this.props.workload.pods.sort((p1: Pod, p2: Pod) => (p1.name >= p2.name ? 1 : -1));
  };

  render(): React.ReactNode {
    const tabs: JSX.Element[] = [];

    const servicesTab = (
      <Tab title={t('Services')} eventKey={0} key="services">
        <Card className={fullHeightStyle}>
          <CardBody>
            <div className={fullHeightStyle}>
              <div style={{ marginBottom: '1.25rem' }}>
                <div key="service-icon" className={iconStyle}>
                  <PFBadge badge={PFBadges.Pod} position={TooltipPosition.top} />
                </div>
                <ToolbarDropdown
                  id="ztunnel_pods_list"
                  tooltip={t('Display ztunnel config for the selected pod')}
                  handleSelect={key => this.setPod(key)}
                  value={this.state.pod.name}
                  label={this.state.pod.name}
                  options={this.props.workload.pods.map((pod: Pod) => pod.name).sort()}
                />
              </div>
              <ZtunnelServicesTable config={this.state.config.services} />
            </div>
          </CardBody>
        </Card>
      </Tab>
    );
    tabs.push(servicesTab);

    const workloadsTab = (
      <Tab title={t('Workloads')} eventKey={1} key="workloads">
        <Card className={fullHeightStyle}>
          <CardBody>
            <div className={fullHeightStyle}>
              <div style={{ marginBottom: '1.25rem' }}>
                <div key="service-icon" className={iconStyle}>
                  <PFBadge badge={PFBadges.Pod} position={TooltipPosition.top} />
                </div>
                <ToolbarDropdown
                  id="envoy_pods_list"
                  tooltip={t('Display envoy config for the selected pod')}
                  handleSelect={key => this.setPod(key)}
                  value={this.state.pod.name}
                  label={this.state.pod.name}
                  options={this.props.workload.pods.map((pod: Pod) => pod.name).sort()}
                />
              </div>
              <ZtunnelWorkloadsTable config={this.state.config.workloads} />
            </div>
          </CardBody>
        </Card>
      </Tab>
    );
    tabs.push(workloadsTab);

    return (
      <RenderComponentScroll onResize={height => this.setState({ tabHeight: height })}>
        <Grid>
          <GridItem span={12}>
            <Tabs
              id="ztunnel-details"
              className={subTabStyle}
              activeKey={this.state.activeKey}
              onSelect={this.ztunnelHandleTabClick}
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

export const ZtunnelConfig = connect(mapStateToProps)(ZtunnelConfigComponent);
