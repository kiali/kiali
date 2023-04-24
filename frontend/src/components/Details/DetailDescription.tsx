import * as React from 'react';
import { AppWorkload } from '../../types/App';
import { PopoverPosition, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { style } from 'typestyle';
import { Link } from 'react-router-dom';
import MissingSidecar from '../MissingSidecar/MissingSidecar';
import * as H from '../../types/Health';
import { HealthSubItem } from '../../types/Health';
import { renderTrafficStatus } from '../Health/HealthDetails';
import { createIcon } from '../Health/Helper';
import { PFBadge, PFBadges } from '../Pf/PfBadges';
import { KialiIcon } from '../../config/KialiIcon';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskContextMenuAction } from '../Kiosk/KioskActions';
import { isGateway, isWaypoint } from '../../helpers/LabelFilterHelper';
import { serverConfig } from '../../config';
import { Workload } from '../../types/Workload';

type ReduxProps = {
  kiosk: string;
};

type Props = ReduxProps & {
  cluster?: string;
  namespace: string;
  apps?: string[];
  workloads?: AppWorkload[];
  services?: string[];
  health?: H.Health;
  waypointWorkloads?: Workload[];
};

const iconStyle = style({
  margin: '0 0 0 0',
  padding: '0 0 0 0',
  display: 'inline-block'
});

const resourceListStyle = style({
  margin: '0px 0 11px 0',
  $nest: {
    '& > span': {
      float: 'left',
      width: '125px',
      fontWeight: 700
    }
  }
});

const titleStyle = style({
  margin: '15px 0 8px 0'
});

const infoStyle = style({
  margin: '0px 4px 2px 10px',
  verticalAlign: '-4px !important'
});

