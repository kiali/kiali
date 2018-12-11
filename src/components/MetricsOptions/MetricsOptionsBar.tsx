import * as React from 'react';
import { Toolbar, ToolbarRightContent, FormGroup, Icon } from 'patternfly-react';
import isEqual from 'lodash/fp/isEqual';

import RefreshContainer from '../../containers/RefreshContainer';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import history, { URLParams, HistoryManager } from '../../app/History';
import { config } from '../../config';
import MetricsOptions, { Reporter, Direction } from '../../types/MetricsOptions';
import { DurationInSeconds } from '../../types/Common';

import { MetricsSettings, Quantiles, MetricsSettingsDropdown } from './MetricsSettings';
import { MetricsLabels as L } from './MetricsLabels';

export interface MetricsOptionsBarProps {
  onOptionsChanged: (opts: MetricsOptions) => void;
  onRefresh: () => void;
  onLabelsFiltersChanged: (label: L.LabelName, value: string, checked: boolean) => void;
  direction: Direction;
  labelValues: Map<L.LabelName, L.LabelValues>;
  grafanaLink: string;
}

export class MetricsOptionsBar extends React.Component<MetricsOptionsBarProps> {
  static DefaultPollInterval = config().toolbar.defaultPollInterval;
  static Durations = config().toolbar.intervalDuration;
  // Default to 10 minutes. Showing timeseries to only 1 minute doesn't make so much sense.
  static DefaultDuration = 600;
  static ReporterOptions: { [key: string]: string } = {
    destination: 'Destination',
    source: 'Source'
  };

  private metricsSettings: MetricsSettings;
  private duration: DurationInSeconds;
  private pollInterval: number;
  private reporter: Reporter;
  private shouldReportOptions: boolean;

  static initialPollInterval = (urlParams: URLSearchParams): number => {
    const pi = urlParams.get(URLParams.POLL_INTERVAL);
    if (pi !== null) {
      return Number(pi);
    }
    return MetricsOptionsBar.DefaultPollInterval;
  };

  static initialDuration = (urlParams: URLSearchParams): DurationInSeconds => {
    let d = urlParams.get(URLParams.DURATION);
    if (d !== null) {
      sessionStorage.setItem(URLParams.DURATION, d);
      return Number(d);
    }
    d = sessionStorage.getItem(URLParams.DURATION);
    return d !== null ? Number(d) : MetricsOptionsBar.DefaultDuration;
  };

  static initialReporter = (urlParams: URLSearchParams, direction: Direction): string => {
    const reporterParam = urlParams.get(URLParams.REPORTER);
    if (reporterParam != null) {
      return reporterParam;
    }
    return direction === 'inbound' ? 'destination' : 'source';
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
    sessionStorage.setItem(URLParams.DURATION, String(key));
    HistoryManager.setParam(URLParams.DURATION, String(key));
  };

  reportOptions() {
    // State-to-options converter (removes unnecessary properties)
    const labels: L.PromLabel[] =
      this.props.direction === 'inbound'
        ? this.metricsSettings.activeLabels.map(lbl => L.INBOUND_LABELS.get(lbl)!)
        : this.metricsSettings.activeLabels.map(lbl => L.OUTBOUND_LABELS.get(lbl)!);
    this.props.onOptionsChanged({
      duration: this.duration,
      byLabels: labels,
      avg: this.metricsSettings.showAverage,
      quantiles: this.metricsSettings.showQuantiles,
      reporter: this.reporter,
      direction: this.props.direction
    });
  }

  onReporterChanged = (reporter: string) => {
    HistoryManager.setParam(URLParams.REPORTER, reporter);
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
            value={this.reporter}
            initialLabel={MetricsOptionsBar.ReporterOptions[this.reporter]}
            options={MetricsOptionsBar.ReporterOptions}
          />
        </FormGroup>
        {this.props.grafanaLink && (
          <FormGroup style={{ borderRight: 'none' }}>
            <a id={'grafana_link'} href={this.props.grafanaLink} target="_blank">
              View in Grafana <Icon type={'fa'} name={'external-link'} />
            </a>
          </FormGroup>
        )}
        <ToolbarRightContent>
          <ToolbarDropdown
            id={'metrics_filter_interval_duration'}
            disabled={false}
            handleSelect={this.onDurationChanged}
            nameDropdown={'Fetching'}
            initialValue={this.duration}
            initialLabel={String(MetricsOptionsBar.Durations[this.duration])}
            options={MetricsOptionsBar.Durations}
          />
          <RefreshContainer id="metrics-refresh" handleRefresh={this.props.onRefresh} hideLabel={true} />
        </ToolbarRightContent>
      </Toolbar>
    );
  }

  private processUrlParams = () => {
    const urlParams = new URLSearchParams(history.location.search);
    const pollInterval = MetricsOptionsBar.initialPollInterval(urlParams);
    const duration = MetricsOptionsBar.initialDuration(urlParams);
    const metricsSettings = MetricsOptionsBar.initialMetricsSettings(urlParams);
    const reporter = MetricsOptionsBar.initialReporter(urlParams, this.props.direction) as Reporter;

    this.shouldReportOptions =
      pollInterval !== this.pollInterval ||
      duration !== this.duration ||
      !isEqual(metricsSettings)(this.metricsSettings) ||
      reporter !== this.reporter;

    this.pollInterval = pollInterval;
    this.metricsSettings = metricsSettings;
    this.duration = duration;
    this.reporter = reporter;
  };
}

export default MetricsOptionsBar;
