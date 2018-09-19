import * as React from 'react';
import { Button, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import { style } from 'typestyle';

export enum Grouping {
  LOCAL_VERSION = 'Local version',
  REMOTE_APP = 'Remote app',
  REMOTE_VERSION = 'Remote version',
  RESPONSE_CODE = 'Response code'
}

export enum Quantiles {
  MEDIAN = '0.5',
  Q0_95 = '0.95',
  Q0_99 = '0.99',
  Q0_999 = '0.999'
}

// type Label = string;

// export const INBOUND_GROUPING_LABELS: Map<Grouping, Label> = new Map([
//   [Grouping.LOCAL_VERSION, 'destination_version'],
//   [Grouping.REMOTE_APP, 'source_app'],
//   [Grouping.REMOTE_VERSION, 'source_version'],
//   [Grouping.RESPONSE_CODE, 'response_code']
// ]);

// export const OUTBOUND_GROUPING_LABELS: Map<Grouping, Label> = new Map([
//   [Grouping.LOCAL_VERSION, 'source_version'],
//   [Grouping.REMOTE_APP, 'destination_app'],
//   [Grouping.REMOTE_VERSION, 'destination_version'],
//   [Grouping.RESPONSE_CODE, 'response_code']
// ]);

export interface MetricsSettings {
  groupingLabels: Grouping[];
  showAverage: boolean;
  showQuantiles: Quantiles[];
}

interface Props extends MetricsSettings {
  onChanged: (state: MetricsSettings) => void;
}

interface State extends MetricsSettings {}

export class MetricsSettingsDropdown extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      groupingLabels: props.groupingLabels,
      showAverage: props.showAverage,
      showQuantiles: props.showQuantiles
    };
  }

  onGroupingChanged = (label: Grouping, checked: boolean) => {
    const newLabels = checked
      ? [label].concat(this.state.groupingLabels)
      : this.state.groupingLabels.filter(g => label !== g);

    this.setState({ groupingLabels: newLabels }, () => this.props.onChanged(this.state));
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

    const displayGroupingLabels = [
      Grouping.LOCAL_VERSION,
      Grouping.REMOTE_APP,
      Grouping.REMOTE_VERSION,
      Grouping.RESPONSE_CODE
    ].map((g, idx) => {
      const checked = this.state.groupingLabels.includes(g);
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
      [Quantiles.MEDIAN, Quantiles.Q0_95, Quantiles.Q0_99, Quantiles.Q0_999].map((o, idx) => {
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
