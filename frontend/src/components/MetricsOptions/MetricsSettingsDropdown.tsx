import * as React from 'react';
import {
  Checkbox,
  Divider,
  Dropdown,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
  Radio,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import isEqual from 'lodash/isEqual';
import { location, router, URLParam } from '../../app/History';
import { MetricsSettings, Quantiles, allQuantiles, LabelsSettings } from './MetricsSettings';
import {
  mergeLabelFilter,
  prettyLabelValues,
  combineLabelsSettings,
  retrieveMetricsSettings
} from 'components/Metrics/Helper';
import { itemStyleWithoutInfo, titleStyle } from 'styles/DropdownStyles';
import { PromLabel } from 'types/Metrics';
import { KialiIcon } from 'config/KialiIcon';
import { classes } from 'typestyle';

interface Props {
  direction: string;
  hasHistograms: boolean;
  hasHistogramsAverage: boolean;
  hasHistogramsPercentiles: boolean;
  labelsSettings: LabelsSettings;
  onChanged: (state: MetricsSettings) => void;
  onLabelsFiltersChanged: (labelsFilters: LabelsSettings) => void;
}

type State = MetricsSettings & {
  allSelected: boolean;
  isOpen: boolean;
};

const checkboxSelectAllStyle = kialiStyle({ marginLeft: '0.5rem' });
const secondLevelStyle = kialiStyle({ marginLeft: '1rem' });
const spacerStyle = kialiStyle({ height: '0.5rem' });
const titleLabelStyle = kialiStyle({ marginBottom: '0.5rem', fontSize: 'small' });
const labelStyle = kialiStyle({ display: 'inline-block' });
const checkboxStyle = kialiStyle({ marginLeft: '1rem' });

export class MetricsSettingsDropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const settings = retrieveMetricsSettings();
    settings.labelsSettings = combineLabelsSettings(props.labelsSettings, settings.labelsSettings);
    this.state = { ...settings, isOpen: false, allSelected: false };
  }

  checkSelected = (): void => {
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

  componentDidUpdate(prevProps: Props): void {
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

  private onToggle = (isOpen: boolean): void => {
    this.setState({ isOpen: isOpen });
  };

  onGroupingChanged = (label: PromLabel, checked: boolean): void => {
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

  onLabelsFiltersChanged = (label: PromLabel, value: string, checked: boolean, singleSelection: boolean): void => {
    const newValues = mergeLabelFilter(this.state.labelsSettings, label, value, checked, singleSelection);
    this.updateLabelsSettingsURL(newValues);

    this.setState({ labelsSettings: newValues }, () => {
      this.props.onLabelsFiltersChanged(newValues);
      this.checkSelected();
    });
  };

  updateLabelsSettingsURL = (labelsSettings: LabelsSettings): void => {
    // E.g.: bylbl=version=v1,v2,v4
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.delete(URLParam.BY_LABELS);

    labelsSettings.forEach((lbl, name) => {
      if (lbl.checked) {
        const filters = Object.keys(lbl.values)
          .filter(k => lbl.values[k])
          .join(',');

        if (filters) {
          urlParams.append(URLParam.BY_LABELS, `${name}=${filters}`);
        } else {
          urlParams.append(URLParam.BY_LABELS, name);
        }
      }
    });

    router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });
  };

  onHistogramAverageChanged = (checked: boolean): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.set(URLParam.SHOW_AVERAGE, String(checked));
    router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });

    this.setState({ showAverage: checked }, () => this.props.onChanged(this.state));
  };

  onHistogramOptionsChanged = (quantile: Quantiles, checked: boolean): void => {
    const newQuantiles = checked
      ? [quantile].concat(this.state.showQuantiles)
      : this.state.showQuantiles.filter(q => quantile !== q);

    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.set(URLParam.QUANTILES, newQuantiles.join(' '));
    router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });

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

  onBulkAll = (): void => {
    this.bulkUpdate(true);
    this.setState({ allSelected: true });
  };

  onBulkNone = (): void => {
    this.bulkUpdate(false);
    this.setState({ allSelected: false });
  };

  render(): React.ReactNode {
    const hasHistograms = this.props.hasHistograms;
    const hasLabels = this.state.labelsSettings.size > 0;

    if (!hasHistograms && !hasLabels) {
      return null;
    }

    return (
      <Dropdown
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle ref={toggleRef} onClick={() => this.onToggle(!this.state.isOpen)} isExpanded={this.state.isOpen}>
            Metrics Settings
          </MenuToggle>
        )}
        isOpen={this.state.isOpen}
        onOpenChange={(isOpen: boolean) => this.onToggle(isOpen)}
      >
        <DropdownList>
          {hasLabels && this.renderBulkSelector()}
          {hasLabels && this.renderLabelOptions()}
          {hasHistograms && this.renderHistogramOptions()}
        </DropdownList>
      </Dropdown>
    );
  }

  renderBulkSelector(): React.ReactNode {
    return (
      <div>
        <div className={itemStyleWithoutInfo}>
          <Checkbox
            id="bulk-select-id"
            key="bulk-select-key"
            aria-label="Select all metric/label filters"
            isChecked={this.state.allSelected}
            onChange={() => {
              if (this.state.allSelected) {
                this.onBulkNone();
              } else {
                this.onBulkAll();
              }
            }}
          />
          <span className={checkboxSelectAllStyle}>Select all metric/label filters</span>
        </div>
        <Divider />
      </div>
    );
  }

  renderLabelOptions(): React.ReactNode {
    const displayGroupingLabels: any[] = [];

    this.state.labelsSettings.forEach((lblObj, promName) => {
      const labelsHTML =
        lblObj.checked && lblObj.values
          ? Object.keys(lblObj.values).map(val => (
              <div key={`groupings_${promName}_${val}`} className={secondLevelStyle}>
                {lblObj.singleSelection ? (
                  <Radio
                    isChecked={lblObj.values[val]}
                    id={val}
                    className={checkboxStyle}
                    onChange={(_event, _) => this.onLabelsFiltersChanged(promName, val, true, true)}
                    label={prettyLabelValues(promName, val)}
                    name={val}
                    value={val}
                  />
                ) : (
                  <label>
                    <Checkbox
                      id={val}
                      className={checkboxStyle}
                      isChecked={lblObj.values[val]}
                      onChange={(_event, checked) => this.onLabelsFiltersChanged(promName, val, checked, false)}
                      label={prettyLabelValues(promName, val)}
                    />
                  </label>
                )}
              </div>
            ))
          : null;

      displayGroupingLabels.push(
        <div key={`groupings_${promName}`}>
          <label>
            <Checkbox
              id={lblObj.displayName}
              className={checkboxStyle}
              label={lblObj.displayName}
              isChecked={lblObj.checked}
              onChange={(_event, checked) => this.onGroupingChanged(promName, checked)}
            />
          </label>
          {labelsHTML}
        </div>
      );
    });

    return (
      <>
        <label className={classes(titleLabelStyle, titleStyle, labelStyle)}>Show metrics by:</label>
        {displayGroupingLabels}
        <div className={spacerStyle} />
      </>
    );
  }

  renderHistogramOptions(): React.ReactNode {
    const displayHistogramOptions = [
      <div key="histo_avg">
        <label>
          <Checkbox
            id="histo_avg"
            className={checkboxStyle}
            isChecked={this.state.showAverage && this.props.hasHistogramsAverage}
            isDisabled={!this.props.hasHistogramsAverage}
            onChange={(_event, checked) => this.onHistogramAverageChanged(checked)}
            label="Average"
          />
        </label>
      </div>
    ].concat(
      allQuantiles.map((o, idx) => {
        const checked = this.state.showQuantiles.includes(o);
        return (
          <div key={`histo_${idx}`}>
            <label>
              <Checkbox
                id={o}
                className={checkboxStyle}
                isChecked={checked && this.props.hasHistogramsPercentiles}
                isDisabled={!this.props.hasHistogramsPercentiles}
                onChange={(_event, checked) => this.onHistogramOptionsChanged(o, checked)}
                label={`Quantile ${o}`}
              />
            </label>
          </div>
        );
      })
    );

    return (
      <>
        <label className={classes(titleLabelStyle, titleStyle, labelStyle)} style={{ paddingRight: '0.5rem' }}>
          Histograms:
        </label>

        <Tooltip
          key="tooltip_histograms"
          position={TooltipPosition.right}
          content={
            <div style={{ textAlign: 'left' }}>
              <div>
                "No data available" is displayed for a histogram that does not have telemetry supporting the selected
                option. If no histograms support the necessary telemetry, the option will be disabled.
              </div>
            </div>
          }
        >
          <KialiIcon.Info />
        </Tooltip>

        {displayHistogramOptions}
        <div className={spacerStyle} />
      </>
    );
  }
}
