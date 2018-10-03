import * as React from 'react';
import { Button, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import { style } from 'typestyle';
import { MetricsLabels as L } from './MetricsLabels';

export type Quantiles = '0.5' | '0.95' | '0.99' | '0.999';
const allQuantiles: Quantiles[] = ['0.5', '0.95', '0.99', '0.999'];

export interface MetricsSettings {
  activeLabels: L.LabelName[];
  showAverage: boolean;
  showQuantiles: Quantiles[];
}

interface Props extends MetricsSettings {
  onChanged: (state: MetricsSettings) => void;
  onLabelsFiltersChanged: (labelValues: Map<L.LabelName, L.LabelValues>) => void;
  labelValues: Map<L.LabelName, L.LabelValues>;
}

interface State extends MetricsSettings {
  labelValues: Map<L.LabelName, L.LabelValues>;
}

export class MetricsSettingsDropdown extends React.Component<Props, State> {
  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      activeLabels: props.activeLabels,
      showAverage: props.showAverage,
      showQuantiles: props.showQuantiles,
      labelValues: props.labelValues
    };
  }

  constructor(props: Props) {
    super(props);
    this.state = MetricsSettingsDropdown.getDerivedStateFromProps(props, this.state);
  }

  onGroupingChanged = (label: L.LabelName, checked: boolean) => {
    const newLabels = checked
      ? [label].concat(this.state.activeLabels)
      : this.state.activeLabels.filter(g => label !== g);

    this.setState({ activeLabels: newLabels }, () => this.props.onChanged(this.state));
  };

  onHideLabelChanged = (label: L.LabelName, value: string, checked: boolean) => {
    const newLabels = new Map(this.state.labelValues);
    const lblValues = newLabels.get(label);
    if (lblValues) {
      lblValues[value] = checked;
      this.setState({ labelValues: newLabels }, () => this.props.onLabelsFiltersChanged(newLabels));
    }
  };

  onHistogramAverageChanged = (checked: boolean) => {
    this.setState({ showAverage: checked }, () => this.props.onChanged(this.state));
  };

  onHistogramOptionsChanged = (quantile: Quantiles, checked: boolean) => {
    const newQuantiles = checked
      ? [quantile].concat(this.state.showQuantiles)
      : this.state.showQuantiles.filter(q => quantile !== q);

    this.setState({ showQuantiles: newQuantiles }, () => this.props.onChanged(this.state));
  };

  render() {
    const checkboxStyle = style({ marginLeft: 5 });
    const secondLevelStyle = style({ marginLeft: 14 });

    const displayGroupingLabels = L.ALL_NAMES.map((g, idx) => {
      const checked = this.state.activeLabels.includes(g);
      const labels = this.state.labelValues.get(g);
      const labelsHTML = labels
        ? Object.keys(labels).map(val => (
            <div key={'groupings_' + idx + '_' + val} className={secondLevelStyle}>
              <label>
                <input
                  type="checkbox"
                  checked={labels[val]}
                  onChange={event => this.onHideLabelChanged(g, val, event.target.checked)}
                />
                <span className={checkboxStyle}>{val}</span>
              </label>
            </div>
          ))
        : null;
      return (
        <div key={'groupings_' + idx}>
          <label>
            <input
              type="checkbox"
              checked={checked}
              onChange={event => this.onGroupingChanged(g, event.target.checked)}
            />
            <span className={checkboxStyle}>{g}</span>
          </label>
          {labelsHTML}
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
