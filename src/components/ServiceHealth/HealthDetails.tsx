import * as React from 'react';
import { Icon, OverlayTrigger, Tooltip } from 'patternfly-react';

import { Health } from '../../types/Health';
import * as H from './HealthHelper';

interface Props {
  id: string;
  health: Health;
  headline: string;
  placement?: string;
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
      : deplsStatuses.reduce((prev, cur) => H.mergeStatus(prev, cur)) || H.NA;
    return (
      <Tooltip id={this.props.id + '-health-tooltip'}>
        <div style={{ paddingLeft: 15, paddingRight: 15, paddingBottom: 10 }}>
          <div>
            <h4>{this.props.headline}</h4>
          </div>
          <div>
            <strong>{this.renderStatus(globalDeplStatus)}&nbsp; Deployments status:</strong>
            <ul style={{ listStyleType: 'none', paddingLeft: 12 }}>
              {health.deploymentStatuses.map((st, idx) => {
                return (
                  <li key={idx}>
                    {this.renderStatus(deplsStatuses[idx])}&nbsp;
                    {st.name} ({st.available} / {st.replicas})
                  </li>
                );
              })}
            </ul>
            <strong>
              {this.renderStatus(H.ratioCheck(health.envoy.healthy, health.envoy.total))}&nbsp; Envoy health
            </strong>
            &nbsp;({health.envoy.healthy} / {health.envoy.total})
          </div>
        </div>
      </Tooltip>
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
