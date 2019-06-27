import * as React from 'react';
import { OverlayTrigger, Popover } from 'patternfly-react';
import { HealthDetails } from './HealthDetails';
import * as H from '../../types/Health';
import { createIcon } from './Helper';

import './Health.css';

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
    return this.renderPopover(health, createIcon(this.state.globalStatus, 'sm'));
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
        {createIcon(this.state.globalStatus, 'lg')}
        <span style={spanStyle}>{this.state.globalStatus.name}</span>
        <br />
        <br />
        <HealthDetails health={health} />
      </>
    );
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
