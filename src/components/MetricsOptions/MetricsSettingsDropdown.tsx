import * as React from 'react';
import { Button, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import { style } from 'typestyle';
import isEqual from 'lodash/fp/isEqual';
import { PromLabel } from '@kiali/k-charted-pf3';

import history, { URLParam } from '../../app/History';
import { MetricsSettings, Quantiles, allQuantiles, LabelsSettings } from './MetricsSettings';
import { readMetricsSettingsFromURL, mergeLabelFilter, prettyLabelValues } from 'components/Metrics/Helper';

interface Props {
  onChanged: (state: MetricsSettings) => void;
  onLabelsFiltersChanged: (labelsFilters: LabelsSettings) => void;
  hasHistograms: boolean;
  labelsSettings: LabelsSettings;
}

const checkboxStyle = style({ marginLeft: 5 });
const secondLevelStyle = style({ marginLeft: 14 });
const spacerStyle = style({ height: '1em' });

export class MetricsSettingsDropdown extends React.Component<Props, MetricsSettings> {
  constructor(props: Props) {
    super(props);
    const settings = readMetricsSettingsFromURL();
    settings.labelsSettings = this.combineLabelsSettings(props.labelsSettings, settings.labelsSettings);
    this.state = settings;
  }

  componentDidUpdate() {
    const labelsSettings = this.combineLabelsSettings(this.props.labelsSettings, this.state.labelsSettings);
    if (!isEqual(this.state.labelsSettings, labelsSettings)) {
      this.setState({ labelsSettings: labelsSettings });
    }
  }

  combineLabelsSettings(newSettings: LabelsSettings, stateSettings: LabelsSettings): LabelsSettings {
    // Labels: keep existing on/off flag
    // This is allowed because the labels filters state is managed only from this component,
    // so we can override them in props from state
    // LabelsSettings received from props contains the names of the filters with only a default on/off flag.
    newSettings.forEach((lblObj, promLabel) => {
      const stateObj = stateSettings.get(promLabel);
      if (stateObj) {
        lblObj.checked = stateObj.checked;
        if (stateObj.defaultValue === false) {
          // 1st pass: override default filters (this case only happens when filters are defined from URL)
          Object.keys(lblObj.values).forEach(k => {
            lblObj.values[k] = false;
          });
        }
        // 2nd pass: retrieve previous filters
        Object.keys(stateObj.values).forEach(k => {
          lblObj.values[k] = stateObj.values[k];
        });
      }
    });
    return newSettings;
  }

  onGroupingChanged = (label: PromLabel, checked: boolean) => {
    const objLbl = this.state.labelsSettings.get(label);
    if (objLbl) {
      objLbl.checked = checked;
    }

    const urlParams = new URLSearchParams(history.location.search);
    urlParams.delete(URLParam.BY_LABELS);
    this.state.labelsSettings.forEach((lbl, name) => {
      if (lbl.checked) {
        urlParams.append(URLParam.BY_LABELS, name);
      }
    });
    history.replace(history.location.pathname + '?' + urlParams.toString());

    this.setState(
      {
        labelsSettings: new Map(this.state.labelsSettings)
      },
      () => this.props.onChanged(this.state)
    );
  };

  onLabelsFiltersChanged = (label: PromLabel, value: string, checked: boolean) => {
    const newValues = mergeLabelFilter(this.state.labelsSettings, label, value, checked);
    this.setState({ labelsSettings: newValues }, () => this.props.onLabelsFiltersChanged(newValues));
  };

  onHistogramAverageChanged = (checked: boolean) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(URLParam.SHOW_AVERAGE, String(checked));
    history.replace(history.location.pathname + '?' + urlParams.toString());

    this.setState({ showAverage: checked }, () => this.props.onChanged(this.state));
  };

  onHistogramOptionsChanged = (quantile: Quantiles, checked: boolean) => {
    const newQuantiles = checked
      ? [quantile].concat(this.state.showQuantiles)
      : this.state.showQuantiles.filter(q => quantile !== q);

    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(URLParam.QUANTILES, newQuantiles.join(' '));
    history.replace(history.location.pathname + '?' + urlParams.toString());

    this.setState({ showQuantiles: newQuantiles }, () => this.props.onChanged(this.state));
  };

  render() {
    const hasHistograms = this.props.hasHistograms;
    const hasLabels = this.state.labelsSettings.size > 0;
    if (!hasHistograms && !hasLabels) {
      return null;
    }

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
    this.state.labelsSettings.forEach((lblObj, promName) => {
      const labelsHTML =
        lblObj.checked && lblObj.values
          ? Object.keys(lblObj.values).map(val => (
              <div key={'groupings_' + promName + '_' + val} className={secondLevelStyle}>
                <label>
                  <input
                    type="checkbox"
                    checked={lblObj.values[val]}
                    onChange={event => this.onLabelsFiltersChanged(promName, val, event.target.checked)}
                  />
                  <span className={checkboxStyle}>{prettyLabelValues(promName, val)}</span>
                </label>
              </div>
            ))
          : null;
      displayGroupingLabels.push(
        <div key={'groupings_' + promName}>
          <label>
            <input
              type="checkbox"
              checked={lblObj.checked}
              onChange={event => this.onGroupingChanged(promName, event.target.checked)}
            />
            <span className={checkboxStyle}>{lblObj.displayName}</span>
          </label>
          {labelsHTML}
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
            checked={this.state.showAverage}
            onChange={event => this.onHistogramAverageChanged(event.target.checked)}
          />
          <span className={checkboxStyle}>Average</span>
        </label>
      </div>
    )].concat(
      allQuantiles.map((o, idx) => {
        const checked = this.state.showQuantiles.includes(o);
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
}
