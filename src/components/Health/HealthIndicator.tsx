import * as React from 'react';
import { PopoverPosition, Text, TextContent, TextVariants, Tooltip } from '@patternfly/react-core';
import { HealthDetails } from './HealthDetails';
import * as H from '../../types/Health';
import { createIcon } from './Helper';
import './Health.css';
import { PfColors } from '../Pf/PfColors';

export enum DisplayMode {
  LARGE,
  SMALL
}

interface Props {
  id: string;
  health?: H.Health;
  mode: DisplayMode;
  tooltipPlacement?: PopoverPosition;
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
  renderHealthTooltip(health: H.Health) {
    return (
      <TextContent style={{ color: PfColors.White }}>
        <Text component={TextVariants.h2}>{this.state.globalStatus.name}</Text>
        <HealthDetails health={health} />
      </TextContent>
    );
  }

  renderPopover(health: H.Health, icon: JSX.Element) {
    return (
      <Tooltip
        aria-label={'Health indicator'}
        content={this.renderHealthTooltip(health)}
        position={PopoverPosition.auto}
        className={'health_indicator'}
      >
        {icon}
      </Tooltip>
    );
  }
}
