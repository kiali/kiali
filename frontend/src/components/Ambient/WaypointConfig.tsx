import * as React from 'react';
import { IRow, ThProps } from '@patternfly/react-table';
import { Workload } from 'types/Workload';
import { Card, CardBody, Tab, Tabs, Title, TitleSizes } from '@patternfly/react-core';
import { classes } from 'typestyle';
import { activeTab } from '../../components/Tab/Tabs';
import { tabCardStyle, constrainedScrollStyle, flexCardStyle, flexFillStyle } from 'styles/FlexStyles';
import { location, router } from '../../app/History';
import {
  tabName as workloadTabName,
  defaultTab as workloadDefaultTab
} from '../../pages/WorkloadDetails/WorkloadDetailsPage';
import { subTabStyle } from 'styles/TabStyles';
import { t } from 'utils/I18nUtils';
import { SimpleTable } from '../Table/SimpleTable';
import { WaypointWorkloadsTable } from './WaypointWorkloadsTable';
import { WaypointForLabel, WaypointType } from '../../types/Ambient';
import { PodStatus } from '../../pages/WorkloadDetails/PodStatus';

const resources: string[] = ['service', 'workload', 'information'];

const waypointTabs = ['service', 'workload', 'information'];
const tabName = 'waypointTab';

type WaypointConfigProps = {
  workload: Workload;
};

export const isWaypointFor = (wk: Workload): string => {
  switch (wk.labels[WaypointForLabel]) {
    case WaypointType.All:
      return WaypointType.All;
    case WaypointType.None:
      return WaypointType.None;
    case WaypointType.Workload:
      return WaypointType.Workload;
    default:
      return WaypointType.Service;
  }
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
  let defaultTab: string;
  switch (waypointFor) {
    case WaypointType.None:
      defaultTab = 'information';
      break;
    case WaypointType.Workload:
      defaultTab = WaypointType.Workload;
      break;
    default:
      defaultTab = WaypointType.Service;
  }
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
        <Card className={classes(flexCardStyle, tabCardStyle)}>
          <CardBody>
            <div>
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
        <Card className={classes(flexCardStyle, tabCardStyle)}>
          <CardBody>
            <div>
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
    <Tab title={t('Info')} eventKey={2} key="information">
      <Card className={classes(flexCardStyle, tabCardStyle)}>
        <CardBody>
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <Title
                headingLevel="h5"
                size={TitleSizes.md}
                style={{ marginBottom: '1em' }}
                data-test="waypointfor-title"
              >
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
    <div className={classes(flexFillStyle, constrainedScrollStyle)}>
      <div className={subTabStyle}>
        <Tabs
          id="waypoint-details"
          activeKey={activeKey}
          onSelect={waypointHandleTabClick}
          mountOnEnter={true}
          unmountOnExit={true}
        >
          {tabs}
        </Tabs>
      </div>
    </div>
  );
};
