import * as React from 'react';

import history, { URLParams, HistoryManager } from '../../app/History';
import { config } from '../../config';
import { DurationInSeconds } from '../../types/Common';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';

interface Props {
  onChanged: (duration: DurationInSeconds) => void;
}

export default class MetricsDuration extends React.Component<Props> {
  static Durations = config().toolbar.intervalDuration;
  // Default to 10 minutes. Showing timeseries to only 1 minute doesn't make so much sense.
  static DefaultDuration = 600;

  private shouldReportOptions: boolean;
  private duration: DurationInSeconds;

  static initialDuration = (): DurationInSeconds => {
    const urlParams = new URLSearchParams(history.location.search);
    let d = urlParams.get(URLParams.DURATION);
    if (d !== null) {
      sessionStorage.setItem(URLParams.DURATION, d);
      return Number(d);
    }
    d = sessionStorage.getItem(URLParams.DURATION);
    return d !== null ? Number(d) : MetricsDuration.DefaultDuration;
  };

  constructor(props: Props) {
    super(props);
  }

  componentDidUpdate() {
    if (this.shouldReportOptions) {
      this.shouldReportOptions = false;
      this.props.onChanged(this.duration);
    }
  }

  onDurationChanged = (key: number) => {
    sessionStorage.setItem(URLParams.DURATION, String(key));
    HistoryManager.setParam(URLParams.DURATION, String(key));
  };

  render() {
    this.processUrlParams();
    return (
      <ToolbarDropdown
        id={'metrics_filter_interval_duration'}
        disabled={false}
        handleSelect={this.onDurationChanged}
        nameDropdown={'Fetching'}
        initialValue={this.duration}
        initialLabel={MetricsDuration.Durations[this.duration]}
        options={MetricsDuration.Durations}
      />
    );
  }

  processUrlParams() {
    const duration = MetricsDuration.initialDuration();
    this.shouldReportOptions = duration !== this.duration;
    this.duration = duration;
  }
}
