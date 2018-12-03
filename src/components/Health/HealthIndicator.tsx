import * as React from 'react';
import { Icon } from 'patternfly-react';
import { HealthDetails } from './HealthDetails';
import * as H from '../../types/Health';

export enum DisplayMode {
  LARGE,
  SMALL
}

interface Props {
  id: string;
  health?: H.Health;
  mode: DisplayMode;
  tooltipPlacement?: string;
}

interface HealthState {
  globalStatus: H.Status;
  info: string[];
}

export class HealthIndicator extends React.PureComponent<Props, HealthState> {
  static updateHealth = (health?: H.Health) => {
    if (health) {
      return { info: health.getReport(), globalStatus: health.getGlobalStatus() };
    } else {
      return { info: [], globalStatus: H.NA };
    }
  };

  static getDerivedStateFromProps(props: Props, state: HealthState) {
    return HealthIndicator.updateHealth(props.health);
  }

  constructor(props: Props) {
    super(props);
    this.state = HealthIndicator.updateHealth(props.health);
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

  renderSmall(health: H.Health) {
    return <span>{this.renderIndicator(health, '18px', '12px', this.state.globalStatus.name)}</span>;
  }

  renderLarge(health: H.Health) {
    return (
      <div style={{ color: this.state.globalStatus.color }}>
        {this.renderIndicator(health, '35px', '24px', this.state.globalStatus.name)}
        <br />
        {this.state.info.length === 1 && this.state.info[0]}
        {this.state.info.length > 1 && (
          <ul style={{ padding: 0 }}>
            {this.state.info.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  renderIndicator(health: H.Health, iconSize: string, textSize: string, title: string) {
    if (this.state.globalStatus.icon) {
      return (
        <HealthDetails id={this.props.id} health={health} headline={title} placement={this.props.tooltipPlacement}>
          <Icon
            type="pf"
            name={this.state.globalStatus.icon}
            style={{ fontSize: iconSize }}
            className="health-icon"
            tabIndex="0"
          />
        </HealthDetails>
      );
    } else {
      return (
        <span style={{ color: this.state.globalStatus.color, fontSize: textSize }}>{this.state.globalStatus.text}</span>
      );
    }
  }
}
