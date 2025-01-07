import * as React from 'react';
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

type WaypointConfigProps = {
  workload: Workload;
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

export const WaypointConfig: React.FC<WaypointConfigProps> = (props: WaypointConfigProps) => {
  const waypointFor = isWaypointFor(props.workload);
  const defaultTab = waypointFor === WaypointType.Workload ? WaypointType.Workload : WaypointType.Service;
  const [activeKey, setActiveKey] = React.useState(waypointTabs.indexOf(activeTab(tabName, defaultTab)));
  const [resource, setResource] = React.useState(activeTab(tabName, defaultTab));

  const currentTabIndexRef = React.useRef();
  const resourceRef = React.useRef();

  React.useEffect(() => {
    const currentTabIndex = waypointTabs.indexOf(activeTab(tabName, defaultTab));

    if (
      resourceRef.current !== undefined &&
      resource !== resourceRef.current &&
      currentTabIndexRef.current !== undefined &&
      currentTabIndexRef.current !== currentTabIndex
    ) {
      if (currentTabIndex !== activeKey) {
        setActiveKey(currentTabIndex);
      }
      // @ts-ignore
      currentTabIndexRef.current = currentTabIndex;
      // @ts-ignore
      resourceRef.current = resource;
    }
  }, [resource, activeKey, defaultTab]);

  const waypointHandleTabClick = (_event: React.MouseEvent, tabIndex: string | number): void => {
    const resourceIdx: number = +tabIndex;
    const targetResource: string = resources[resourceIdx];

    if (targetResource !== resource) {
      setResource(targetResource);
      setActiveKey(resourceIdx);

      const mainTab = new URLSearchParams(location.getSearch()).get(workloadTabName) ?? workloadDefaultTab;
      const urlParams = new URLSearchParams(location.getSearch());
      urlParams.set(tabName, targetResource);
      urlParams.set(workloadTabName, mainTab);
      router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
    }
  };

  const tabs: JSX.Element[] = [];

  if (waypointFor === WaypointType.Service || waypointFor === WaypointType.All) {
    const servicesTab = (
      <Tab title={t('Services')} eventKey={0} key={waypointFor}>
        <Card className={fullHeightStyle}>
          <CardBody>
            <div className={fullHeightStyle}>
              <div style={{ marginBottom: '1.25rem' }}>
                <WaypointWorkloadsTable
                  workloads={props.workload.waypointServices ? props.workload.waypointServices : []}
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

  if (waypointFor === WaypointType.Workload || waypointFor === WaypointType.All) {
    const workloadsTab = (
      <Tab title={t('Workloads')} eventKey={1} key={waypointFor}>
        <Card className={fullHeightStyle}>
          <CardBody>
            <div className={fullHeightStyle}>
              <div style={{ marginBottom: '1.25rem' }}>
                <WaypointWorkloadsTable
                  workloads={props.workload.waypointWorkloads ? props.workload.waypointWorkloads : []}
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
                Waypoint for: {waypointFor}
              </Title>
              {showProxyStatus(props.workload)}
            </div>
          </div>
        </CardBody>
      </Card>
    </Tab>
  );
  tabs.push(infoTab);

  return (
    <RenderComponentScroll>
      <Grid>
        <GridItem span={12}>
          <Tabs
            id="waypoint-details"
            className={subTabStyle}
            activeKey={activeKey}
            onSelect={waypointHandleTabClick}
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
