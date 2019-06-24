import * as React from 'react';
import { Button, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import { style } from 'typestyle';
import isEqual from 'lodash/fp/isEqual';
import { LabelDisplayName } from 'k-charted-react';

import history, { URLParam } from '../../app/History';
import { AllLabelsValues } from '../../types/Metrics';

export type Quantiles = '0.5' | '0.95' | '0.99' | '0.999';
const allQuantiles: Quantiles[] = ['0.5', '0.95', '0.99', '0.999'];

export interface MetricsSettings {
  activeLabels: LabelDisplayName[];
  showAverage: boolean;
  showQuantiles: Quantiles[];
}

interface Props {
  onChanged: (state: MetricsSettings) => void;
  onLabelsFiltersChanged: (label: LabelDisplayName, value: string, checked: boolean) => void;
  labelValues: AllLabelsValues;
  hasHistograms: boolean;
}

const checkboxStyle = style({ marginLeft: 5 });
const secondLevelStyle = style({ marginLeft: 14 });
const spacerStyle = style({ height: '1em' });

export class MetricsSettingsDropdown extends React.Component<Props> {
  private shouldReportOptions = false;
  private settings: MetricsSettings = MetricsSettingsDropdown.initialMetricsSettings();

  static initialMetricsSettings = (): MetricsSettings => {
    const urlParams = new URLSearchParams(history.location.search);
    const settings: MetricsSettings = {
      showAverage: true,
      showQuantiles: ['0.5', '0.95', '0.99'],
      activeLabels: []
    };
    const avg = urlParams.get(URLParam.SHOW_AVERAGE);
    if (avg !== null) {
      settings.showAverage = avg === 'true';
    }
    const quantiles = urlParams.get(URLParam.QUANTILES);
    if (quantiles !== null) {
      if (quantiles.trim().length !== 0) {
        settings.showQuantiles = quantiles.split(' ').map(val => val.trim() as Quantiles);
      } else {
        settings.showQuantiles = [];
      }
    }
    const byLabels = urlParams.getAll(URLParam.BY_LABELS);
    if (byLabels.length !== 0) {
      byLabels.forEach((val, idx) => {
        byLabels[idx] = val.split('=', 1)[0];
      });
      settings.activeLabels = byLabels as LabelDisplayName[];
    }
    return settings;
  };

  componentDidUpdate() {
    if (this.shouldReportOptions) {
      this.shouldReportOptions = false;
      this.props.onChanged(this.settings);
    }
  }

  onGroupingChanged = (label: LabelDisplayName, checked: boolean) => {
    const newLabels = checked
      ? [label].concat(this.settings.activeLabels)
      : this.settings.activeLabels.filter(g => label !== g);

    const urlParams = new URLSearchParams(history.location.search);
    urlParams.delete(URLParam.BY_LABELS);
    newLabels.forEach(lbl => urlParams.append(URLParam.BY_LABELS, lbl));
    history.replace(history.location.pathname + '?' + urlParams.toString());
  };

  onHistogramAverageChanged = (checked: boolean) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(URLParam.SHOW_AVERAGE, String(checked));
    history.replace(history.location.pathname + '?' + urlParams.toString());
  };

  onHistogramOptionsChanged = (quantile: Quantiles, checked: boolean) => {
    const newQuantiles = checked
      ? [quantile].concat(this.settings.showQuantiles)
      : this.settings.showQuantiles.filter(q => quantile !== q);

    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(URLParam.QUANTILES, newQuantiles.join(' '));
    history.replace(history.location.pathname + '?' + urlParams.toString());
  };

  render() {
    const hasHistograms = this.props.hasHistograms;
    const hasLabels = this.props.labelValues.size > 0;
    if (!hasHistograms && !hasLabels) {
      return null;
    }

    this.processUrlParams();

    const metricsSettingsPopover = (
      <Popover id="layers-popover">
        {hasLabels && this.renderLabelOptions()}
        {hasHistograms && this.renderHistogramOptions()}
      </Popover>
    );

    return (
      <OverlayTrigger overlay={metricsSettingsPopover} placement="bottom" trigger={['click']} rootClose={true}>
        <Button>
          Metrics Settings <Icon name="angle-down" />
        </Button>
      </OverlayTrigger>
    );
  }

  renderLabelOptions(): JSX.Element {
    const displayGroupingLabels: any[] = [];
    this.props.labelValues.forEach((values, name) => {
      const checked = this.settings.activeLabels.includes(name);
      const labelsHTML = values
        ? Object.keys(values).map(val => (
            <div key={'groupings_' + name + '_' + val} className={secondLevelStyle}>
              <label>
                <input
                  type="checkbox"
                  checked={values[val]}
                  onChange={event => this.props.onLabelsFiltersChanged(name, val, event.target.checked)}
                />
                <span className={checkboxStyle}>{val}</span>
              </label>
            </div>
          ))
        : null;
      displayGroupingLabels.push(
        <div key={'groupings_' + name}>
          <label>
            <input
              type="checkbox"
              checked={checked}
              onChange={event => this.onGroupingChanged(name, event.target.checked)}
            />
            <span className={checkboxStyle}>{name}</span>
          </label>
          {checked && labelsHTML}
        </div>
      );
    });
    return (
      <>
        <label>Show metrics by:</label>
        {displayGroupingLabels}
        <div className={spacerStyle} />
      </>
    );
  }

  renderHistogramOptions(): JSX.Element {
    // Prettier removes the parenthesis introducing JSX
    // prettier-ignore
    const displayHistogramOptions = [(
      <div key={'histo_avg'}>
        <label>
          <input
            type="checkbox"
            checked={this.settings.showAverage}
            onChange={event => this.onHistogramAverageChanged(event.target.checked)}
          />
          <span className={checkboxStyle}>Average</span>
        </label>
      </div>
    )].concat(
      allQuantiles.map((o, idx) => {
        const checked = this.settings.showQuantiles.includes(o);
        return (
          <div key={'histo_' + idx}>
            <label>
              <input
                type="checkbox"
                checked={checked}
                onChange={event => this.onHistogramOptionsChanged(o, event.target.checked)}
              />
              <span className={checkboxStyle}>Quantile {o}</span>
            </label>
          </div>
        );
      })
    );
    return (
      <>
        <label>Histograms:</label>
        {displayHistogramOptions}
        <div className={spacerStyle} />
      </>
    );
  }

  processUrlParams() {
    const metricsSettings = MetricsSettingsDropdown.initialMetricsSettings();
    this.shouldReportOptions = !isEqual(metricsSettings)(this.settings);
    this.settings = metricsSettings;
  }
}
