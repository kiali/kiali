import * as React from 'react';

import {
  DurationInSeconds,
  BoundsInMilliseconds,
  guardTimeRange,
  TimeRange,
  durationToBounds,
  isEqualTimeRange
} from '../../types/Common';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import { serverConfig, humanDurations } from '../../config/ServerConfig';
import { retrieveTimeRange, storeTimeRange } from './TimeRangeHelper';
import { DateTimePicker } from './DateTimePicker';
import { KialiAppState } from '../../store/Store';
import { timeRangeSelector } from '../../store/Selectors';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { style } from 'typestyle';

type Props = {
  timeRange: TimeRange;
  tooltip: string;
  setTimeRange: (range: TimeRange) => void;
};

const labelStyle = style({
  margin: '5px 5px 0px 5px'
});

class TimeRangeComponent extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
    const range = retrieveTimeRange();
    if ((range.rangeDuration !== undefined || range.from !== undefined) && !isEqualTimeRange(props.timeRange, range)) {
      this.props.setTimeRange(range);
    }
    storeTimeRange(this.props.timeRange);
  }

  componentDidUpdate() {
    storeTimeRange(this.props.timeRange);
  }

  onDurationChanged = (key: string) => {
    let range: TimeRange = {};
    if (key === 'custom') {
      // Convert to bounds
      range = guardTimeRange(range, durationToBounds, b => b);
      range.rangeDuration = undefined;
    } else {
      range.rangeDuration = Number(key);
      range.from = undefined;
      range.to = undefined;
    }
    this.props.setTimeRange(range);
  };

  onStartPickerChanged = (d?: Date) => {
    let range: TimeRange = {};
    if (d) {
      range = guardTimeRange(range, durationToBounds, b => b);
      range.from = d.getTime();
      if (range.to && range.from > range.to) {
        range.from = range.to;
      }
      range.rangeDuration = undefined;
      this.props.setTimeRange(range);
    }
  };

  onEndPickerChanged = (d?: Date) => {
    const range = guardTimeRange(this.props.timeRange, durationToBounds, b => b);
    range.to = d ? d.getTime() : undefined;
    if (range.to && range.from && range.from > range.to) {
      range.to = range.from;
    }
    this.props.setTimeRange(range);
  };

  render() {
    return guardTimeRange(
      this.props.timeRange,
      d => this.renderDuration(d),
      ft => this.renderWithCustom(ft)
    );
  }

  renderDuration(d?: DurationInSeconds) {
    const durations = humanDurations(serverConfig, 'Last', undefined);
    const options = { custom: 'Custom', ...durations };
    return (
      <ToolbarDropdown
        id={'metrics_filter_interval_duration'}
        handleSelect={this.onDurationChanged}
        initialValue={d || 'custom'}
        value={d || 'custom'}
        initialLabel={d ? serverConfig.durations[d] : 'Custom'}
        options={options}
        tooltip={this.props.tooltip}
      />
    );
  }

  renderWithCustom(bounds: BoundsInMilliseconds) {
    return (
      <>
        {this.renderDuration()}
        <div className={labelStyle}>From</div>
        <DateTimePicker selected={bounds.from} onChange={date => this.onStartPickerChanged(date)} maxDate={bounds.to} />
        <div className={labelStyle}>To</div>
        <DateTimePicker selected={bounds.to} onChange={date => this.onEndPickerChanged(date)} minDate={bounds.from} />
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    timeRange: timeRangeSelector(state)
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setTimeRange: bindActionCreators(UserSettingsActions.setTimeRange, dispatch)
  };
};

const TimeRangeContainer = connect(mapStateToProps, mapDispatchToProps)(TimeRangeComponent);
export default TimeRangeContainer;
