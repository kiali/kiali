import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';

import { KialiAppState } from '../../store/Store';
import MetricsOptionsBar from '../MetricsOptions/MetricsOptionsBar';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import * as M from '../../types/Metrics';
import { BaseMetricsOptions, CustomMetricsOptions } from '../../types/MetricsOptions';
import { authentication } from '../../utils/Authentication';
import * as MessageCenter from '../../utils/MessageCenter';

import { Dashboard } from './Dashboard';
import MetricsHelper from './Helper';

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

  options: BaseMetricsOptions;

  constructor(props: CustomMetricsProps) {
    super(props);

    this.state = {
      labelValues: new Map()
    };
  }

  onOptionsChanged = (options: BaseMetricsOptions) => {
    this.options = options;
    const intervalOpts = computePrometheusQueryInterval(options.duration!);
    options.step = intervalOpts.step;
    options.rateInterval = intervalOpts.rateInterval;
    (options as CustomMetricsOptions).version = this.props.version;
    this.fetchMetrics();
  };

  fetchMetrics = () => {
    API.getCustomDashboard(authentication(), this.props.namespace, this.props.app, this.props.template, this.options)
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

  onLabelsFiltersChanged = (label: M.LabelDisplayName, value: string, checked: boolean) => {
    const newValues = MetricsHelper.mergeLabelFilter(this.state.labelValues, label, value, checked);
    this.setState({ labelValues: newValues });
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
      <MetricsOptionsBar
        onOptionsChanged={this.onOptionsChanged}
        onRefresh={this.fetchMetrics}
        onLabelsFiltersChanged={this.onLabelsFiltersChanged}
        labelValues={this.state.labelValues}
        aggregations={this.state.dashboard ? this.state.dashboard.aggregations : []}
      />
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
