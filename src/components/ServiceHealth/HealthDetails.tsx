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
  rateInterval: string;
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
          {this.renderStatus(H.ratioCheck(health.envoy.healthy, health.envoy.total))}
          {' Envoy Health:'}
        </strong>
        {' ' + health.envoy.healthy + ' / ' + health.envoy.total}
        <br />
        <strong>
          {this.renderStatus(reqErrorsRatio.status)}
          {' Error Rate:'}
        </strong>
        {' ' + reqErrorsText + ' over last ' + getName(this.props.rateInterval)}
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
