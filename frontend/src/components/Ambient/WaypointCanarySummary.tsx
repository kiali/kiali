import * as React from 'react';
import { Content, ContentVariants, Label } from '@patternfly/react-core';
import { KialiLink } from '../Link/KialiLink';
import { isMultiCluster } from '../../config';
import type { WaypointTrafficSplit } from '../../types/WaypointTraffic';
import { t } from 'utils/I18nUtils';
import * as API from '../../services/Api';
import { PFSpacer } from 'styles/PfSpacer';
import { PFColors } from 'components/Pf/PfColors';
import { findGatewayWaypointSplit } from 'utils/WaypointTrafficUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { WaypointTrafficSplitDonut } from './WaypointTrafficSplitDonut';

const panelSectionHRStyle = kialiStyle({
  border: 0,
  borderTop: `1px solid ${PFColors.BorderColor100}`,
  margin: `${PFSpacer.md} 0`
});

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
      <Content component={ContentVariants.h6} style={{ display: 'block', marginBottom: PFSpacer.md }}>
        {t('Canary waypoints')}
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

type WaypointGatewayCanaryPanelProps = {
  cluster?: string;
  namespace: string;
  /** Prefer split from the topology node when the backend already attached it. */
  split?: WaypointTrafficSplit;
  workload: string;
};

/**
 * Side-panel block for a waypoint gateway: resolves canary split (from prop or namespaces)
 * and renders the shared donut + description.
 */
export const WaypointGatewayCanaryPanel: React.FC<WaypointGatewayCanaryPanelProps> = ({
  cluster,
  namespace,
  split: splitProp,
  workload
}) => {
  const [fetchedSplit, setFetchedSplit] = React.useState<WaypointTrafficSplit | undefined>();
  const hasPropSplit = !!splitProp?.canary;

  React.useEffect(() => {
    if (hasPropSplit) {
      return;
    }
    let cancelled = false;
    API.getNamespaces()
      .then(response => {
        if (cancelled) {
          return;
        }
        setFetchedSplit(findGatewayWaypointSplit(response.data, workload, namespace, cluster));
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedSplit(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasPropSplit, workload, namespace, cluster]);

  const split = hasPropSplit ? splitProp : fetchedSplit;
  if (!split?.canary) {
    return null;
  }

  return (
    <>
      <WaypointCanaryInfoPanel
        split={split}
        workloadCluster={cluster}
        workloadName={workload}
        workloadNamespace={namespace}
      />
      <hr className={panelSectionHRStyle} />
    </>
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
