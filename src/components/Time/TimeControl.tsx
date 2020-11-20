import * as React from 'react';
import RefreshContainer from '../Refresh/Refresh';
import TimeDurationContainer from './TimeDurationComponent';
import TimeRangeContainer from './TimeRangeComponent';

type Props = {
  customDuration: boolean;
};

export default class TimeControl extends React.Component<Props> {
  render() {
    const timeControlComponent = (
      <TimeDurationContainer key={'DurationDropdown'} id="app-info-duration-dropdown" disabled={false} />
    );
    const timeRangeComponent = (
      <div style={{ display: 'flex' }}>
        <TimeRangeContainer tooltip={'Time range'} />
        <RefreshContainer id="metrics-refresh" hideLabel={true} manageURL={true} />
      </div>
    );
    return this.props.customDuration ? timeRangeComponent : timeControlComponent;
  }
}
