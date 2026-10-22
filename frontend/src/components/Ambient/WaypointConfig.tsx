import * as React from 'react';
import { TableVariant } from '@patternfly/react-table';
import type { IRow, ThProps } from '@patternfly/react-table';
import type { Workload } from 'types/Workload';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Content,
  ContentVariants,
  Grid,
  GridItem,
  Tab,
  Tabs,
  Title,
  TitleSizes
} from '@patternfly/react-core';
import { classes } from 'typestyle';
import { activeTab } from '../../components/Tab/Tabs';
import { tabCardStyle, constrainedScrollStyle, flexCardStyle, flexFillStyle } from 'styles/FlexStyles';
import { location, router } from '../../app/History';
import {
  tabName as workloadTabName,
  defaultTab as workloadDefaultTab
} from '../../pages/WorkloadDetails/WorkloadDetailsPage';
import { subTabStyle } from 'styles/TabStyles';
import { t, useKialiTranslation } from 'utils/I18nUtils';
import { SimpleTable } from '../Table/SimpleTable';
import { WaypointWorkloadsTable } from './WaypointWorkloadsTable';
import { WaypointForLabel, WaypointType } from '../../types/Ambient';
import { PodStatus } from '../../pages/WorkloadDetails/PodStatus';
import { WaypointCanaryInfoPanel } from './WaypointCanarySummary';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontSize } from 'styles/PfTypography';
import { cardBodyStyle, cardStyle } from '../../pages/Overview/OverviewStyles';
import { kialiStyle } from 'styles/StyleUtils';

const waypointOverviewTab = 'overview';
const tabName = 'waypointTab';

const normalizeWaypointTabParam = (tab: string): string => (tab === 'information' ? waypointOverviewTab : tab);

const waypointTabResources = (waypointFor: string): string[] => {
  const resources = [waypointOverviewTab];
  if (waypointFor === WaypointType.Service || waypointFor === WaypointType.All) {
    resources.push(WaypointType.Service);
  }
  if (waypointFor === WaypointType.Workload || waypointFor === WaypointType.All) {
    resources.push(WaypointType.Workload);
  }
  return resources;
};

const defaultWaypointTab = (waypointFor: string): string => {
  switch (waypointFor) {
    case WaypointType.None:
      return waypointOverviewTab;
    case WaypointType.Workload:
      return WaypointType.Workload;
    default:
      return waypointOverviewTab;
  }
};

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

const waypointForScopeLabel = (scope: string): string => {
  switch (scope) {
    case WaypointType.All:
      return t('All');
    case WaypointType.None:
      return t('None');
    case WaypointType.Workload:
      return t('Workload');
    default:
      return t('Service');
  }
};

