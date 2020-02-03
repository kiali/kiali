import * as React from 'react';

import {
  DurationInSeconds,
  BoundsInMilliseconds,
  guardTimeRange,
  TimeRange,
  durationToBounds
} from '../../types/Common';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import { serverConfig } from '../../config/ServerConfig';
import { defaultMetricsDuration } from 'components/Metrics/Helper';
import { retrieveTimeRange, retrieveDuration, storeBounds, storeDuration } from './TimeRangeHelper';
import { DateTimePicker } from './DateTimePicker';

type Props = {
  allowCustom: boolean;
  tooltip: string;
  onChanged: (range: TimeRange) => void;
};

export default class TimeRangeComponent extends React.Component<Props> {
  private range: TimeRange;

  constructor(props: Props) {
    super(props);
    this.range = (this.props.allowCustom ? retrieveTimeRange() : retrieveDuration()) || defaultMetricsDuration;
  }

  onDurationChanged = (key: string) => {
    if (key === 'custom') {
      // Convert to bounds
      this.range = guardTimeRange(this.range, durationToBounds, b => b);
      storeBounds(this.range);
    } else {
      this.range = Number(key);
      storeDuration(this.range);
    }
    this.props.onChanged(this.range);
  };

  onStartPickerChanged = (d?: Date) => {
    if (d) {
      this.range = guardTimeRange(this.range, durationToBounds, b => b);
      this.range.from = d.getTime();
      if (this.range.to && this.range.from > this.range.to) {
        this.range.from = this.range.to;
      }
      storeBounds(this.range);
      this.props.onChanged(this.range);
    }
  };

  onEndPickerChanged = (d?: Date) => {
    this.range = guardTimeRange(this.range, durationToBounds, b => b);
    this.range.to = d ? d.getTime() : undefined;
    if (this.range.to && this.range.from > this.range.to) {
      this.range.to = this.range.from;
    }
    storeBounds(this.range);
    this.props.onChanged(this.range);
  };

  render() {
    return guardTimeRange(this.range, d => this.renderDuration(d), ft => this.renderWithCustom(ft));
  }

  renderDuration(d?: DurationInSeconds) {
    const options = this.props.allowCustom ? { custom: 'Custom', ...serverConfig.durations } : serverConfig.durations;
    return (
      <ToolbarDropdown
        id={'metrics_filter_interval_duration'}
        handleSelect={this.onDurationChanged}
        initialValue={d || 'custom'}
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
        {' From '}
        <DateTimePicker selected={bounds.from} onChange={date => this.onStartPickerChanged(date)} maxDate={bounds.to} />
        {' To '}
        <DateTimePicker selected={bounds.to} onChange={date => this.onEndPickerChanged(date)} minDate={bounds.from} />
      </>
    );
  }
}
