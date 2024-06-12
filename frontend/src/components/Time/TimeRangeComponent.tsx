import * as React from 'react';

import {
  DurationInSeconds,
  BoundsInMilliseconds,
  guardTimeRange,
  TimeRange,
  durationToBounds,
  isEqualTimeRange
} from '../../types/Common';
import { ToolbarDropdown } from '../Dropdown/ToolbarDropdown';
import { serverConfig, humanDurations } from '../../config/ServerConfig';
import { retrieveTimeRange, storeTimeRange } from './TimeRangeHelper';
import { DateTimePicker } from './DateTimePicker';
import { KialiAppState } from '../../store/Store';
import { timeRangeSelector } from '../../store/Selectors';
import { KialiDispatch } from 'types/Redux';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

type ReduxStateProps = {
  timeRange: TimeRange;
};

type ReduxDispatchProps = {
  setTimeRange: (range: TimeRange) => void;
};

type Props = ReduxStateProps &
  ReduxDispatchProps & {
    manageURL?: boolean;
    tooltip: string;
  };

const labelStyle = kialiStyle({
  margin: '0.25rem 0.25rem 0 0.25rem'
});

export class TimeRangeComp extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
    const range = retrieveTimeRange();

    if ((range.rangeDuration !== undefined || range.from !== undefined) && !isEqualTimeRange(props.timeRange, range)) {
      this.props.setTimeRange(range);
    }

    this.storeTimeRange(this.props.timeRange);
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.timeRange !== this.props.timeRange) {
      this.storeTimeRange(this.props.timeRange);
    }
  }

  onDurationChanged = (key: string): void => {
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

  onStartPickerChanged = (d?: Date): void => {
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

  onEndPickerChanged = (d?: Date): void => {
    const range = guardTimeRange(this.props.timeRange, durationToBounds, b => b);
    range.to = d ? d.getTime() : undefined;

    if (range.to && range.from && range.from > range.to) {
      range.to = range.from;
    }

    this.props.setTimeRange(range);
  };

  render(): React.ReactNode {
    return guardTimeRange(
      this.props.timeRange,
      d => this.renderDuration(d),
      ft => this.renderWithCustom(ft)
    );
  }

  renderDuration = (d?: DurationInSeconds): React.ReactNode => {
    const durations = humanDurations(serverConfig, t('Last'), undefined);
    const options = { custom: t('Custom'), ...durations };
    const value = d ?? 'custom';

    return (
      <ToolbarDropdown
        id={'metrics_filter_interval_duration'}
        handleSelect={this.onDurationChanged}
        value={value}
        label={options[value]}
        options={options}
        tooltip={this.props.tooltip}
      />
    );
  };

  renderWithCustom = (bounds: BoundsInMilliseconds): React.ReactNode => {
    return (
      <>
        {this.renderDuration()}
        <div className={labelStyle}>From</div>
        <DateTimePicker selected={bounds.from} onChange={date => this.onStartPickerChanged(date)} maxDate={bounds.to} />
        <div className={labelStyle}>To</div>
        <DateTimePicker selected={bounds.to} onChange={date => this.onEndPickerChanged(date)} minDate={bounds.from} />
      </>
    );
  };

  private storeTimeRange = (timeRange: TimeRange): void => {
    if (this.props.manageURL) {
      storeTimeRange(timeRange);
    }
  };
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => {
  return {
    timeRange: timeRangeSelector(state)
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    setTimeRange: bindActionCreators(UserSettingsActions.setTimeRange, dispatch)
  };
};

export const TimeRangeComponent = connect(mapStateToProps, mapDispatchToProps)(TimeRangeComp);
