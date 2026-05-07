import * as React from 'react';
import { AppWorkload } from '../../types/App';
import { Popover, PopoverPosition, TooltipPosition } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from '../../config/KialiIcon';
import { KialiLink } from '../Link/KialiLink';
import { MissingSidecar } from '../MissingSidecar/MissingSidecar';
import { PFBadge, PFBadges } from '../Pf/PfBadges';
import { isMultiCluster } from '../../config';
import { WorkloadInfo } from '../../types/Workload';
import { hasMissingSidecar } from 'components/VirtualList/Config';
import { infoStyle } from 'styles/IconStyle';

type Props = {
  apps?: string[];
  cluster?: string;
  isWaypoint?: boolean;
  namespace: string;
  services?: string[];
  waypointWorkloads?: WorkloadInfo[];
  workloads?: AppWorkload[];
};

const iconStyle = kialiStyle({
  margin: 0,
  padding: 0,
  display: 'inline-block'
});

const flowStyle = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.25rem 0.75rem',
  padding: 0,
  margin: 0,
  listStyleType: 'none'
});

const itemStyle = kialiStyle({
  display: 'inline-flex',
  alignItems: 'center',
  whiteSpace: 'nowrap'
});

const DetailDescriptionComponent: React.FC<Props> = (props: Props) => {
  const renderWaypointItem = (waypoint: WorkloadInfo): React.ReactNode => {
    let href = `/namespaces/${waypoint.namespace}/workloads/${waypoint.name}`;
    if (props.cluster && isMultiCluster) {
      href = `${href}?clusterName=${props.cluster}`;
    }

    return (
      <li key={`Waypoint_${waypoint.namespace}_${waypoint.name}`} className={itemStyle}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.Waypoint} position={TooltipPosition.top} />
        </div>

        <KialiLink to={href} dataTest="waypoint-link">
          {waypoint.name}
        </KialiLink>
      </li>
    );
  };

  const renderAppItem = (namespace: string, appName: string): React.ReactNode => {
    let href = `/namespaces/${namespace}/applications/${appName}`;

    if (props.cluster && isMultiCluster) {
      href = `${href}?clusterName=${props.cluster}`;
    }

    return (
      <li key={`App_${namespace}_${appName}`} className={itemStyle}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.App} position={TooltipPosition.top} />
        </div>

        <KialiLink to={href}>{appName}</KialiLink>
      </li>
    );
  };

  const renderServiceItem = (namespace: string, serviceName: string): React.ReactNode => {
    let href = `/namespaces/${namespace}/services/${serviceName}`;

    if (props.cluster && isMultiCluster) {
      href = `${href}?clusterName=${props.cluster}`;
    }

    return (
      <li key={`Service_${serviceName}`} className={itemStyle}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.Service} position={TooltipPosition.top} />
        </div>

        <KialiLink to={href}>{serviceName}</KialiLink>
      </li>
    );
  };

  const renderServiceAccounts = (workload: AppWorkload): React.ReactNode => {
    if (workload.serviceAccountNames && workload.serviceAccountNames.length > 0) {
      return (
        <div style={{ textAlign: 'left' }}>
          {workload.serviceAccountNames.map((sa, i) => (
            <div
              key={i}
              style={{
                padding: '0.25rem 0',
                borderBottom:
                  i < workload.serviceAccountNames.length - 1
                    ? '1px solid var(--pf-t--global--border--color--default)'
                    : undefined
              }}
            >
              {sa}
            </div>
          ))}
        </div>
      );
    }
    return <span>No service account found</span>;
  };

  const renderWorkloadItem = (workload: AppWorkload): React.ReactNode => {
    let href = `/namespaces/${props.namespace}/workloads/${workload.workloadName}`;

    if (props.cluster && isMultiCluster) {
      href = `${href}?clusterName=${props.cluster}`;
    }

    return (
      <li key={`WorkloadItem_${workload.workloadName}`} className={itemStyle}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
        </div>

        <KialiLink to={href}>{workload.workloadName}</KialiLink>

        <Popover
          position={PopoverPosition.right}
          headerContent="Service Accounts"
          bodyContent={renderServiceAccounts(workload)}
        >
          <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            <KialiIcon.Info className={infoStyle} />
          </span>
        </Popover>

        {hasMissingSidecar(workload) && <MissingSidecar tooltip={true} className={infoStyle} text="" />}
      </li>
    );
  };

  props.apps?.sort((a1: string, a2: string) => (a1 < a2 ? -1 : 1));
  props.services?.sort((s1: string, s2: string) => (s1 < s2 ? -1 : 1));
  props.waypointWorkloads?.sort((w1: WorkloadInfo, w2: WorkloadInfo) => (w1.name < w2.name ? -1 : 1));
  props.workloads?.sort((w1: AppWorkload, w2: AppWorkload) => (w1.workloadName < w2.workloadName ? -1 : 1));

  const items: React.ReactNode[] = [];
  if (props.apps && props.apps.length > 0) {
    props.apps.filter(Boolean).forEach(name => items.push(renderAppItem(props.namespace, name)));
  }
  if (props.services && props.services.length > 0) {
    props.services.forEach(name => items.push(renderServiceItem(props.namespace, name)));
  }
  if (props.waypointWorkloads && props.waypointWorkloads.length > 0) {
    props.waypointWorkloads.forEach(wp => items.push(renderWaypointItem(wp)));
  }
  if (props.workloads && props.workloads.length > 0) {
    props.workloads.forEach(wkd => items.push(renderWorkloadItem(wkd)));
  }

  if (items.length === 0) {
    return null;
  }

  return <ul className={flowStyle}>{items}</ul>;
};

export const DetailDescription = DetailDescriptionComponent;
