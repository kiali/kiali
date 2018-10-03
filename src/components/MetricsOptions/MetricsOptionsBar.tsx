import * as React from 'react';
import { Toolbar, ToolbarRightContent, FormGroup } from 'patternfly-react';

import Refresh from '../Refresh/Refresh';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import history, { URLParams, HistoryManager } from '../../app/History';
import { config } from '../../config';
import MetricsOptions from '../../types/MetricsOptions';
import { MetricsDirection } from '../../types/Metrics';

import { MetricsSettings, Quantiles, MetricsSettingsDropdown } from './MetricsSettings';
import { MetricsLabels as L } from './MetricsLabels';

interface Props {
  onOptionsChanged: (opts: MetricsOptions) => void;
  onReporterChanged: (reporter: string) => void;
  onRefresh: () => void;
  onLabelsFiltersChanged: (labels: Map<L.LabelName, L.LabelValues>) => void;
  metricReporter: string;
  direction: MetricsDirection;
  labelValues: Map<L.LabelName, L.LabelValues>;
}

interface MetricsOptionsState {
  pollInterval: number;
  duration: number;
  metricsSettings: MetricsSettings;
  labelValues: Map<L.LabelName, L.LabelValues>;
}

export class MetricsOptionsBar extends React.Component<Props, MetricsOptionsState> {
  static PollIntervals = config().toolbar.pollInterval;
  static DefaultPollInterval = config().toolbar.defaultPollInterval;

  static Durations = config().toolbar.intervalDuration;
  static DefaultDuration = config().toolbar.defaultDuration;

  static ReporterOptions: { [key: string]: string } = {
    destination: 'Destination',
    source: 'Source'
  };

  static getDerivedStateFromProps(props: Props, state: MetricsOptionsState) {
    const urlParams = new URLSearchParams(history.location.search);
    return {
      pollInterval: MetricsOptionsBar.initialPollInterval(urlParams),
      duration: MetricsOptionsBar.initialDuration(urlParams),
      metricsSettings: MetricsOptionsBar.initialMetricsSettings(urlParams),
      labelValues: props.labelValues
    };
  }

  static initialPollInterval = (urlParams: URLSearchParams): number => {
    const pi = urlParams.get(URLParams.POLL_INTERVAL);
    if (pi !== null) {
      return Number(pi);
    }
    return MetricsOptionsBar.DefaultPollInterval;
  };

  static initialDuration = (urlParams: URLSearchParams): number => {
    let d = urlParams.get(URLParams.DURATION);
    if (d !== null) {
      sessionStorage.setItem(URLParams.DURATION, d);
      return Number(d);
    }
    d = sessionStorage.getItem(URLParams.DURATION);
    return d !== null ? Number(d) : MetricsOptionsBar.DefaultDuration;
  };

  static initialMetricsSettings = (urlParams: URLSearchParams): MetricsSettings => {
    const settings: MetricsSettings = {
      showAverage: true,
      showQuantiles: ['0.5', '0.95', '0.99'],
      activeLabels: []
    };
    const avg = urlParams.get(URLParams.SHOW_AVERAGE);
    if (avg !== null) {
      settings.showAverage = avg === 'true';
    }
    const quantiles = urlParams.getAll(URLParams.QUANTILES);
    if (quantiles.length !== 0) {
      settings.showQuantiles = quantiles as Quantiles[];
    }
    const byLabels = urlParams.getAll(URLParams.BY_LABELS);
    if (byLabels.length !== 0) {
      settings.activeLabels = byLabels as L.LabelName[];
    }
    return settings;
  };

  constructor(props: Props) {
    super(props);
    this.state = MetricsOptionsBar.getDerivedStateFromProps(props, this.state);
  }

  componentDidMount() {
    // Init state upstream
    this.reportOptions();
  }

  onPollIntervalChanged = (key: number) => {
    HistoryManager.setParam(URLParams.POLL_INTERVAL, String(key));
    this.setState({ pollInterval: key });
  };

  onDurationChanged = (key: number) => {
    sessionStorage.setItem(URLParams.DURATION, String(key));
    HistoryManager.setParam(URLParams.DURATION, String(key));
    this.setState({ duration: key }, () => {
      this.reportOptions();
    });
  };

  reportOptions() {
    // State-to-options converter (removes unnecessary properties)
    let labelsIn: L.PromLabel[] = [];
    let labelsOut: L.PromLabel[] = [];
    if (this.props.direction === MetricsDirection.INBOUND) {
      labelsIn = this.state.metricsSettings.activeLabels.map(lbl => L.INBOUND_LABELS.get(lbl)!);
    } else {
      labelsOut = this.state.metricsSettings.activeLabels.map(lbl => L.OUTBOUND_LABELS.get(lbl)!);
    }
    this.props.onOptionsChanged({
      duration: this.state.duration,
      byLabelsIn: labelsIn,
      byLabelsOut: labelsOut,
      avg: this.state.metricsSettings.showAverage,
      quantiles: this.state.metricsSettings.showQuantiles
    });
  }

  onReporterChanged = (reporter: string) => {
    HistoryManager.setParam(URLParams.REPORTER, reporter);
    this.props.onReporterChanged(reporter);
  };

  onMetricsSettingsChanged = (settings: MetricsSettings) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(URLParams.SHOW_AVERAGE, String(settings.showAverage));
    urlParams.delete(URLParams.QUANTILES);
    urlParams.delete(URLParams.BY_LABELS);
    settings.showQuantiles.forEach(q => urlParams.append(URLParams.QUANTILES, q));
    settings.activeLabels.forEach(lbl => urlParams.append(URLParams.BY_LABELS, lbl));
    history.replace(history.location.pathname + '?' + urlParams.toString());
    this.setState({ metricsSettings: settings }, () => {
      this.reportOptions();
    });
  };

  render() {
    return (
      <Toolbar>
        <FormGroup>
          <MetricsSettingsDropdown
            onChanged={this.onMetricsSettingsChanged}
            onLabelsFiltersChanged={this.props.onLabelsFiltersChanged}
            labelValues={this.state.labelValues}
            {...this.state.metricsSettings}
          />
        </FormGroup>
        <FormGroup>
          <ToolbarDropdown
            id={'metrics_filter_reporter'}
            disabled={false}
            handleSelect={this.onReporterChanged}
            nameDropdown={'Reported from'}
            value={this.props.metricReporter}
            initialLabel={MetricsOptionsBar.ReporterOptions[this.props.metricReporter]}
            options={MetricsOptionsBar.ReporterOptions}
          />
        </FormGroup>
        <ToolbarDropdown
          id={'metrics_filter_interval_duration'}
          disabled={false}
          handleSelect={this.onDurationChanged}
          nameDropdown={'Displaying'}
          initialValue={this.state.duration}
          initialLabel={String(MetricsOptionsBar.Durations[this.state.duration])}
          options={MetricsOptionsBar.Durations}
        />
        <ToolbarRightContent>
          <Refresh
            id="metrics-refresh"
            handleRefresh={this.props.onRefresh}
            onSelect={this.onPollIntervalChanged}
            pollInterval={this.state.pollInterval}
          />
        </ToolbarRightContent>
      </Toolbar>
    );
  }
}

export default MetricsOptionsBar;
