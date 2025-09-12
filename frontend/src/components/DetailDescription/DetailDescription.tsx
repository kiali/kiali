import * as React from 'react';
import { AppWorkload } from '../../types/App';
import { PopoverPosition, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { Link } from 'react-router-dom-v5-compat';
import { MissingSidecar } from '../MissingSidecar/MissingSidecar';
import * as H from '../../types/Health';
import { HealthSubItem } from '../../types/Health';
import { renderTrafficStatus } from '../Health/HealthDetails';
import { PFBadge, PFBadges } from '../Pf/PfBadges';
import { KialiIcon, createIcon } from '../../config/KialiIcon';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskContextMenuAction } from '../Kiosk/KioskActions';
import { isMultiCluster } from '../../config';
import { WorkloadInfo } from '../../types/Workload';
import { hasMissingSidecar } from 'components/VirtualList/Config';
import { healthIndicatorStyle } from 'styles/HealthStyle';
import { infoStyle } from 'styles/IconStyle';

type ReduxProps = {
  kiosk: string;
};

type Props = ReduxProps & {
  apps?: string[];
  cluster?: string;
  health?: H.Health;
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
      const link = isParentKiosk(props.kiosk) ? (
        <Link
          to=""
          data-test="waypoint-link"
          onClick={() => {
            kioskContextMenuAction(href);
          }}
        >
          {waypoint.name}
        </Link>
      ) : (
        <Link to={href} data-test="waypoint-link">
          {waypoint.name}
        </Link>
      );
      return (
        <li key={`App_${waypoint.namespace}_${waypoint.name}`} className={itemStyle}>
          <div className={iconStyle}>
            <PFBadge badge={PFBadges.Waypoint} position={TooltipPosition.top} />
          </div>

          <span>{link}</span>
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

    const link = isParentKiosk(props.kiosk) ? (
      <Link
        to=""
        onClick={() => {
          kioskContextMenuAction(href);
        }}
      >
        {appName}
      </Link>
    ) : (
      <Link to={href}>{appName}</Link>
    );

    return (
      <li key={`App_${namespace}_${appName}`} className={itemStyle}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.App} position={TooltipPosition.top} />
        </div>

        <span>{link}</span>
      </li>
    );
  };

  const renderServiceItem = (namespace: string, serviceName: string): React.ReactNode => {
    let href = `/namespaces/${namespace}/services/${serviceName}`;

    if (props.cluster && isMultiCluster) {
      href = `${href}?clusterName=${props.cluster}`;
    }

    const link = isParentKiosk(props.kiosk) ? (
      <Link
        to=""
        onClick={() => {
          kioskContextMenuAction(href);
        }}
      >
        {serviceName}
      </Link>
    ) : (
      <Link to={href}>{serviceName}</Link>
    );

    return (
      <li key={`Service_${serviceName}`} className={itemStyle}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.Service} position={TooltipPosition.top} />
        </div>

        <span>{link}</span>
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

    const link = isParentKiosk(props.kiosk) ? (
      <Link
        to=""
        onClick={() => {
          kioskContextMenuAction(href);
        }}
      >
        {workload.workloadName}
      </Link>
    ) : (
      <Link to={href}>{workload.workloadName}</Link>
    );

    return (
      <span key={`WorkloadItem_${workload.workloadName}`}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
        </div>

        {link}

        <Tooltip position={TooltipPosition.right} content={renderServiceAccounts(workload)}>
          <KialiIcon.Info className={infoStyle} />
        </Tooltip>

        {hasMissingSidecar(workload) && <MissingSidecar tooltip={true} className={infoStyle} text="" />}
      </span>
    );
  };

  const renderWorkloadHealthItem = (sub: HealthSubItem): React.ReactNode => {
    let workload: AppWorkload | undefined = undefined;

    if (props.workloads && props.workloads.length > 0) {
      for (let i = 0; i < props.workloads.length; i++) {
        const hWorkload = sub.text.substring(0, sub.text.indexOf(':'));

        if (hWorkload === props.workloads[i].workloadName) {
          workload = props.workloads[i];
          break;
        }
      }
    }

    if (workload) {
      let href = `/namespaces/${props.namespace}/workloads/${workload.workloadName}`;

      if (props.cluster && isMultiCluster) {
        href = `${href}?clusterName=${props.cluster}`;
      }

      const link = isParentKiosk(props.kiosk) ? (
        <Link
          to=""
          onClick={() => {
            kioskContextMenuAction(href);
          }}
        >
          {workload.workloadName}
        </Link>
      ) : (
        <Link to={href}>{workload.workloadName}</Link>
      );

      return (
        <span key={`WorkloadItem_${workload.workloadName}`}>
          <div className={iconStyle}>
            <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
          </div>

          {link}

          <Tooltip position={TooltipPosition.right} content={renderServiceAccounts(workload)}>
            <KialiIcon.Info className={infoStyle} />
          </Tooltip>

          <Tooltip
            aria-label="Health indicator"
            content={<>{sub.text}</>}
            position={PopoverPosition.auto}
            className={healthIndicatorStyle}
          >
            <span style={{ marginLeft: '0.5rem' }}>{createIcon(sub.status)}</span>
          </Tooltip>

          {hasMissingSidecar(workload) && <MissingSidecar tooltip={true} className={infoStyle} text="" />}
        </span>
      );
    } else {
      return (
        <span key={`WorkloadItem_${sub.text}`}>
          <span style={{ marginRight: '0.5rem' }}>{createIcon(sub.status)}</span>
          {sub.text}
        </span>
      );
    }
  };

  const renderServiceAccounts = (workload: AppWorkload): React.ReactNode => {
    return (
      <div style={{ textAlign: 'left' }}>
        {workload.serviceAccountNames && workload.serviceAccountNames.length > 0 ? (
          <div key="properties-list" className={resourceListStyle}>
            <span>Service accounts</span>

            <ul>
              {workload.serviceAccountNames.map((serviceAccount, i) => (
                <li key={i} className={itemStyle}>
                  {serviceAccount}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          'Not found'
        )}
      </div>
    );
  };

  const renderWorkloadStatus = (): React.ReactNode => {
    if (props.health) {
      const item = props.health.getWorkloadStatus();

      if (item) {
        item.children?.sort((i1, i2) => (i1.text < i2.text ? -1 : 1));
        return (
          <div>
            {item.text}

            {item.children && (
              <ul id="workload-list" style={{ listStyleType: 'none' }}>
                {item.children.map((sub, subIdx) => {
                  return (
                    <li key={subIdx} className={itemStyle}>
                      {renderWorkloadHealthItem(sub)}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      } else {
        return (
          <div>
            <ul id="workload-list" style={{ listStyleType: 'none' }}>
              {props.workloads
                ? props.workloads.map((wkd, subIdx) => {
                    return (
                      <li key={subIdx} className={itemStyle}>
                        {renderWorkloadItem(wkd)}
                      </li>
                    );
                  })
                : undefined}
            </ul>
          </div>
        );
      }
    }
    return undefined;
  };

  const workloadSummary = (): React.ReactNode => {
    return <div className={resourceListStyle}>{renderWorkloadStatus()}</div>;
  };

  const serviceList = (): React.ReactNode => {
    let serviceList: React.ReactNode = <></>;

    if (serviceList !== undefined) {
      serviceList =
        props.services && props.services.length > 0
          ? props.services.map(name => renderServiceItem(props.namespace, name))
          : renderEmptyItem('services');
    }

    return [
      <div key="service-list" className={resourceListStyle}>
        <ul id="service-list" style={{ listStyleType: 'none' }}>
          {serviceList}
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
      {props.workloads !== undefined && workloadSummary()}
      {props.services !== undefined && serviceList()}
      {props.waypointWorkloads && renderWaypoints()}
      {props.health && renderTrafficStatus(props.health)}
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

export const DetailDescription = connect(mapStateToProps)(DetailDescriptionComponent);
