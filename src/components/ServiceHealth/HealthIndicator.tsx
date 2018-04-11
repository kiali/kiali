import * as React from 'react';
import { Icon } from 'patternfly-react';

import { Health } from '../../types/Health';
import * as H from './HealthHelper';
import { HealthDetails } from './HealthDetails';

export enum DisplayMode {
  LARGE,
  SMALL
}

interface Props {
  health?: Health;
  mode: DisplayMode;
  tooltipPlacement?: string;
}

export class HealthIndicator extends React.PureComponent<Props, {}> {
  globalStatus: H.Status;
  info: string[];

  constructor(props: Props) {
    super(props);
    this.state = { showDetails: false };
    this.updateHealth(props.health);
  }

  componentWillReceiveProps(nextProps: Props) {
    this.updateHealth(nextProps.health);
  }

  updateHealth(health?: Health) {
    this.info = [];
    let countInactiveDeployments = 0;
    if (health) {
      const envoyStatus = H.ratioCheck(health.envoy.healthy, health.envoy.total, severity =>
        this.info.push('Envoy health ' + severity)
      );
      this.globalStatus = health.deploymentStatuses.reduce((prev, cur) => {
        const status = H.ratioCheck(cur.available, cur.replicas, severity =>
          this.info.push('Pod deployment ' + severity)
        );
        if (status === H.NA) {
          countInactiveDeployments++;
        }
        return H.mergeStatus(prev, status);
      }, envoyStatus);
    } else {
      this.globalStatus = H.NA;
    }
    if (health && countInactiveDeployments > 0 && countInactiveDeployments === health.deploymentStatuses.length) {
      // No active deployment => special case for failure
      this.globalStatus = H.FAILURE;
      this.info.push('No active deployment!');
    } else if (countInactiveDeployments === 1) {
      this.info.push('One inactive deployment');
    } else if (countInactiveDeployments > 1) {
      this.info.push(`${countInactiveDeployments} inactive deployments`);
    }
  }

  render() {
    if (this.props.health) {
      if (this.props.mode === DisplayMode.SMALL) {
        return this.renderSmall(this.props.health);
      } else {
        return this.renderLarge(this.props.health);
      }
    }
    return <span />;
  }

  renderSmall(health: Health) {
    return <span>{this.renderIndicator(health, '18px', '12px', this.globalStatus.name)}</span>;
  }

  renderLarge(health: Health) {
    return (
      <div style={{ color: this.globalStatus.color }}>
        {this.renderIndicator(health, '35px', '24px', this.globalStatus.name)}
        <br />
        {this.info.length === 1 && this.info[0]}
        {this.info.length > 1 && (
          <ul style={{ padding: 0 }}>{this.info.map((line, idx) => <li key={idx}>{line}</li>)}</ul>
        )}
      </div>
    );
  }

  renderIndicator(health: Health, iconSize: string, textSize: string, title: string) {
    if (this.globalStatus.icon) {
      return (
        <HealthDetails health={health} headline={title} placement={this.props.tooltipPlacement}>
          <Icon type="pf" name={this.globalStatus.icon} style={{ fontSize: iconSize }} />
        </HealthDetails>
      );
    } else {
      return <span style={{ color: this.globalStatus.color, fontSize: textSize }}>{this.globalStatus.text}</span>;
    }
  }
}