const showProxyStatus = (workload: Workload): React.ReactNode => {
  const cols: ThProps[] = [
    { title: t('Pod Name') },
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

  return <SimpleTable columns={cols} label={t('Envoy status')} rows={rows} variant={TableVariant.compact} />;
};

const renderEnvoyStatusSection = (workload: Workload): React.ReactNode => {
  return (
    <>
      <Title
        className={envoyStatusHeadingStyle}
        data-test="waypoint-envoy-status-heading"
        headingLevel="h5"
        size={TitleSizes.md}
      >
        {t('Envoy status')}
      </Title>
      <Content className={envoyStatusHelpStyle} component={ContentVariants.small}>
        {t('Envoy xDS sync (CDS, LDS, EDS, RDS) for each pod running this waypoint proxy.')}
      </Content>
      <div className={envoyStatusTableWrapStyle}>{showProxyStatus(workload)}</div>
    </>
  );
};

const overviewTabContentStyle = kialiStyle({
  padding: PFSpacer.md
});

const waypointForScopeStyle = kialiStyle({
  fontSize: 'var(--pf-t--global--font--size--body--default)',
  fontWeight: 'var(--pf-t--global--font--weight--body--default)',
  marginTop: PFSpacer.xs
});

const envoyStatusHeadingStyle = kialiStyle({
  marginBottom: PFSpacer.sm
});

const envoyStatusHelpStyle = kialiStyle({
  display: 'block',
  fontSize: PFFontSize.small,
  marginBottom: PFSpacer.md
});

const envoyStatusTableWrapStyle = kialiStyle({
  marginTop: PFSpacer.sm
});

export const WaypointConfig: React.FC<WaypointConfigProps> = (props: WaypointConfigProps) => {
  const { t } = useKialiTranslation();
  const waypointFor = isWaypointFor(props.workload);
  const tabResources = waypointTabResources(waypointFor);
  const defaultTab = defaultWaypointTab(waypointFor);
  const initialResource = normalizeWaypointTabParam(activeTab(tabName, defaultTab));
  const initialActiveKey = Math.max(0, tabResources.indexOf(initialResource));

  const [activeKey, setActiveKey] = React.useState(initialActiveKey);
  const [resource, setResource] = React.useState(tabResources.includes(initialResource) ? initialResource : defaultTab);

  const currentTabIndexRef = React.useRef<number | undefined>(undefined);
  const resourceRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    const urlTab = normalizeWaypointTabParam(activeTab(tabName, defaultTab));
    const currentTabIndex = tabResources.indexOf(urlTab);

    if (
      resourceRef.current !== undefined &&
      resource !== resourceRef.current &&
      currentTabIndexRef.current !== undefined &&
      currentTabIndexRef.current !== currentTabIndex
    ) {
      if (currentTabIndex !== activeKey) {
        setActiveKey(currentTabIndex);
      }
      currentTabIndexRef.current = currentTabIndex;
      resourceRef.current = resource;
    }
  }, [resource, activeKey, defaultTab, tabResources]);

  const waypointHandleTabClick = (_event: React.MouseEvent, tabIndex: string | number): void => {
    const resourceIdx: number = +tabIndex;
    const targetResource: string = tabResources[resourceIdx];

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

  tabs.push(
    <Tab eventKey={tabs.length} key={waypointOverviewTab} title={t('Overview')}>
      <div className={overviewTabContentStyle}>
        <Grid hasGutter>
          <GridItem span={props.workload.waypointTrafficSplit?.canary ? 6 : 12}>
            <Card className={cardStyle} data-test="waypoint-envoy-status-card">
              <CardHeader>
                <CardTitle data-test="waypointfor-title">{t('Waypoint for')}</CardTitle>
                <div className={waypointForScopeStyle} data-test="waypointfor-scope">
                  {waypointForScopeLabel(waypointFor)}
                </div>
              </CardHeader>
              <CardBody className={cardBodyStyle}>{renderEnvoyStatusSection(props.workload)}</CardBody>
            </Card>
          </GridItem>
          {props.workload.waypointTrafficSplit?.canary && (
            <GridItem span={6}>
              <Card className={cardStyle} data-test="waypoint-traffic-split-card">
                <CardHeader>
                  <CardTitle>{t('Waypoint traffic split')}</CardTitle>
                </CardHeader>
                <CardBody className={cardBodyStyle}>
                  <WaypointCanaryInfoPanel
                    split={props.workload.waypointTrafficSplit}
                    workloadCluster={props.workload.cluster}
                    workloadName={props.workload.name}
                    workloadNamespace={props.workload.namespace}
                  />
                </CardBody>
              </Card>
            </GridItem>
          )}
        </Grid>
      </div>
    </Tab>
  );

  if (waypointFor === WaypointType.Service || waypointFor === WaypointType.All) {
    tabs.push(
      <Tab eventKey={tabs.length} key="services" title={t('Services')}>
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
  }

  if (waypointFor === WaypointType.Workload || waypointFor === WaypointType.All) {
    tabs.push(
      <Tab eventKey={tabs.length} key="workloads" title={t('Workloads')}>
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
  }

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
