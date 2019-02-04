import * as React from 'react';
import { Icon, OverlayTrigger, Popover } from 'patternfly-react';
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
}

export class HealthIndicator extends React.PureComponent<Props, HealthState> {
  static getDerivedStateFromProps(props: Props) {
    return {
      globalStatus: props.health ? props.health.getGlobalStatus() : H.NA
    };
  }

  constructor(props: Props) {
    super(props);
    this.state = HealthIndicator.getDerivedStateFromProps(props);
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
    const icon = this.renderIcon('18px', '12px');
    return this.renderPopover(health, icon);
  }

  renderLarge(health: H.Health) {
    const spanStyle: React.CSSProperties = {
      color: this.state.globalStatus.color,
      fontWeight: 'bold',
      position: 'relative',
      top: -9,
      left: 10
    };
    return (
      <>
        {this.renderIcon('35px', '24px')}
        <span style={spanStyle}>{this.state.globalStatus.name}</span>
        <br />
        <br />
        <HealthDetails health={health} />
      </>
    );
  }

  renderIcon(iconSize: string, textSize: string) {
    if (this.state.globalStatus.icon) {
      return (
        <Icon
          type="pf"
          name={this.state.globalStatus.icon}
          style={{ fontSize: iconSize }}
          className="health-icon"
          tabIndex="0"
        />
      );
    } else {
      return (
        <span style={{ color: this.state.globalStatus.color, fontSize: textSize }}>{this.state.globalStatus.text}</span>
      );
    }
  }

  renderPopover(health: H.Health, icon: JSX.Element) {
    const popover = (
      <Popover id={this.props.id + '-health-tooltip'} title={this.state.globalStatus.name}>
        <HealthDetails health={health} />
      </Popover>
    );
    return (
      <OverlayTrigger
        placement={this.props.tooltipPlacement || 'right'}
        overlay={popover}
        trigger={['hover', 'focus']}
        rootClose={false}
      >
        {icon}
      </OverlayTrigger>
    );
  }
}
