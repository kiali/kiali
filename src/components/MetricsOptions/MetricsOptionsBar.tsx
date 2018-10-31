import * as React from 'react';
import { Toolbar, ToolbarRightContent, FormGroup } from 'patternfly-react';
import isEqual from 'lodash/fp/isEqual';

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
  onLabelsFiltersChanged: (label: L.LabelName, value: string, checked: boolean) => void;
  metricReporter: string;
  direction: MetricsDirection;
  labelValues: Map<L.LabelName, L.LabelValues>;
}

export class MetricsOptionsBar extends React.Component<Props> {
  static PollIntervals = config().toolbar.pollInterval;
  static DefaultPollInterval = config().toolbar.defaultPollInterval;

  static Durations = config().toolbar.intervalDuration;
  static DefaultDuration = config().toolbar.defaultDuration;

  static ReporterOptions: { [key: string]: string } = {
    destination: 'Destination',
    source: 'Source'
  };

  private metricsSettings: MetricsSettings;
  private duration: number;
  private pollInterval: number;
  private shouldReportOptions: boolean;

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
    const quantiles = urlParams.get(URLParams.QUANTILES);
    if (quantiles !== null) {
      if (quantiles.trim().length !== 0) {
        settings.showQuantiles = quantiles.split(' ').map(val => val.trim() as Quantiles);
      } else {
        settings.showQuantiles = [];
      }
    }
    const byLabels = urlParams.getAll(URLParams.BY_LABELS);
    if (byLabels.length !== 0) {
      settings.activeLabels = byLabels as L.LabelName[];
    }
    return settings;
  };

  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    // Init state upstream
    this.reportOptions();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.shouldReportOptions) {
      this.shouldReportOptions = false;
      this.reportOptions();
    }
  }

  onPollIntervalChanged = (key: number) => {
    HistoryManager.setParam(URLParams.POLL_INTERVAL, String(key));
  };

  onDurationChanged = (key: number) => {
    sessionStorage.setItem(URLParams.DURATION, String(key));
    HistoryManager.setParam(URLParams.DURATION, String(key));
  };

  reportOptions() {
    // State-to-options converter (removes unnecessary properties)
    let labelsIn: L.PromLabel[] = [];
    let labelsOut: L.PromLabel[] = [];
    if (this.props.direction === MetricsDirection.INBOUND) {
      labelsIn = this.metricsSettings.activeLabels.map(lbl => L.INBOUND_LABELS.get(lbl)!);
    } else {
      labelsOut = this.metricsSettings.activeLabels.map(lbl => L.OUTBOUND_LABELS.get(lbl)!);
    }
    this.props.onOptionsChanged({
      duration: this.duration,
      byLabelsIn: labelsIn,
      byLabelsOut: labelsOut,
      avg: this.metricsSettings.showAverage,
      quantiles: this.metricsSettings.showQuantiles
    });
  }

  onReporterChanged = (reporter: string) => {
    HistoryManager.setParam(URLParams.REPORTER, reporter);
    this.props.onReporterChanged(reporter);
  };

  onMetricsSettingsChanged = (settings: MetricsSettings) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(URLParams.SHOW_AVERAGE, String(settings.showAverage));
    urlParams.set(URLParams.QUANTILES, settings.showQuantiles.join(' '));
    urlParams.delete(URLParams.BY_LABELS);
    settings.activeLabels.forEach(lbl => urlParams.append(URLParams.BY_LABELS, lbl));
    history.replace(history.location.pathname + '?' + urlParams.toString());
  };

  render() {
    this.processUrlParams();

    return (
      <Toolbar>
        <FormGroup>
          <MetricsSettingsDropdown
            onChanged={this.onMetricsSettingsChanged}
            onLabelsFiltersChanged={this.props.onLabelsFiltersChanged}
            labelValues={this.props.labelValues}
            {...this.metricsSettings}
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
          initialValue={this.duration}
          initialLabel={String(MetricsOptionsBar.Durations[this.duration])}
          options={MetricsOptionsBar.Durations}
        />
        <ToolbarRightContent>
          <Refresh
            id="metrics-refresh"
            handleRefresh={this.props.onRefresh}
            onSelect={this.onPollIntervalChanged}
            pollInterval={this.pollInterval}
          />
        </ToolbarRightContent>
      </Toolbar>
    );
  }

  private processUrlParams = () => {
    const urlParams = new URLSearchParams(history.location.search);
    const pollInterval = MetricsOptionsBar.initialPollInterval(urlParams);
    const duration = MetricsOptionsBar.initialDuration(urlParams);
    const metricsSettings = MetricsOptionsBar.initialMetricsSettings(urlParams);

    this.shouldReportOptions =
      pollInterval !== this.pollInterval ||
      duration !== this.duration ||
      !isEqual(metricsSettings)(this.metricsSettings);

    this.pollInterval = pollInterval;
    this.duration = duration;
    this.metricsSettings = metricsSettings;
  };
}

export default MetricsOptionsBar;
