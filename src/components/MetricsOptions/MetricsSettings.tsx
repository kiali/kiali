import * as React from 'react';
import { Button, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import { style } from 'typestyle';
import { LabelDisplayName, AllLabelsValues } from '../../types/Metrics';

export type Quantiles = '0.5' | '0.95' | '0.99' | '0.999';
const allQuantiles: Quantiles[] = ['0.5', '0.95', '0.99', '0.999'];

export interface MetricsSettings {
  activeLabels: LabelDisplayName[];
  showAverage: boolean;
  showQuantiles: Quantiles[];
}

interface Props extends MetricsSettings {
  onChanged: (state: MetricsSettings) => void;
  onLabelsFiltersChanged: (label: LabelDisplayName, value: string, checked: boolean) => void;
  labelValues: AllLabelsValues;
}

export class MetricsSettingsDropdown extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  onGroupingChanged = (label: LabelDisplayName, checked: boolean) => {
    const newLabels = checked
      ? [label].concat(this.props.activeLabels)
      : this.props.activeLabels.filter(g => label !== g);

    this.props.onChanged({
      showAverage: this.props.showAverage,
      showQuantiles: this.props.showQuantiles,
      activeLabels: newLabels
    });
  };

  onHistogramAverageChanged = (checked: boolean) => {
    this.props.onChanged({
      showAverage: checked,
      showQuantiles: this.props.showQuantiles,
      activeLabels: this.props.activeLabels
    });
  };

  onHistogramOptionsChanged = (quantile: Quantiles, checked: boolean) => {
    const newQuantiles = checked
      ? [quantile].concat(this.props.showQuantiles)
      : this.props.showQuantiles.filter(q => quantile !== q);

    this.props.onChanged({
      showAverage: this.props.showAverage,
      showQuantiles: newQuantiles,
      activeLabels: this.props.activeLabels
    });
  };

  render() {
    const checkboxStyle = style({ marginLeft: 5 });
    const secondLevelStyle = style({ marginLeft: 14 });

    const displayGroupingLabels: any[] = [];
    this.props.labelValues.forEach((values, name) => {
      const checked = this.props.activeLabels.includes(name);
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

    // Prettier removes the parenthesis introducing JSX
    // prettier-ignore
    const displayHistogramOptions = [(
      <div key={'histo_avg'}>
        <label>
          <input
            type="checkbox"
            checked={this.props.showAverage}
            onChange={event => this.onHistogramAverageChanged(event.target.checked)}
          />
          <span className={checkboxStyle}>Average</span>
        </label>
      </div>
    )].concat(
      allQuantiles.map((o, idx) => {
        const checked = this.props.showQuantiles.includes(o);
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

    const spacerStyle = style({
      height: '1em'
    });

    const metricsSettingsPopover = (
      <Popover id="layers-popover">
        <label>Show metrics by:</label>
        {displayGroupingLabels}
        <div className={spacerStyle} />
        <label>Histograms:</label>
        {displayHistogramOptions}
        <div className={spacerStyle} />
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
}
