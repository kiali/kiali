import * as React from 'react';
import { Icon, OverlayTrigger, Popover } from 'patternfly-react';

import { Health } from '../../types/Health';
import { getName } from '../../types/RateIntervals';
import * as H from '../../utils/Health';

interface Props {
  id: string;
  health: Health;
  headline: string;
  placement?: string;
  rateInterval: number;
}

export class HealthDetails extends React.PureComponent<Props, {}> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <OverlayTrigger
        placement={this.props.placement || 'right'}
        overlay={this.tooltipContent()}
        trigger={['hover', 'focus']}
        rootClose={false}
      >
        {this.props.children}
      </OverlayTrigger>
    );
  }

  tooltipContent() {
    const health = this.props.health;
    const deplsStatuses = health.deploymentStatuses.map(st => H.ratioCheck(st.available, st.replicas));
    const allInactive = deplsStatuses.length > 0 && !deplsStatuses.some(st => st !== H.NA);
    const globalDeplStatus: H.Status = allInactive
      ? H.FAILURE
      : deplsStatuses.reduce((prev, cur) => H.mergeStatus(prev, cur), H.NA);
    const envoyInbound = H.ratioCheck(health.envoy.inbound.healthy, health.envoy.inbound.total);
    const envoyOutbound = H.ratioCheck(health.envoy.outbound.healthy, health.envoy.outbound.total);
    const reqErrorsRatio = H.getRequestErrorsRatio(health.requests);
    const reqErrorsText = reqErrorsRatio.status === H.NA ? 'No requests' : reqErrorsRatio.value.toFixed(2) + '%';
    return (
      <Popover id={this.props.id + '-health-tooltip'} title={this.props.headline}>
        <strong>
          {this.renderStatus(globalDeplStatus)}
          {' Deployments Status:'}
        </strong>
        <ul style={{ listStyleType: 'none', paddingLeft: 12 }}>
          {health.deploymentStatuses.map((st, idx) => {
            return (
              <li key={idx}>
                {this.renderStatus(deplsStatuses[idx])} {st.name}: {st.available} / {st.replicas}
              </li>
            );
          })}
        </ul>
        <strong>
          {this.renderStatus(H.mergeStatus(envoyInbound, envoyOutbound))}
          {' Envoy Health:'}
        </strong>
        <ul style={{ listStyleType: 'none', paddingLeft: 12 }}>
          <li key="inbound">
            {this.renderStatus(envoyInbound)} Inbound: {health.envoy.inbound.healthy} / {health.envoy.inbound.total}
          </li>
          <li key="outbound">
            {this.renderStatus(envoyOutbound)} Outbound: {health.envoy.outbound.healthy} / {health.envoy.outbound.total}
          </li>
        </ul>
        <strong>
          {this.renderStatus(reqErrorsRatio.status)}
          {' Error Rate:'}
        </strong>
        {' ' + reqErrorsText + ' over ' + getName(this.props.rateInterval).toLowerCase()}
      </Popover>
    );
  }

  renderStatus(status: H.Status) {
    if (status.icon) {
      return <Icon type="pf" name={status.icon} />;
    } else {
      return <span style={{ color: status.color }}>{status.text}</span>;
    }
  }
}
