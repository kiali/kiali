import * as React from 'react';

import history, { URLParams, HistoryManager } from '../../app/History';
import { config } from '../../config';
import { DurationInSeconds } from '../../types/Common';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import { KialiAppState, ServerConfig } from '../../store/Store';
import { serverConfigSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { getValidDurations, getValidDuration } from '../../config/serverConfig';

type ReduxProps = {
  serverConfig: ServerConfig;
};

type Props = ReduxProps & {
  onChanged: (duration: DurationInSeconds) => void;
};

export class MetricsDuration extends React.Component<Props> {
  static Durations = config.toolbar.intervalDuration;
  // Default to 10 minutes. Showing timeseries to only 1 minute doesn't make so much sense.
  static DefaultDuration = 600;

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
    this.duration = MetricsDuration.initialDuration();
  }

  onDurationChanged = (key: string) => {
    sessionStorage.setItem(URLParams.DURATION, key);
    HistoryManager.setParam(URLParams.DURATION, key);
    this.duration = Number(key);
    this.props.onChanged(this.duration);
  };

  render() {
    const retention = this.props.serverConfig.prometheus.storageTsdbRetention;
    const validDurations = getValidDurations(MetricsDuration.Durations, retention);
    const validDuration = getValidDuration(validDurations, this.duration);

    return (
      <ToolbarDropdown
        id={'metrics_filter_interval_duration'}
        disabled={false}
        handleSelect={this.onDurationChanged}
        nameDropdown={'Fetching'}
        initialValue={validDuration}
        initialLabel={validDurations[validDuration]}
        options={validDurations}
      />
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  serverConfig: serverConfigSelector(state)
});

const MetricsDurationContainer = connect(
  mapStateToProps,
  null
)(MetricsDuration);

export default MetricsDurationContainer;
