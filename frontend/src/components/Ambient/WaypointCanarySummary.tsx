import * as React from 'react';
import { Content, ContentVariants, Label } from '@patternfly/react-core';
import { KialiLink } from '../Link/KialiLink';
import { isMultiCluster } from '../../config';
import type { WaypointTrafficSplit } from '../../types/WaypointTraffic';
import { t } from 'utils/I18nUtils';
import * as API from '../../services/Api';
import { PFSpacer } from 'styles/PfSpacer';
import { WaypointTrafficSplitDonut } from './WaypointTrafficSplitDonut';

const waypointHref = (namespace: string, name: string, cluster?: string): string => {
  let href = `/namespaces/${namespace}/workloads/${name}`;
  if (cluster && isMultiCluster) {
    href = `${href}?clusterName=${cluster}`;
  }
  return href;
};

type WaypointCanaryInfoPanelProps = {
  split: WaypointTrafficSplit;
  workloadCluster?: string;
  workloadName: string;
  workloadNamespace: string;
};

/** Rich layout for the waypoint workload Info tab. */
export const WaypointCanaryInfoPanel: React.FC<WaypointCanaryInfoPanelProps> = ({
  split,
  workloadCluster,
  workloadName,
  workloadNamespace
}) => {
  if (!split?.canary) {
    return null;
  }

  return (
    <div data-test="waypoint-canary-info-panel">
      <Content component={ContentVariants.small} style={{ display: 'block', marginBottom: PFSpacer.md }}>
        {t(
          'New ambient mesh connections are distributed between the primary and canary waypoint proxies according to these weights.'
        )}
      </Content>
      <WaypointTrafficSplitDonut
        split={split}
        viewingCluster={workloadCluster}
        viewingWorkload={workloadName}
        viewingNamespace={workloadNamespace}
      />
      {split.configLevel && (
        <Content component={ContentVariants.small} style={{ display: 'block', marginTop: PFSpacer.md }}>
          <strong>{t('Canary configuration')}</strong>
          {': '}
          {t('{{level}} level', { level: split.configLevel })}
        </Content>
      )}
    </div>
  );
};

/** List items for workload/service info tooltip (properties card). */
export const WaypointCanaryPropertyList: React.FC<{ split: WaypointTrafficSplit }> = ({ split }) => {
  if (!split?.canary) {
    return null;
  }

  const primary = split.primary;
  const canary = split.canary!;

  return (
    <>
      <li data-test="waypoint-canary-summary">
        <span>{t('Waypoint primary')}</span>
        <div>
          <Label color="blue" isCompact style={{ marginRight: PFSpacer.xs }}>
            {split.primaryWeight}%
          </Label>
          <KialiLink to={waypointHref(primary.namespace, primary.name, primary.cluster)}>{primary.name}</KialiLink>
        </div>
      </li>
      <li>
        <span>{t('Waypoint canary')}</span>
        <div>
          <Label color="orange" isCompact style={{ marginRight: PFSpacer.xs }}>
            {split.canaryWeight}%
          </Label>
          <KialiLink to={waypointHref(canary.namespace, canary.name, canary.cluster)}>{canary.name}</KialiLink>
        </div>
      </li>
      {split.configLevel && (
        <li>
          <span>{t('Canary configuration')}</span>
          <span>{t('{{level}} level', { level: split.configLevel })}</span>
        </li>
      )}
    </>
  );
};

type NamespaceWaypointCanarySplitProps = {
  cluster?: string;
  namespace: string;
};

export const NamespaceWaypointCanarySplit: React.FC<NamespaceWaypointCanarySplitProps> = (
  props: NamespaceWaypointCanarySplitProps
) => {
  const [split, setSplit] = React.useState<WaypointTrafficSplit | undefined>();

  React.useEffect(() => {
    API.getNamespaces()
      .then(response => {
        const match = response.data.find(
          ns => ns.name === props.namespace && (!props.cluster || ns.cluster === props.cluster)
        );
        setSplit(match?.waypointTrafficSplit);
      })
      .catch(() => setSplit(undefined));
  }, [props.namespace, props.cluster]);

  if (!split?.canary) {
    return null;
  }

  return (
    <ul
      style={{
        fontSize: 'var(--graph-side-panel--font-size)',
        listStyleType: 'none',
        margin: `${PFSpacer.sm} 0 0`,
        padding: 0
      }}
    >
      <WaypointCanaryPropertyList split={split} />
    </ul>
  );
};

export const WaypointCanaryGraphBadge: React.FC<{ split: WaypointTrafficSplit }> = ({ split }) => {
  if (!split?.canary || split.canaryWeight <= 0) {
    return null;
  }
  return (
    <Label color="orange" isCompact data-test="waypoint-canary-graph-badge">
      {t('Waypoint canary {{weight}}%', { weight: split.canaryWeight })}
    </Label>
  );
};
