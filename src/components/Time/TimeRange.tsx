import * as React from 'react';
import { connect } from 'react-redux';
import { DurationDropdownContainer } from '../DurationDropdown/DurationDropdown';
import RefreshContainer from 'components/Refresh/Refresh';

type ReduxProps = {};

type TimeRangeProps = ReduxProps & {
  disabled: boolean;
  id: string;

  handleRefresh: () => void;
};

export class TimeRange extends React.PureComponent<TimeRangeProps> {
  render() {
    return (
      <>
        <DurationDropdownContainer
          id={'time_range_duration'}
          disabled={this.props.disabled}
          tooltip={'Duration for metric queries'}
        />
        <RefreshContainer
          id="time_range_refresh"
          disabled={this.props.disabled}
          hideLabel={true}
          handleRefresh={this.props.handleRefresh}
          manageURL={true}
        />
      </>
    );
  }
}

const TimeRangeContainer = connect(
  null,
  null
)(TimeRange);

export default TimeRangeContainer;
