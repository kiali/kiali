import * as React from 'react';
import { Button, Icon, Toolbar, ToolbarRightContent, FormGroup } from 'patternfly-react';
import { config } from '../../config';
import ValueSelectHelper from './ValueSelectHelper';
import MetricsOptions from '../../types/MetricsOptions';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import { HistoryManager } from '../../app/History';
import { MetricsSettings, Quantiles, MetricsSettingsDropdown } from './MetricsSettings';

interface Props {
  onOptionsChanged: (opts: MetricsOptions) => void;
  onPollIntervalChanged: (interval: number) => void;
  onReporterChanged: (reporter: string) => void;
  onManualRefresh: () => void;
  metricReporter: string;
}

interface MetricsOptionsState {
  pollInterval: number;
  duration: number;
  groupByLabels: string[];
  metricsSettings: MetricsSettings;
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
    'Local version': {
      labelIn: 'destination_version',
      labelOut: 'source_version'
    },
    'Remote app': {
      labelIn: 'source_app',
      labelOut: 'destination_app'
    },
    'Remote version': {
      labelIn: 'source_version',
      labelOut: 'destination_version'
    },
    'Response code': {
      labelIn: 'response_code',
      labelOut: 'response_code'
    }
  };

  static ReporterOptions: { [key: string]: string } = {
    destination: 'Destination',
    source: 'Source'
  };

  groupByLabelsHelper: ValueSelectHelper;

  constructor(props: Props) {
    super(props);

    this.groupByLabelsHelper = new ValueSelectHelper({
      items: Object.keys(MetricsOptionsBar.GroupByLabelOptions),
      onChange: this.changedGroupByLabel,
      dropdownTitle: 'Group by',
      resultsTitle: 'Grouping by:',
      urlAttrName: 'groupings'
    });

    this.state = {
      pollInterval: this.initialPollInterval(),
      duration: this.initialDuration(),
      groupByLabels: this.groupByLabelsHelper.selected,
      metricsSettings: {
        showAverage: true,
        showQuantiles: [Quantiles.MEDIAN, Quantiles.Q0_95, Quantiles.Q0_99],
        groupingLabels: []
      }
    };
  }

  componentDidMount() {
    // Init state upstream
    this.reportOptions();
    this.props.onPollIntervalChanged(this.state.pollInterval);
  }

  initialPollInterval = (): number => {
    let initialPollInterval = MetricsOptionsBar.DefaultPollInterval;

    const pollIntervalParam = HistoryManager.getParam('pi');
    if (pollIntervalParam != null) {
      initialPollInterval = Number(pollIntervalParam);
    }

    return initialPollInterval;
  };

  initialDuration = (): number => {
    let initialDuration = Number(sessionStorage.getItem('appDuration')) || MetricsOptionsBar.DefaultDuration;

    const durationParam = HistoryManager.getParam('duration');
    if (durationParam != null) {
      initialDuration = Number(durationParam);
      sessionStorage.setItem('appDuration', durationParam);
    }

    return initialDuration;
  };

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
      byLabelsOut: labelsOut,
      avg: this.state.metricsSettings.showAverage,
      quantiles: this.state.metricsSettings.showQuantiles
    });
  }

  changedGroupByLabel = (labels: string[]) => {
    this.setState({ groupByLabels: labels }, () => {
      this.reportOptions();
    });
  };

  onMetricsSettingsChanged = (settings: MetricsSettings) => {
    this.setState({ metricsSettings: settings }, () => {
      this.reportOptions();
    });
  };

  render() {
    return (
      <Toolbar>
        {this.groupByLabelsHelper.renderDropdown()}
        <FormGroup>
          <MetricsSettingsDropdown onChanged={this.onMetricsSettingsChanged} {...this.state.metricsSettings} />
          <ToolbarDropdown
            id={'metrics_filter_reporter'}
            disabled={false}
            handleSelect={this.props.onReporterChanged}
            nameDropdown={'Reported from'}
            value={this.props.metricReporter}
            initialLabel={MetricsOptionsBar.ReporterOptions[this.props.metricReporter]}
            options={MetricsOptionsBar.ReporterOptions}
          />
        </FormGroup>
        <ToolbarDropdown
          id={'metrics_filter_interval_duration'}
          disabled={false}
          handleSelect={this.onDurationChanged}
          nameDropdown={'Duration'}
          initialValue={this.state.duration}
          initialLabel={String(MetricsOptionsBar.Durations[this.state.duration])}
          options={MetricsOptionsBar.Durations}
        />
        <ToolbarDropdown
          id={'metrics_filter_poll_interval'}
          disabled={false}
          handleSelect={this.onPollIntervalChanged}
          nameDropdown={'Poll Interval'}
          initialValue={this.state.pollInterval}
          initialLabel={String(MetricsOptionsBar.PollIntervals[this.state.pollInterval])}
          options={MetricsOptionsBar.PollIntervals}
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
