import * as React from 'react';
import { Toolbar, ToolbarRightContent, FormGroup } from 'patternfly-react';
import isEqual from 'lodash/fp/isEqual';

import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import history, { URLParams, HistoryManager } from '../../app/History';
import { config } from '../../config';
import MetricsOptions from '../../types/MetricsOptions';
import { MetricsDirection } from '../../types/Metrics';

import { MetricsSettings, Quantiles, MetricsSettingsDropdown } from './MetricsSettings';
import { MetricsLabels as L } from './MetricsLabels';
import { DurationInSeconds } from '../../types/Common';
import RefreshContainer from '../../containers/RefreshContainer';

export interface MetricsOptionsBarProps {
  onOptionsChanged: (opts: MetricsOptions) => void;
  onReporterChanged: (reporter: string) => void;
  onRefresh: () => void;
  onLabelsFiltersChanged: (label: L.LabelName, value: string, checked: boolean) => void;
  metricReporter: string;
  direction: MetricsDirection;
  labelValues: Map<L.LabelName, L.LabelValues>;
  duration: DurationInSeconds;
  setDuration: (duration: DurationInSeconds) => void;
}

export class MetricsOptionsBar extends React.Component<MetricsOptionsBarProps> {
  static DefaultPollInterval = config().toolbar.defaultPollInterval;

  static Durations = config().toolbar.intervalDuration;

  static ReporterOptions: { [key: string]: string } = {
    destination: 'Destination',
    source: 'Source'
  };

  private metricsSettings: MetricsSettings;
  private pollInterval: number;
  private shouldReportOptions: boolean;

  static initialPollInterval = (urlParams: URLSearchParams): number => {
    const pi = urlParams.get(URLParams.POLL_INTERVAL);
    if (pi !== null) {
      return Number(pi);
    }
    return MetricsOptionsBar.DefaultPollInterval;
  };

  static initialDuration = (urlParams: URLSearchParams, defaultDuration: DurationInSeconds): DurationInSeconds => {
    let d = urlParams.get(URLParams.DURATION);
    if (d !== null) {
      sessionStorage.setItem(URLParams.DURATION, d);
      return Number(d);
    }
    d = sessionStorage.getItem(URLParams.DURATION);
    return d !== null ? Number(d) : defaultDuration;
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

  constructor(props: MetricsOptionsBarProps) {
    super(props);
  }

  componentDidMount() {
    // Init state upstream
    this.reportOptions();
  }

  componentDidUpdate(prevProps: MetricsOptionsBarProps) {
    if (this.shouldReportOptions) {
      this.shouldReportOptions = false;
      this.reportOptions();
    }
  }

  onDurationChanged = (key: number) => {
    this.props.setDuration(key); // send a Redux action to change duration
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
      duration: this.props.duration,
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
          initialValue={this.props.duration}
          initialLabel={String(MetricsOptionsBar.Durations[this.props.duration])}
          options={MetricsOptionsBar.Durations}
        />
        <ToolbarRightContent>
          <RefreshContainer id="metrics-refresh" handleRefresh={this.props.onRefresh} />
        </ToolbarRightContent>
      </Toolbar>
    );
  }

  private processUrlParams = () => {
    const urlParams = new URLSearchParams(history.location.search);
    const pollInterval = MetricsOptionsBar.initialPollInterval(urlParams);
    const duration = MetricsOptionsBar.initialDuration(urlParams, this.props.duration);
    const metricsSettings = MetricsOptionsBar.initialMetricsSettings(urlParams);

    this.shouldReportOptions =
      pollInterval !== this.pollInterval ||
      duration !== this.props.duration ||
      !isEqual(metricsSettings)(this.metricsSettings);

    this.pollInterval = pollInterval;
    this.metricsSettings = metricsSettings;
  };
}

export default MetricsOptionsBar;
