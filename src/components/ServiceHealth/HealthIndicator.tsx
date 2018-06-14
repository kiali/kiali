import * as React from 'react';
import { Icon } from 'patternfly-react';

import { Health } from '../../types/Health';
import * as H from '../../utils/Health';
import { HealthDetails } from './HealthDetails';

export enum DisplayMode {
  LARGE,
  SMALL
}

interface Props {
  id: string;
  health?: Health;
  mode: DisplayMode;
  tooltipPlacement?: string;
  rateInterval: number;
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
    this.globalStatus = H.computeAggregatedHealth(health, info => this.info.push(info));
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
        <HealthDetails
          id={this.props.id}
          health={health}
          headline={title}
          placement={this.props.tooltipPlacement}
          rateInterval={this.props.rateInterval}
        >
          <Icon
            type="pf"
            name={this.globalStatus.icon}
            style={{ fontSize: iconSize }}
            className="health-icon"
            tabIndex="0"
          />
        </HealthDetails>
      );
    } else {
      return <span style={{ color: this.globalStatus.color, fontSize: textSize }}>{this.globalStatus.text}</span>;
    }
  }
}
