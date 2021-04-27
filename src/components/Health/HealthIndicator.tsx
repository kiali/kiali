import * as React from 'react';
import { PopoverPosition, Tooltip } from '@patternfly/react-core';
import { HealthDetails } from './HealthDetails';
import * as H from '../../types/Health';
import { createIcon } from './Helper';
import './Health.css';

interface Props {
  id: string;
  health?: H.Health;
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
      // HealthIndicator will render always in SMALL mode
      const icon = createIcon(this.state.globalStatus, 'sm');
      return (
        <Tooltip
          aria-label={'Health indicator'}
          content={
            <div>
              <strong>{this.state.globalStatus.name}</strong>
              <HealthDetails health={this.props.health} />
            </div>
          }
          position={PopoverPosition.auto}
          className={'health_indicator'}
        >
          <>{icon}</>
        </Tooltip>
      );
    }
    return <span />;
  }
}
