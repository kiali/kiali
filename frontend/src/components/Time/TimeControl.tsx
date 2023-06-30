import * as React from 'react';
import { Refresh } from '../Refresh/Refresh';
import { TimeDurationComponent } from './TimeDurationComponent';
import { TimeRangeComponent } from './TimeRangeComponent';

type Props = {
  customDuration: boolean;
};

export class TimeControl extends React.Component<Props> {
  render() {
    const timeControlComponent = (
      <TimeDurationComponent key={'DurationDropdown'} id="app-info-duration-dropdown" disabled={false} />
    );
    const timeRangeComponent = (
      <div style={{ display: 'flex' }}>
        <TimeRangeComponent manageURL={true} tooltip={'Time range'} />
        <Refresh id="metrics-refresh" hideLabel={true} manageURL={true} />
      </div>
    );
    return this.props.customDuration ? timeRangeComponent : timeControlComponent;
  }
}