class DetailDescription extends React.Component<Props> {
  private renderAppItem(namespace: string, appName: string) {
    let href = '/namespaces/' + namespace + '/applications/' + appName;
    if (this.props.cluster) {
      href = href + '?cluster=' + this.props.cluster;
    }
    const link = isParentKiosk(this.props.kiosk) ? (
      <Link
        to={''}
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
      <li key={`App_${namespace}_${appName}`}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.App} position={TooltipPosition.top} />
        </div>
        <span>{link}</span>
      </li>
    );
  }

  private renderServiceItem(namespace: string, serviceName: string) {
    let href = '/namespaces/' + namespace + '/services/' + serviceName;
    if (this.props.cluster) {
      href = href + '?cluster=' + this.props.cluster;
    }
    const link = isParentKiosk(this.props.kiosk) ? (
      <Link
        to={''}
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
      <li key={`Service_${serviceName}`}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.Service} position={TooltipPosition.top} />
        </div>
        <span>{link}</span>
      </li>
    );
  }

  private renderEmptyItem(type: string) {
    const message = 'No ' + type + ' found';
    return <div> {message} </div>;
  }

  private appList() {
    const applicationList =
      this.props.apps && this.props.apps.length > 0
        ? this.props.apps
            .sort((a1: string, a2: string) => (a1 < a2 ? -1 : 1))
            .filter(name => {
              if (name === undefined) {
                return null;
              }
              return name;
            })
            .map(name => this.renderAppItem(this.props.namespace, name))
        : this.renderEmptyItem('applications');

    return [
      <div key="app-list" className={resourceListStyle}>
        <ul id="app-list" style={{ listStyleType: 'none' }}>
          {applicationList}
        </ul>
      </div>
    ];
  }

  private renderWorkloadItem(workload: AppWorkload) {
    const href = '/namespaces/' + this.props.namespace + '/workloads/' + workload.workloadName;
    const link = isParentKiosk(this.props.kiosk) ? (
      <Link
        to={''}
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
      <span key={'WorkloadItem_' + workload.workloadName}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
        </div>
        {link}
        <Tooltip position={TooltipPosition.right} content={this.renderServiceAccounts(workload)}>
          <KialiIcon.Info className={infoStyle} />
        </Tooltip>
        {((!workload.istioSidecar &&
          !workload.istioAmbient &&
          !isWaypoint(workload.labels) &&
          serverConfig.ambientEnabled) ||
          (!workload.istioSidecar && !serverConfig.ambientEnabled)) && (
          <MissingSidecar
            namespace={this.props.namespace}
            isGateway={isGateway(workload.labels)}
            tooltip={true}
            style={{ marginLeft: '10px' }}
            text={''}
          />
        )}
      </span>
    );
  }

  private renderWorkloadHealthItem(sub: HealthSubItem) {
    let workload: AppWorkload | undefined = undefined;
    if (this.props.workloads && this.props.workloads.length > 0) {
      for (let i = 0; i < this.props.workloads.length; i++) {
        const hWorkload = sub.text.substr(0, sub.text.indexOf(':'));
        if (hWorkload === this.props.workloads[i].workloadName) {
          workload = this.props.workloads[i];
          break;
        }
      }
    }
    if (workload) {
      const href = '/namespaces/' + this.props.namespace + '/workloads/' + workload.workloadName;
      const link = isParentKiosk(this.props.kiosk) ? (
        <Link
          to={''}
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
          <Tooltip position={TooltipPosition.right} content={this.renderServiceAccounts(workload)}>
            <KialiIcon.Info className={infoStyle} />
          </Tooltip>
          <Tooltip
            aria-label={'Health indicator'}
            content={<>{sub.text}</>}
            position={PopoverPosition.auto}
            className={'health_indicator'}
          >
            <span style={{ marginLeft: '10px' }}>{createIcon(sub.status)}</span>
          </Tooltip>
          {((!workload.istioSidecar && !workload.istioAmbient && serverConfig.ambientEnabled) ||
            (!workload.istioSidecar && !serverConfig.ambientEnabled)) && (
            <MissingSidecar
              namespace={this.props.namespace}
              isGateway={isGateway(workload.labels)}
              tooltip={true}
              style={{ marginLeft: '10px' }}
              text={''}
            />
          )}
        </span>
      );
    } else {
      return (
        <span key={`WorkloadItem_${sub.text}`}>
          <span style={{ marginRight: '10px' }}>{createIcon(sub.status)}</span>
          {sub.text}
        </span>
      );
    }
  }

  private renderServiceAccounts(workload: AppWorkload) {
    return (
      <div style={{ textAlign: 'left' }}>
        {workload.serviceAccountNames && workload.serviceAccountNames.length > 0 ? (
          <div key="properties-list" className={resourceListStyle}>
            <span>Service accounts</span>
            <ul>
              {workload.serviceAccountNames.map((serviceAccount, i) => (
                <li key={i}>{serviceAccount}</li>
              ))}
            </ul>
          </div>
        ) : (
          'Not found'
        )}
      </div>
    );
  }

  private renderWorkloadStatus() {
    if (this.props.health) {
      const item = this.props.health.getWorkloadStatus();
      if (item) {
        return (
          <div>
            {item.text}
            {item.children && (
              <ul id="workload-list" style={{ listStyleType: 'none' }}>
                {item.children.map((sub, subIdx) => {
                  return <li key={subIdx}>{this.renderWorkloadHealthItem(sub)}</li>;
                })}
              </ul>
            )}
          </div>
        );
      } else {
        return (
          <div>
            <ul id="workload-list" style={{ listStyleType: 'none' }}>
              {this.props.workloads
                ? this.props.workloads
                    .sort((w1: AppWorkload, w2: AppWorkload) => (w1.workloadName < w2.workloadName ? -1 : 1))
                    .map((wkd, subIdx) => {
                      return <li key={subIdx}>{this.renderWorkloadItem(wkd)}</li>;
                    })
                : undefined}
            </ul>
          </div>
        );
      }
    }
    return undefined;
  }

  private workloadSummary() {
    return <div className={resourceListStyle}>{this.renderWorkloadStatus()}</div>;
  }

  private serviceList() {
    const serviceList =
      this.props.services && this.props.services.length > 0
        ? this.props.services
            .sort((s1: string, s2: string) => (s1 < s2 ? -1 : 1))
            .map(name => this.renderServiceItem(this.props.namespace, name))
        : this.renderEmptyItem('services');

    return [
      <div key="service-list" className={resourceListStyle}>
        <ul id="service-list" style={{ listStyleType: 'none' }}>
          {serviceList}
        </ul>
      </div>
    ];
  }

  private renderWaypoint() {
    return [
      <>
        <div key="waypoint-workloads-title">
          <PFBadge badge={PFBadges.Waypoint} position={TooltipPosition.top} />
          Waypoint proxy
          <Tooltip
            position={TooltipPosition.right}
            content="This workload is identified as a waypoint proxy, as part of Istio Ambient"
          >
            <KialiIcon.Info className={infoStyle} />
          </Tooltip>
        </div>
      </>
    ];
  }

  render() {
    return (
      <>
        <div className={titleStyle}></div>
        {this.props.apps !== undefined && this.appList()}
        {this.props.workloads !== undefined && this.workloadSummary()}
        {this.props.services !== undefined && this.serviceList()}
        {this.props.health && renderTrafficStatus(this.props.health)}
        {this.props.waypointWorkloads && this.renderWaypoint()}
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

const DetailDescriptionContainer = connect(mapStateToProps)(DetailDescription);
export default DetailDescriptionContainer;
