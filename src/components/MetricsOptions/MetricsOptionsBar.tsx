import * as React from 'react';
import { Toolbar, DropdownButton, MenuItem } from 'patternfly-react';
import { MetricsOptions } from '../../types/MetricsOptions';

interface Props {
  onOptionsChanged: (opts: MetricsOptions) => void;
}

interface MetricsOptionsState extends MetricsOptions {}

export class MetricsOptionsBar extends React.Component<Props, MetricsOptionsState> {
  rateIntervals = [['1m', '1 minute'], ['5m', '5 minutes'], ['10m', '10 minutes'], ['30m', '30 minutes']];

  steps = [
    ['1', '1 second'],
    ['5', '5 seconds'],
    ['15', '15 seconds'],
    ['30', '30 seconds'],
    ['60', '1 minute'],
    ['1800', '30 minutes'],
    ['3600', '1 hour']
  ];

  durations = [
    ['300', 'Last 5 minutes'],
    ['600', 'Last 10 minutes'],
    ['1800', 'Last 30 minutes'],
    ['3600', 'Last hour'],
    ['10800', 'Last 3 hours'],
    ['21600', 'Last 6 hours'],
    ['43200', 'Last 12 hours'],
    ['86400', 'Last day']
  ];

  constructor(props: Props) {
    super(props);

    this.onRateIntervalChanged = this.onRateIntervalChanged.bind(this);
    this.onDurationChanged = this.onDurationChanged.bind(this);
    this.onStepChanged = this.onStepChanged.bind(this);

    this.state = {
      rateInterval: this.rateIntervals[0][0],
      duration: this.durations[1][0],
      step: this.steps[2][0],
      filterLabels: new Map(),
      byLabels: []
    };
  }

  componentWillMount() {
    // Init state upstream
    this.props.onOptionsChanged(this.state);
  }

  onRateIntervalChanged(key: string) {
    this.setState({ rateInterval: key }, () => {
      this.props.onOptionsChanged(this.state);
    });
  }

  onDurationChanged(key: string) {
    this.setState({ duration: key }, () => {
      this.props.onOptionsChanged(this.state);
    });
  }

  onStepChanged(key: string) {
    this.setState({ step: key }, () => {
      this.props.onOptionsChanged(this.state);
    });
  }

  render() {
    return (
      <Toolbar>
        <div className="form-group">
          <DropdownButton id="duration" title="Duration" onSelect={this.onDurationChanged}>
            {this.durations.map(r => (
              <MenuItem key={r[0]} active={r[0] === this.state.duration} eventKey={r[0]}>
                {r[1]}
              </MenuItem>
            ))}
          </DropdownButton>
          <DropdownButton id="step" title="Step" onSelect={this.onStepChanged}>
            {this.steps.map(r => (
              <MenuItem key={r[0]} active={r[0] === this.state.step} eventKey={r[0]}>
                {r[1]}
              </MenuItem>
            ))}
          </DropdownButton>
          <DropdownButton id="rateInterval" title="Rate interval" onSelect={this.onRateIntervalChanged}>
            {this.rateIntervals.map(r => (
              <MenuItem key={r[0]} active={r[0] === this.state.rateInterval} eventKey={r[0]}>
                {r[1]}
              </MenuItem>
            ))}
          </DropdownButton>
        </div>
      </Toolbar>
    );
  }
}

export default MetricsOptionsBar;
