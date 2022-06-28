import * as React from 'react';
import { Divider, Dropdown, DropdownToggle, DropdownToggleCheckbox, Radio } from '@patternfly/react-core';
import { style } from 'typestyle';
import isEqual from 'lodash/isEqual';

import history, { URLParam } from '../../app/History';
import { MetricsSettings, Quantiles, allQuantiles, LabelsSettings } from './MetricsSettings';
import {
  mergeLabelFilter,
  prettyLabelValues,
  combineLabelsSettings,
  retrieveMetricsSettings
} from 'components/Metrics/Helper';
import {
  titleStyle
} from 'styles/DropdownStyles';
import { PFColors } from '../Pf/PfColors';
import { PromLabel } from 'types/Metrics';

interface Props {
  onChanged: (state: MetricsSettings) => void;
  onLabelsFiltersChanged: (labelsFilters: LabelsSettings) => void;
  direction: string;
  hasHistograms: boolean;
  labelsSettings: LabelsSettings;
}

type State = MetricsSettings & {
  isOpen: boolean;
  allSelected: boolean;
};

const checkboxSelectAllStyle = style({ marginLeft: 10 });
const checkboxStyle = style({ marginLeft: 10, fontWeight: 400 });
const secondLevelStyle = style({ marginLeft: 18 });
const spacerStyle = style({ height: '1em' });
const titlePaddingStyle = style({ paddingLeft: 0, fontSize: "small" });

export class MetricsSettingsDropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const settings = retrieveMetricsSettings();
    settings.labelsSettings = combineLabelsSettings(props.labelsSettings, settings.labelsSettings);
    this.state = { ...settings, isOpen: false, allSelected: false };
  }

  checkSelected = () => {
    let allSelected = true;
    this.state.labelsSettings.forEach(lblSetting => {
      if (lblSetting.checked === false) {
        allSelected = false;
      } else {
        Object.keys(lblSetting.values).forEach(value => {
          if (lblSetting.values[value] === false) {
            allSelected = false;
          }
        });
      }
    });

    this.setState({ allSelected: allSelected });
  };

  componentDidUpdate(prevProps: Props) {
    // TODO Move the sync of URL and state to a global place
    const changeDirection = prevProps.direction !== this.props.direction;
    const settings = retrieveMetricsSettings();
    let initLabelSettings = changeDirection ? settings.labelsSettings : new Map();
    const stateLabelsSettings = changeDirection ? initLabelSettings : this.state.labelsSettings;
    const labelsSettings = combineLabelsSettings(this.props.labelsSettings, stateLabelsSettings);
    if (!isEqual(stateLabelsSettings, labelsSettings) || changeDirection) {
      this.setState(prevState => {
        return {
          labelsSettings: labelsSettings,
          showQuantiles: changeDirection ? settings.showQuantiles : prevState.showQuantiles,
          showAverage: changeDirection ? settings.showAverage : prevState.showAverage,
          showSpans: changeDirection ? settings.showSpans : prevState.showSpans
        };
      }, this.checkSelected);
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
      () => {
        this.props.onChanged(this.state);
        this.checkSelected();
      }
    );
  };

  onLabelsFiltersChanged = (label: PromLabel, value: string, checked: boolean, singleSelection: boolean) => {
    const newValues = mergeLabelFilter(this.state.labelsSettings, label, value, checked, singleSelection);
    this.updateLabelsSettingsURL(newValues);
    this.setState({ labelsSettings: newValues }, () => {
      this.props.onLabelsFiltersChanged(newValues);
      this.checkSelected();
    });
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

  bulkUpdate = (selected: boolean): void => {
    this.state.labelsSettings.forEach(lblSetting => {
      lblSetting.checked = selected;

      Object.keys(lblSetting.values).forEach(value => {
        lblSetting.values[value] = selected;
      });
    });

    this.updateLabelsSettingsURL(this.state.labelsSettings);

    this.setState(
      {
        labelsSettings: new Map(this.state.labelsSettings)
      },
      () => {
        this.props.onChanged(this.state);
      }
    );
  };

  onBulkAll = () => {
    this.bulkUpdate(true);
    this.setState({ allSelected: true });
  };

  onBulkNone = () => {
    this.bulkUpdate(false);
    this.setState({ allSelected: false });
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
        <div style={{ paddingLeft: '10px', backgroundColor: PFColors.White }} className="pf-c-dropdown__menu-item">
          {hasLabels && this.renderBulkSelector()}
          {hasLabels && this.renderLabelOptions()}
          {hasHistograms && this.renderHistogramOptions()}
        </div>
      </Dropdown>
    );
  }

  renderBulkSelector(): JSX.Element {
    return (
      <div>
        <DropdownToggleCheckbox
          id="bulk-select-id"
          key="bulk-select-key"
          aria-label="Select all metric/label filters"
          isChecked={this.state.allSelected}
          onClick={() => {
            if (this.state.allSelected) {
              this.onBulkNone();
            } else {
              this.onBulkAll();
            }
          }}
        ></DropdownToggleCheckbox>
        <span className={checkboxSelectAllStyle}>Select all metric/label filters</span>
        <Divider style={{ paddingTop: '5px' }} />
      </div>
    );
  }

  renderLabelOptions(): JSX.Element {
    const displayGroupingLabels: any[] = [];
    this.state.labelsSettings.forEach((lblObj, promName) => {
      const labelsHTML =
        lblObj.checked && lblObj.values
          ? Object.keys(lblObj.values).map(val => (
              <div key={'groupings_' + promName + '_' + val} className={secondLevelStyle}>
                {lblObj.singleSelection ? (
                  <Radio
                    isChecked={lblObj.values[val]}
                    id={val}
                    onChange={_ => this.onLabelsFiltersChanged(promName, val, true, true)}
                    label={prettyLabelValues(promName, val)}
                    name={val}
                    value={val}
                  />
                ) : (
                  <label>
                    <input
                      type="checkbox"
                      checked={lblObj.values[val]}
                      onChange={event => this.onLabelsFiltersChanged(promName, val, event.target.checked, false)}
                    />
                    <span className={checkboxStyle}>{prettyLabelValues(promName, val)}</span>
                  </label>
                )}
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
        <label className={`${titlePaddingStyle} ${titleStyle}`}>Show metrics by:</label>
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
        <label className={`${titlePaddingStyle} ${titleStyle}`}>Histograms:</label>
        {displayHistogramOptions}
        <div className={spacerStyle} />
      </>
    );
  }
}
