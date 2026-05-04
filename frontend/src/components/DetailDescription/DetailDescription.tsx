import * as React from 'react';
import { AppWorkload } from '../../types/App';
import { TooltipPosition } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
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

const resourceListStyle = kialiStyle({
  margin: '0 0 0.5rem 0',
  $nest: {
    '& > span': {
      width: '125px',
      fontWeight: 700
    }
  }
});

const containerStyle = kialiStyle({
  margin: '1rem 0 0.5rem 0'
});

const itemStyle = kialiStyle({
  paddingBottom: '0.25rem'
});

const DetailDescriptionComponent: React.FC<Props> = (props: Props) => {
  const renderWaypoints = (): React.ReactNode => {
    const waypointList = props.waypointWorkloads?.map(waypoint => {
      let href = `/namespaces/${waypoint.namespace}/workloads/${waypoint.name}`;
      if (props.cluster && isMultiCluster) {
        href = `${href}?clusterName=${props.cluster}`;
      }

      return (
        <li key={`App_${waypoint.namespace}_${waypoint.name}`} className={itemStyle}>
          <div className={iconStyle}>
            <PFBadge badge={PFBadges.Waypoint} position={TooltipPosition.top} />
          </div>

          <KialiLink to={href} dataTest="waypoint-link">
            {waypoint.name}
          </KialiLink>
        </li>
      );
    });
    return [
      <div key="waypoint-list" className={resourceListStyle}>
        <ul id="waypoint-list" data-test="waypoint-list" style={{ listStyleType: 'none' }}>
          {waypointList}
        </ul>
      </div>
    ];
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

  const renderEmptyItem = (type: string): React.ReactNode => {
    const message = `No ${type} found`;

    return <div> {message} </div>;
  };

  const appList = (): React.ReactNode => {
    let applicationList: React.ReactNode = <></>;

    if (props.apps !== undefined) {
      applicationList =
        props.apps && props.apps.length > 0
          ? props.apps
              .filter(name => {
                if (name === undefined) {
                  return null;
                }

                return name;
              })
              .map(name => renderAppItem(props.namespace, name))
          : renderEmptyItem('applications');
    }

    return [
      <div key="app-list" className={resourceListStyle}>
        <ul id="app-list" style={{ listStyleType: 'none' }}>
          {applicationList}
        </ul>
      </div>
    ];
  };

  const renderWorkloadItem = (workload: AppWorkload): React.ReactNode => {
    let href = `/namespaces/${props.namespace}/workloads/${workload.workloadName}`;

    if (props.cluster && isMultiCluster) {
      href = `${href}?clusterName=${props.cluster}`;
    }

    return (
      <span key={`WorkloadItem_${workload.workloadName}`}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
        </div>

        <KialiLink to={href}>{workload.workloadName}</KialiLink>

        {hasMissingSidecar(workload) && <MissingSidecar tooltip={true} className={infoStyle} text="" />}
      </span>
    );
  };

  const workloadList = (): React.ReactNode => {
    if (props.workloads && props.workloads.length > 0) {
      return (
        <div className={resourceListStyle}>
          <ul id="workload-list" style={{ listStyleType: 'none' }}>
            {props.workloads.map((wkd, idx) => {
              return (
                <li key={idx} className={itemStyle}>
                  {renderWorkloadItem(wkd)}
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    return undefined;
  };

  const serviceList = (): React.ReactNode => {
    let serviceListContent: React.ReactNode = <></>;

    if (props.services !== undefined) {
      serviceListContent =
        props.services && props.services.length > 0
          ? props.services.map(name => renderServiceItem(props.namespace, name))
          : renderEmptyItem('services');
    }

    return [
      <div key="service-list" className={resourceListStyle}>
        <ul id="service-list" style={{ listStyleType: 'none' }}>
          {serviceListContent}
        </ul>
      </div>
    ];
  };

  props.apps?.sort((a1: string, a2: string) => (a1 < a2 ? -1 : 1));
  props.services?.sort((s1: string, s2: string) => (s1 < s2 ? -1 : 1));
  props.waypointWorkloads?.sort((w1: WorkloadInfo, w2: WorkloadInfo) => (w1.name < w2.name ? -1 : 1));
  props.workloads?.sort((w1: AppWorkload, w2: AppWorkload) => (w1.workloadName < w2.workloadName ? -1 : 1));

  return (
    <div className={containerStyle}>
      {props.apps !== undefined && appList()}
      {props.workloads !== undefined && workloadList()}
      {props.services !== undefined && serviceList()}
      {props.waypointWorkloads && renderWaypoints()}
    </div>
  );
};

export const DetailDescription = DetailDescriptionComponent;
