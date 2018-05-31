import * as React from 'react';
import { Button, Icon, Toolbar, ToolbarRightContent } from 'patternfly-react';
import { config } from '../../config';
import ValueSelectHelper from './ValueSelectHelper';
import MetricsOptions from '../../types/MetricsOptions';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import PollIntervalFilter from '../Filters/PollIntervalFilter';

interface Props {
  onOptionsChanged: (opts: MetricsOptions) => void;
  onPollIntervalChanged: (interval: number) => void;
  onManualRefresh: () => void;
}

interface MetricsOptionsState {
  pollInterval: number;
  duration: number;
  groupByLabels: string[];
}

interface GroupByLabel {
  labelIn: string;
  labelOut: string;
}

export class MetricsOptionsBar extends React.Component<Props, MetricsOptionsState> {
  static PollIntervals = config().toolbar.pollInterval;
  static DefaultPollInterval = config().toolbar.defaultPollInterval;

  static Durations = config().toolbar.intervalDuration;
  static DefaultDuration = config().toolbar.defaultDuration;

  static GroupByLabelOptions: { [key: string]: GroupByLabel } = {
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

  groupByLabelsHelper: ValueSelectHelper;

  constructor(props: Props) {
    super(props);

    this.groupByLabelsHelper = new ValueSelectHelper({
      items: Object.keys(MetricsOptionsBar.GroupByLabelOptions),
      onChange: this.changedGroupByLabel,
      dropdownTitle: 'Group by',
      resultsTitle: 'Grouping by:'
    });

    this.state = {
      pollInterval: MetricsOptionsBar.DefaultPollInterval,
      duration: Number(sessionStorage.getItem('appDuration')) || MetricsOptionsBar.DefaultDuration,
      groupByLabels: []
    };
  }

  componentDidMount() {
    // Init state upstream
    this.reportOptions();
    this.props.onPollIntervalChanged(this.state.pollInterval);
  }

  onPollIntervalChanged = (key: number) => {
    // We use a specific handler so that changing poll interval doesn't trigger a metrics refresh in parent
    // Especially useful when pausing
    this.props.onPollIntervalChanged(key);
    this.setState({ pollInterval: key });
  };

  onDurationChanged = (key: number) => {
    sessionStorage.setItem('appDuration', String(key));
    this.setState({ duration: key }, () => {
      this.reportOptions();
    });
  };

  reportOptions() {
    // State-to-options converter (removes unnecessary properties)
    const labelsIn = this.state.groupByLabels.map(lbl => MetricsOptionsBar.GroupByLabelOptions[lbl].labelIn);
    const labelsOut = this.state.groupByLabels.map(lbl => MetricsOptionsBar.GroupByLabelOptions[lbl].labelOut);
    this.props.onOptionsChanged({
      duration: this.state.duration,
      byLabelsIn: labelsIn,
      byLabelsOut: labelsOut
    });
  }

  changedGroupByLabel = (labels: string[]) => {
    this.setState({ groupByLabels: labels }, () => {
      this.reportOptions();
    });
  };

  render() {
    return (
      <Toolbar>
        {this.groupByLabelsHelper.renderDropdown()}
        <ToolbarDropdown
          id={'metrics_filter_interval_duration'}
          disabled={false}
          handleSelect={this.onDurationChanged}
          nameDropdown={'Duration'}
          initialValue={Number(sessionStorage.getItem('appDuration')) || MetricsOptionsBar.DefaultDuration}
          initialLabel={String(
            MetricsOptionsBar.Durations[
              Number(sessionStorage.getItem('appDuration')) || MetricsOptionsBar.DefaultDuration
            ]
          )}
          options={MetricsOptionsBar.Durations}
        />
        <PollIntervalFilter
          id={'metrics_filter_poll_interval'}
          disabled={false}
          onPollIntervalChanged={this.onPollIntervalChanged}
        />

        <ToolbarRightContent>
          <Button onClick={this.props.onManualRefresh}>
            <Icon name="refresh" />
          </Button>
        </ToolbarRightContent>
        {this.groupByLabelsHelper.hasResults() && (
          <Toolbar.Results>{this.groupByLabelsHelper.renderResults()}</Toolbar.Results>
        )}
      </Toolbar>
    );
  }
}

export default MetricsOptionsBar;
