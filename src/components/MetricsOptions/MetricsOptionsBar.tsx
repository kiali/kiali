import * as React from 'react';
import { Toolbar, ToolbarRightContent, FormGroup, Icon } from 'patternfly-react';
import isEqual from 'lodash/fp/isEqual';

import RefreshContainer from '../../containers/RefreshContainer';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import history, { URLParams, HistoryManager } from '../../app/History';
import { config } from '../../config';
import { DurationInSeconds } from '../../types/Common';
import { LabelDisplayName, AllLabelsValues, PromLabel, Aggregation } from '../../types/Metrics';
import { BaseMetricsOptions } from '../../types/MetricsOptions';

import { MetricsSettings, Quantiles, MetricsSettingsDropdown } from './MetricsSettings';

export interface MetricsOptionsBarProps {
  onOptionsChanged: (opts: BaseMetricsOptions) => void;
  onRefresh: () => void;
  onLabelsFiltersChanged: (label: LabelDisplayName, value: string, checked: boolean) => void;
  labelValues: AllLabelsValues;
  aggregations: Aggregation[];
  grafanaLink?: string;
}

export class MetricsOptionsBar<T> extends React.Component<MetricsOptionsBarProps & T> {
  static DefaultPollInterval = config().toolbar.defaultPollInterval;
  static Durations = config().toolbar.intervalDuration;
  // Default to 10 minutes. Showing timeseries to only 1 minute doesn't make so much sense.
  static DefaultDuration = 600;

  protected shouldReportOptions: boolean;
  private metricsSettings: MetricsSettings;
  private duration: DurationInSeconds;
  private pollInterval: number;

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
      settings.activeLabels = byLabels as LabelDisplayName[];
    }
    return settings;
  };

  constructor(props: MetricsOptionsBarProps & T) {
    super(props);
  }

  componentDidMount() {
    // Init state upstream
    this.reportOptions();
  }

  componentDidUpdate(prevProps: MetricsOptionsBarProps & T) {
    if (this.shouldReportOptions) {
      this.shouldReportOptions = false;
      this.reportOptions();
    }
  }

  onDurationChanged = (key: number) => {
    sessionStorage.setItem(URLParams.DURATION, String(key));
    HistoryManager.setParam(URLParams.DURATION, String(key));
  };

  protected reportOptions() {
    const opts = this.buildBaseOptions();
    this.props.onOptionsChanged(opts);
  }

  buildBaseOptions(): BaseMetricsOptions {
    // State-to-options converter (removes unnecessary properties)
    const labels: PromLabel[] = [];
    this.metricsSettings.activeLabels.forEach(lbl => {
      const agg = this.props.aggregations.find(a => a.displayName === lbl);
      if (agg) {
        labels.push(agg.label);
      }
    });
    return {
      duration: this.duration,
      byLabels: labels,
      avg: this.metricsSettings.showAverage,
      quantiles: this.metricsSettings.showQuantiles
    };
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
    this.processUrlParams(new URLSearchParams(history.location.search));
    return this.renderToolbar();
  }

  protected renderToolbar() {
    return (
      <Toolbar>
        {this.renderMetricsSettings()}
        {this.renderGrafanaLink()}
        {this.renderRightContent()}
      </Toolbar>
    );
  }

  renderMetricsSettings() {
    return (
      <FormGroup>
        <MetricsSettingsDropdown
          onChanged={this.onMetricsSettingsChanged}
          onLabelsFiltersChanged={this.props.onLabelsFiltersChanged}
          labelValues={this.props.labelValues}
          {...this.metricsSettings}
        />
      </FormGroup>
    );
  }

  renderRightContent() {
    return (
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
    );
  }

  renderGrafanaLink() {
    return (
      this.props.grafanaLink && (
        <FormGroup style={{ borderRight: 'none' }}>
          <a id={'grafana_link'} href={this.props.grafanaLink} target="_blank" rel="noopener noreferrer">
            View in Grafana <Icon type={'fa'} name={'external-link'} />
          </a>
        </FormGroup>
      )
    );
  }

  protected processUrlParams(urlParams: URLSearchParams) {
    const pollInterval = MetricsOptionsBar.initialPollInterval(urlParams);
    const duration = MetricsOptionsBar.initialDuration(urlParams);
    const metricsSettings = MetricsOptionsBar.initialMetricsSettings(urlParams);

    this.shouldReportOptions =
      pollInterval !== this.pollInterval ||
      duration !== this.duration ||
      !isEqual(metricsSettings)(this.metricsSettings);

    this.pollInterval = pollInterval;
    this.metricsSettings = metricsSettings;
    this.duration = duration;
  }

  markReportFlag() {
    this.shouldReportOptions = true;
  }
}

export default MetricsOptionsBar;
