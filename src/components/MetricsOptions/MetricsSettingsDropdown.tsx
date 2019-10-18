import * as React from 'react';
import { Dropdown, DropdownToggle } from '@patternfly/react-core';
import { style } from 'typestyle';
import isEqual from 'lodash/fp/isEqual';
import { PromLabel } from '@kiali/k-charted-pf4';

import history, { URLParam } from '../../app/History';
import { MetricsSettings, Quantiles, allQuantiles, LabelsSettings } from './MetricsSettings';
import {
  readMetricsSettingsFromURL,
  mergeLabelFilter,
  prettyLabelValues,
  combineLabelsSettings
} from 'components/Metrics/Helper';

interface Props {
  onChanged: (state: MetricsSettings) => void;
  onLabelsFiltersChanged: (labelsFilters: LabelsSettings) => void;
  hasHistograms: boolean;
  labelsSettings: LabelsSettings;
}

type State = MetricsSettings & {
  isOpen: boolean;
};

const checkboxStyle = style({ marginLeft: 10 });
const secondLevelStyle = style({ marginLeft: 18 });
const spacerStyle = style({ height: '1em' });

export class MetricsSettingsDropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const settings = readMetricsSettingsFromURL();
    settings.labelsSettings = combineLabelsSettings(props.labelsSettings, settings.labelsSettings);
    this.state = { ...settings, isOpen: false };
  }

  componentDidUpdate() {
    const labelsSettings = combineLabelsSettings(this.props.labelsSettings, this.state.labelsSettings);
    if (!isEqual(this.state.labelsSettings, labelsSettings)) {
      this.setState({ labelsSettings: labelsSettings });
    }
  }

  private onToggle = isOpen => {
    this.setState({ isOpen: isOpen });
  };

  onGroupingChanged = (label: PromLabel, checked: boolean) => {
    const objLbl = this.state.labelsSettings.get(label);
    if (objLbl) {
      objLbl.checked = checked;
    }

    this.updateLabelsSettingsURL(this.state.labelsSettings);

    this.setState(
      {
        labelsSettings: new Map(this.state.labelsSettings)
      },
      () => this.props.onChanged(this.state)
    );
  };

  onLabelsFiltersChanged = (label: PromLabel, value: string, checked: boolean) => {
    const newValues = mergeLabelFilter(this.state.labelsSettings, label, value, checked);
    this.updateLabelsSettingsURL(newValues);
    this.setState({ labelsSettings: newValues }, () => this.props.onLabelsFiltersChanged(newValues));
  };

  updateLabelsSettingsURL = (labelsSettings: LabelsSettings) => {
    // E.g.: bylbl=version=v1,v2,v4
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.delete(URLParam.BY_LABELS);
    labelsSettings.forEach((lbl, name) => {
      if (lbl.checked) {
        const filters = Object.keys(lbl.values)
          .filter(k => lbl.values[k])
          .join(',');
        if (filters) {
          urlParams.append(URLParam.BY_LABELS, name + '=' + filters);
        } else {
          urlParams.append(URLParam.BY_LABELS, name);
        }
      }
    });
    history.replace(history.location.pathname + '?' + urlParams.toString());
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

    return (
      <Dropdown
        toggle={<DropdownToggle onToggle={this.onToggle}>Metrics Settings</DropdownToggle>}
        isOpen={this.state.isOpen}
      >
        {/* TODO: Remove the class="pf-c-dropdown__menu-item" attribute which is fixing a sizing issue in PF.
         * https://github.com/patternfly/patternfly-react/issues/3156 */}
        <div style={{ paddingLeft: '10px' }} className="pf-c-dropdown__menu-item">
          {hasLabels && this.renderLabelOptions()}
          {hasHistograms && this.renderHistogramOptions()}
        </div>
      </Dropdown>
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
