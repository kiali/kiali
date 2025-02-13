import * as React from 'react';
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
import { DurationInSeconds, TimeInMilliseconds } from '../../types/Common';
import { subTabStyle } from 'styles/TabStyles';
import { ToolbarDropdown } from '../Dropdown/ToolbarDropdown';
import { PFBadge, PFBadges } from '../Pf/PfBadges';
import { kialiStyle } from '../../styles/StyleUtils';
import { ZtunnelServicesTable } from './ZtunnelServicesTable';
import { ZtunnelWorkloadsTable } from './ZtunnelWorkloadsTable';
import { t } from 'i18next';
import { SortableTh } from '../Table/SimpleTable';
import { ZtunnelMetrics } from './ZtunnelMetrics';

const resources: string[] = ['services', 'workloads', 'metrics'];

const ztunnelTabs = ['services', 'workloads', 'metrics'];
const tabName = 'ztunnelTab';
const defaultTab = 'services';

type ZtunnelConfigProps = {
  duration: DurationInSeconds;
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  workload: Workload;
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

export const ZtunnelConfig: React.FC<ZtunnelConfigProps> = (props: ZtunnelConfigProps) => {
  const sortedPods = (): Pod[] => {
    return props.workload?.pods.sort((p1: Pod, p2: Pod) => (p1.name >= p2.name ? 1 : -1));
  };

  const [pod, setPod] = React.useState(sortedPods()[0]);
  const [config, setConfig] = React.useState<ZtunnelConfigDump>({});
  const [fetch, setFetch] = React.useState(true);
  const [activeKey, setActiveKey] = React.useState(ztunnelTabs.indexOf(activeTab(tabName, defaultTab)));
  const [resource, setResource] = React.useState(activeTab(tabName, defaultTab));

  const prevResource = React.createRef();
  const prevPod = React.createRef();

  const fetchZtunnelConfig = React.useCallback(async (ns, name, cluster: string) => {
    await API.getPodZtunnelConfig(ns, name, cluster)
      .then(resultConfig => {
        setConfig(resultConfig.data);
        setFetch(false);
      })
      .catch(error => {
        AlertUtils.addError(`Could not fetch ztunnel config for ${name}.`, error);
      });
  }, []);

  React.useEffect(() => {
    const currentTabIndex = ztunnelTabs.indexOf(activeTab(tabName, defaultTab));
    if (
      prevPod.current !== undefined &&
      prevPod.current !== pod &&
      prevResource.current !== undefined &&
      prevResource.current !== resource &&
      fetch === true
    ) {
      setFetch(false);
      fetchZtunnelConfig(props.namespace, pod.name, props.workload.cluster ? props.workload.cluster : '');
      if (currentTabIndex !== activeKey) {
        setActiveKey(currentTabIndex);
      }
    }
  }, [
    resource,
    pod,
    activeKey,
    prevPod,
    prevResource,
    fetchZtunnelConfig,
    fetch,
    props.namespace,
    props.workload.cluster
  ]);

  const ztunnelHandleTabClick = (_event: React.MouseEvent, tabIndex: string | number): void => {
    const resourceIdx: number = +tabIndex;
    const targetResource: string = resources[resourceIdx];

    if (targetResource !== resource) {
      setConfig({});
      setFetch(true);
      setResource(targetResource);
      setActiveKey(resourceIdx);

      const mainTab = new URLSearchParams(location.getSearch()).get(workloadTabName) ?? workloadDefaultTab;
      const urlParams = new URLSearchParams(location.getSearch());
      urlParams.set(tabName, targetResource);
      urlParams.set(workloadTabName, mainTab);
      router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
    }
  };

  const setPodByKey = (podName: string): void => {
    const podIdx: number = +podName;
    const targetPod: Pod = sortedPods()[podIdx];

    if (targetPod.name !== pod.name) {
      setConfig({});
      setPod(targetPod);
      setFetch(true);
    }
  };

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
                handleSelect={key => setPodByKey(key)}
                value={pod.name}
                label={pod.name}
                options={props.workload.pods.map((pod: Pod) => pod.name).sort()}
              />
            </div>
            <ZtunnelServicesTable config={config?.services} />
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
                handleSelect={key => setPodByKey(key)}
                value={pod.name}
                label={pod.name}
                options={props.workload.pods.map((pod: Pod) => pod.name).sort()}
              />
            </div>
            <ZtunnelWorkloadsTable config={config?.workloads} />
          </div>
        </CardBody>
      </Card>
    </Tab>
  );
  tabs.push(workloadsTab);

  const metricsTab = (
    <Tab title={t('Metrics')} eventKey={2} key="metrics">
      <Card className={fullHeightStyle}>
        <CardBody>
          <div className={fullHeightStyle}>
            <ZtunnelMetrics
              duration={props.duration}
              lastRefreshAt={props.lastRefreshAt}
              namespace={props.namespace}
              cluster={props.workload.cluster ? props.workload.cluster : ''}
            />
          </div>
        </CardBody>
      </Card>
    </Tab>
  );
  tabs.push(metricsTab);

  return (
    <RenderComponentScroll>
      <Grid>
        <GridItem span={12}>
          <Tabs
            id="ztunnel-details"
            className={subTabStyle}
            activeKey={activeKey}
            onSelect={ztunnelHandleTabClick}
            mountOnEnter={true}
            unmountOnExit={true}
          >
            {tabs}
          </Tabs>
        </GridItem>
      </Grid>
    </RenderComponentScroll>
  );
};
