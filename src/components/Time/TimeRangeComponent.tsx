import * as React from 'react';

import {
  DurationInSeconds,
  BoundsInMilliseconds,
  guardTimeRange,
  TimeRange,
  durationToBounds
} from '../../types/Common';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import { serverConfig, humanDurations } from '../../config/ServerConfig';
import { defaultMetricsDuration } from 'components/Metrics/Helper';
import { retrieveTimeRange, retrieveDuration, storeBounds, storeDuration } from './TimeRangeHelper';
import { DateTimePicker } from './DateTimePicker';

type Props = {
  range?: TimeRange;
  allowCustom: boolean;
  tooltip: string;
  onChanged: (range: TimeRange) => void;
};

export default class TimeRangeComponent extends React.Component<Props> {
  private range: TimeRange;

  constructor(props: Props) {
    super(props);
    if (props.range) {
      this.range = props.range;
    } else {
      this.range = (this.props.allowCustom ? retrieveTimeRange() : retrieveDuration()) || defaultMetricsDuration;
    }
  }

  componentDidUpdate(prev: Props) {
    if (this.props.range && prev.range !== this.props.range) {
      this.range = this.props.range;
    }
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
    return guardTimeRange(
      this.range,
      d => this.renderDuration(d),
      ft => this.renderWithCustom(ft)
    );
  }

  renderDuration(d?: DurationInSeconds) {
    const durations = humanDurations(serverConfig, 'Last', undefined);
    const options = this.props.allowCustom ? { custom: 'Custom', ...durations } : durations;
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
        {' From '}
        <DateTimePicker selected={bounds.from} onChange={date => this.onStartPickerChanged(date)} maxDate={bounds.to} />
        {' To '}
        <DateTimePicker selected={bounds.to} onChange={date => this.onEndPickerChanged(date)} minDate={bounds.from} />
      </>
    );
  }
}
