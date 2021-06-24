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

type Props = {
  namespace: string;
  apps?: string[];
  workloads?: AppWorkload[];
  services?: string[];
  health?: H.Health;
};

const iconStyle = style({
  margin: '0 0 0 0',
  padding: '0 0 0 0',
  display: 'inline-block'
});

const resourceListStyle = style({
  margin: '0px 0 11px 0'
});

const titleStyle = style({
  margin: '15px 0 8px 0'
});

class DetailDescription extends React.PureComponent<Props> {
  private renderAppItem(namespace: string, appName: string) {
    return (
      <li key={`App_${appName}`}>
        <div key="service-icon" className={iconStyle}>
          <PFBadge badge={PFBadges.App} position={TooltipPosition.top} />
        </div>
        <span>
          <Link to={'/namespaces/' + namespace + '/applications/' + appName}>{appName}</Link>
        </span>
      </li>
    );
  }

  private renderServiceItem(namespace: string, serviceName: string) {
    return (
      <li key={`Service_${serviceName}`}>
        <div key="service-icon" className={iconStyle}>
          <PFBadge badge={PFBadges.Service} position={TooltipPosition.top} />
        </div>
        <span>
          <Link to={'/namespaces/' + namespace + '/services/' + serviceName}>{serviceName}</Link>
        </span>
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
            .map(name => this.renderAppItem(this.props.namespace, name))
        : this.renderEmptyItem('applications');

    return [
      <div className={resourceListStyle}>
        <ul id="app-list" style={{ listStyleType: 'none' }}>
          {applicationList}
        </ul>
      </div>
    ];
  }

  private renderWorkloadItem(workload: AppWorkload) {
    return (
      <span key={'WorkloadItem_' + workload.workloadName}>
        <div className={iconStyle}>
          <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
        </div>
        <Link to={'/namespaces/' + this.props.namespace + '/workloads/' + workload.workloadName}>
          {workload.workloadName}
        </Link>
        {!workload.istioSidecar && (
          <MissingSidecar namespace={this.props.namespace} tooltip={true} style={{ marginLeft: '10px' }} text={''} />
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
      return (
        <span key={'WorkloadItem_' + workload.workloadName}>
          <div key="service-icon" className={iconStyle}>
            <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
          </div>
          <Link to={'/namespaces/' + this.props.namespace + '/workloads/' + workload.workloadName}>
            {workload.workloadName}
          </Link>
          <Tooltip
            aria-label={'Health indicator'}
            content={<>{sub.text}</>}
            position={PopoverPosition.auto}
            className={'health_indicator'}
          >
            <span style={{ marginLeft: '10px' }}>{createIcon(sub.status)}</span>
          </Tooltip>
          {!workload.istioSidecar && (
            <MissingSidecar namespace={this.props.namespace} tooltip={true} style={{ marginLeft: '10px' }} text={''} />
          )}
        </span>
      );
    } else {
      return (
        <span key={'WorkloadItem_' + sub.text}>
          <span style={{ marginRight: '10px' }}>{createIcon(sub.status)}</span>
          {sub.text}
        </span>
      );
    }
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
      <div className={resourceListStyle}>
        <ul id="service-list" style={{ listStyleType: 'none' }}>
          {serviceList}
        </ul>
      </div>
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
      </>
    );
  }
}

export default DetailDescription;
