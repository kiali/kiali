import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Toolbar, ToolbarRightContent, FormGroup } from 'patternfly-react';

import RefreshContainer from '../../components/Refresh/Refresh';
import * as API from '../../services/Api';
import { KialiAppState } from '../../store/Store';
import { DurationInSeconds } from '../../types/Common';
import * as M from '../../types/Metrics';
import { CustomMetricsOptions, Aggregator } from '../../types/MetricsOptions';
import * as MessageCenter from '../../utils/MessageCenter';

import { Dashboard } from './Dashboard';
import MetricsHelper from './Helper';
import { MetricsSettingsDropdown, MetricsSettings } from '../MetricsOptions/MetricsSettings';
import MetricsRawAggregation from '../MetricsOptions/MetricsRawAggregation';
import MetricsDurationContainer from '../MetricsOptions/MetricsDuration';

type MetricsState = {
  dashboard?: M.MonitoringDashboard;
  labelValues: M.AllLabelsValues;
};

type CustomMetricsProps = RouteComponentProps<{}> & {
  namespace: string;
  app: string;
  version?: string;
  template: string;
  isPageVisible?: boolean;
};

class CustomMetrics extends React.Component<CustomMetricsProps, MetricsState> {
  static defaultProps = {
    isPageVisible: true
  };

  options: CustomMetricsOptions;

  constructor(props: CustomMetricsProps) {
    super(props);

    this.options = this.initOptions();
    this.state = {
      labelValues: new Map()
    };
  }

  initOptions(): CustomMetricsOptions {
    const options: CustomMetricsOptions = {
      version: this.props.version
    };
    MetricsHelper.initMetricsSettings(options);
    MetricsHelper.initDuration(options);
    return options;
  }

  componentDidMount() {
    this.fetchMetrics();
  }

  fetchMetrics = () => {
    API.getCustomDashboard(this.props.namespace, this.props.app, this.props.template, this.options)
      .then(response => {
        const labelValues = MetricsHelper.extractLabelValues(response.data, this.state.labelValues);
        this.setState({
          dashboard: response.data,
          labelValues: labelValues
        });
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Cannot fetch custom dashboard', error));
        console.error(error);
      });
  };

  onMetricsSettingsChanged = (settings: MetricsSettings) => {
    MetricsHelper.settingsToOptions(settings, this.options, this.state.dashboard && this.state.dashboard.aggregations);
    this.fetchMetrics();
  };

  onLabelsFiltersChanged = (label: M.LabelDisplayName, value: string, checked: boolean) => {
    const newValues = MetricsHelper.mergeLabelFilter(this.state.labelValues, label, value, checked);
    this.setState({ labelValues: newValues });
  };

  onDurationChanged = (duration: DurationInSeconds) => {
    MetricsHelper.durationToOptions(duration, this.options);
    this.fetchMetrics();
  };

  onRawAggregationChanged = (aggregator: Aggregator) => {
    this.options.rawDataAggregator = aggregator;
    this.fetchMetrics();
  };

  render() {
    if (!this.props.isPageVisible) {
      return null;
    }
    if (!this.state.dashboard) {
      return this.renderOptionsBar();
    }

    const convertedLabels = MetricsHelper.convertAsPromLabels(
      this.state.dashboard.aggregations,
      this.state.labelValues
    );
    return (
      <div>
        {this.renderOptionsBar()}
        <Dashboard dashboard={this.state.dashboard} labelValues={convertedLabels} />
      </div>
    );
  }

  renderOptionsBar() {
    return (
      <Toolbar>
        <FormGroup>
          <MetricsSettingsDropdown
            onChanged={this.onMetricsSettingsChanged}
            onLabelsFiltersChanged={this.onLabelsFiltersChanged}
            labelValues={this.state.labelValues}
          />
        </FormGroup>
        <FormGroup>
          <MetricsRawAggregation onChanged={this.onRawAggregationChanged} />
        </FormGroup>
        <ToolbarRightContent>
          <MetricsDurationContainer onChanged={this.onDurationChanged} />
          <RefreshContainer id="metrics-refresh" handleRefresh={this.fetchMetrics} hideLabel={true} />
        </ToolbarRightContent>
      </Toolbar>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  isPageVisible: state.globalState.isPageVisible
});

const CustomMetricsContainer = withRouter<RouteComponentProps<{}> & CustomMetricsProps>(
  connect(mapStateToProps)(CustomMetrics)
);

export default CustomMetricsContainer;
