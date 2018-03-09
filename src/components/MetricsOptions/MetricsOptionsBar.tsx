import * as React from 'react';
import { Toolbar, DropdownButton, MenuItem, Filter } from 'patternfly-react';
import { MetricsOptions } from '../../types/MetricsOptions';

interface Props {
  onOptionsChanged: (opts: MetricsOptions) => void;
}

interface MetricsOptionsState {
  rateInterval: string;
  duration: number;
  ticks: number;
  filterLabels: [string, string][];
  byLabels: string[];
}

interface ByLabel {
  labelIn: string;
  labelOut: string;
}

export class MetricsOptionsBar extends React.Component<Props, MetricsOptionsState> {
  rateIntervals = [['1m', '1 minute'], ['5m', '5 minutes'], ['10m', '10 minutes'], ['30m', '30 minutes']];

  ticks = [10, 20, 30, 50, 100, 200];

  durations: [number, string][] = [
    [300, 'Last 5 minutes'],
    [600, 'Last 10 minutes'],
    [1800, 'Last 30 minutes'],
    [3600, 'Last hour'],
    [10800, 'Last 3 hours'],
    [21600, 'Last 6 hours'],
    [43200, 'Last 12 hours'],
    [86400, 'Last day']
  ];

  byLabelOptions: { [key: string]: ByLabel } = {
    'local version': {
      labelIn: 'destination_version',
      labelOut: 'source_version'
    },
    'remote service': {
      labelIn: 'source_service',
      labelOut: 'destination_service'
    },
    'remote version': {
      labelIn: 'source_version',
      labelOut: 'destination_version'
    },
    'response code': {
      labelIn: 'response_code',
      labelOut: 'response_code'
    }
  };

  byLabelNames = Object.keys(this.byLabelOptions);

  constructor(props: Props) {
    super(props);

    this.onRateIntervalChanged = this.onRateIntervalChanged.bind(this);
    this.onDurationChanged = this.onDurationChanged.bind(this);
    this.onTicksChanged = this.onTicksChanged.bind(this);
    this.addByLabel = this.addByLabel.bind(this);
    this.removeByLabel = this.removeByLabel.bind(this);

    this.state = {
      rateInterval: this.rateIntervals[0][0],
      duration: this.durations[1][0],
      ticks: this.ticks[2],
      filterLabels: [],
      byLabels: []
    };
  }

  componentWillMount() {
    // Init state upstream
    this.reportOptions();
  }

  onRateIntervalChanged(key: string) {
    this.setState({ rateInterval: key }, () => {
      this.reportOptions();
    });
  }

  onDurationChanged(key: number) {
    this.setState({ duration: key }, () => {
      this.reportOptions();
    });
  }

  onTicksChanged(key: number) {
    this.setState({ ticks: key }, () => {
      this.reportOptions();
    });
  }

  reportOptions() {
    // State-to-options converter (removes unnecessary properties)
    const labelsIn = this.state.byLabels.map(lbl => this.byLabelOptions[lbl].labelIn);
    const labelsOut = this.state.byLabels.map(lbl => this.byLabelOptions[lbl].labelOut);
    this.props.onOptionsChanged({
      rateInterval: this.state.rateInterval,
      duration: this.state.duration,
      step: this.state.duration / this.state.ticks,
      filterLabels: this.state.filterLabels,
      byLabelsIn: labelsIn,
      byLabelsOut: labelsOut
    });
  }

  addByLabel(key: string) {
    if (!this.byLabelOptions.hasOwnProperty(key)) {
      // Probably placeholder click
      return;
    }
    const labels = this.state.byLabels.slice();
    const idx = labels.indexOf(key);
    if (idx < 0) {
      // Added
      labels.push(key);
    }
    this.setState({ byLabels: labels }, () => {
      this.reportOptions();
    });
  }

  removeByLabel(key: string) {
    const labels = this.state.byLabels.slice();
    const idx = labels.indexOf(key);
    if (idx >= 0) {
      // Removed
      labels.splice(idx, 1);
    }
    this.setState({ byLabels: labels }, () => {
      this.reportOptions();
    });
  }

  clearFilters() {
    this.setState({ byLabels: [] }, () => {
      this.reportOptions();
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
          <DropdownButton id="ticks" title="Ticks" onSelect={this.onTicksChanged}>
            {this.ticks.map(r => (
              <MenuItem key={r} active={r === this.state.ticks} eventKey={r}>
                {r}
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
        <div className="form-group">
          <Filter>
            <Filter.ValueSelector
              filterValues={this.byLabelNames}
              placeholder="Group by"
              onFilterValueSelected={this.addByLabel}
            />
          </Filter>
          {this.state.byLabels.length > 0 && (
            <Toolbar.Results>
              <Filter.ActiveLabel>{'Grouping by:'}</Filter.ActiveLabel>
              <Filter.List>
                {this.state.byLabels.map(label => {
                  return (
                    <Filter.Item key={label} onRemove={this.removeByLabel} filterData={label}>
                      {label}
                    </Filter.Item>
                  );
                })}
              </Filter.List>
              <a
                href="#"
                onClick={e => {
                  e.preventDefault();
                  this.clearFilters();
                }}
              >
                Clear all
              </a>
            </Toolbar.Results>
          )}
        </div>
      </Toolbar>
    );
  }
}

export default MetricsOptionsBar;
