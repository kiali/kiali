import * as React from 'react';
import {
  Content,
  ContentVariants,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Label
} from '@patternfly/react-core';
import { KialiLink } from '../Link/KialiLink';
import { isMultiCluster } from '../../config';
import type { GatewayWaypointTrafficSplitConfig, WaypointTrafficSplit } from '../../types/WaypointTraffic';
import { t } from 'utils/I18nUtils';
import * as API from '../../services/Api';
import { PFSpacer } from 'styles/PfSpacer';
import { PFColors } from 'components/Pf/PfColors';
import { findGatewayWaypointSplitConfigsFromNamespaces } from 'utils/WaypointTrafficUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { WaypointTrafficSplitTable } from './WaypointTrafficSplitTable';
import { gatewayConfigsWithCanary } from './WaypointTrafficSplitSelector';

const panelSectionHRStyle = kialiStyle({
  border: 0,
  borderTop: `1px solid ${PFColors.BorderColor100}`,
  margin: `${PFSpacer.md} 0`
});

const canarySectionHeaderStyle = kialiStyle({
  marginBottom: PFSpacer.md
});

const canarySectionTitleStyle = kialiStyle({
  margin: 0
});

const waypointHref = (namespace: string, name: string, cluster?: string): string => {
  let href = `/namespaces/${namespace}/workloads/${name}`;
  if (cluster && isMultiCluster) {
    href = `${href}?clusterName=${cluster}`;
  }
  return href;
};

type WaypointCanaryInfoPanelProps = {
  compact?: boolean;
  configs?: GatewayWaypointTrafficSplitConfig[];
  workloadCluster?: string;
  workloadName: string;
  workloadNamespace: string;
};

/** Rich layout for the waypoint workload Info tab. */
export const WaypointCanaryInfoPanel: React.FC<WaypointCanaryInfoPanelProps> = ({
  compact,
  configs,
  workloadCluster,
  workloadName,
  workloadNamespace
}) => {
  const withCanary = React.useMemo(() => gatewayConfigsWithCanary(configs), [configs]);

  if (withCanary.length === 0) {
    return null;
  }

  return (
    <div data-test="waypoint-canary-info-panel">
      <div className={canarySectionHeaderStyle}>
        <Content className={canarySectionTitleStyle} component={ContentVariants.h6}>
          {t('Canary waypoints')}
        </Content>
      </div>
      <WaypointTrafficSplitTable
        configs={withCanary}
        showDonut={!compact}
        viewingCluster={workloadCluster}
        viewingNamespace={workloadNamespace}
        viewingWorkload={workloadName}
      />
    </div>
  );
};

const waypointBindingLink = (namespace: string, name: string, cluster?: string): React.ReactNode => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: PFSpacer.xs }}>
    <KialiLink to={waypointHref(namespace, name, cluster)}>{name}</KialiLink>
  </span>
);

/** DescriptionList groups for service/workload Overview Details cards. */
export const WaypointCanaryPropertyList: React.FC<{ split: WaypointTrafficSplit }> = ({ split }) => {
  if (!split?.canary) {
    return null;
  }

  const primary = split.primary;
  const canary = split.canary!;

  return (
    <>
      <DescriptionListGroup data-test="waypoint-canary-summary">
        <DescriptionListTerm>{t('Waypoint primary')}</DescriptionListTerm>
        <DescriptionListDescription>
          <Label color="blue" isCompact style={{ marginRight: PFSpacer.xs }}>
            {split.primaryWeight}%
          </Label>
          {waypointBindingLink(primary.namespace, primary.name, primary.cluster)}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup data-test="waypoint-canary-secondary">
        <DescriptionListTerm>{t('Waypoint canary')}</DescriptionListTerm>
        <DescriptionListDescription>
          <Label color="orange" isCompact style={{ marginRight: PFSpacer.xs }}>
            {split.canaryWeight}%
          </Label>
          {waypointBindingLink(canary.namespace, canary.name, canary.cluster)}
        </DescriptionListDescription>
      </DescriptionListGroup>
      {split.configLevel && (
        <DescriptionListGroup data-test="waypoint-canary-config-level">
          <DescriptionListTerm>{t('Canary configuration')}</DescriptionListTerm>
          <DescriptionListDescription>{t('{{level}} level', { level: split.configLevel })}</DescriptionListDescription>
        </DescriptionListGroup>
      )}
    </>
  );
};

type WaypointGatewayCanaryPanelProps = {
  cluster?: string;
  configs?: GatewayWaypointTrafficSplitConfig[];
  namespace: string;
  workload: string;
};

/**
 * Side-panel block for a waypoint gateway: resolves canary split (from prop or namespaces)
 * and renders the shared donut + description.
 */
export const WaypointGatewayCanaryPanel: React.FC<WaypointGatewayCanaryPanelProps> = ({
  cluster,
  configs: configsProp,
  namespace,
  workload
}) => {
  const [fetchedConfigs, setFetchedConfigs] = React.useState<GatewayWaypointTrafficSplitConfig[] | undefined>();
  const hasPropData = gatewayConfigsWithCanary(configsProp).length > 0;

  React.useEffect(() => {
    if (hasPropData) {
      return;
    }
    let cancelled = false;
    API.getNamespaces()
      .then(response => {
        if (cancelled) {
          return;
        }
        setFetchedConfigs(findGatewayWaypointSplitConfigsFromNamespaces(response.data, workload, namespace, cluster));
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedConfigs(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasPropData, workload, namespace, cluster]);

  const configs = gatewayConfigsWithCanary(configsProp);
  const displayConfigs = configs.length > 0 ? configs : gatewayConfigsWithCanary(fetchedConfigs);
  if (displayConfigs.length === 0) {
    return null;
  }

  return (
    <>
      <WaypointCanaryInfoPanel
        compact
        configs={displayConfigs}
        workloadCluster={cluster}
        workloadName={workload}
        workloadNamespace={namespace}
      />
      <hr className={panelSectionHRStyle} />
    </>
  );
};
