import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Toolbar, ToolbarRightContent, FormGroup } from 'patternfly-react';
import { PF3Dashboard, DashboardModel, LabelDisplayName, DashboardQuery, Aggregator } from 'k-charted-react';

import { serverConfig } from '../../config/ServerConfig';
import history from '../../app/History';
import RefreshContainer from '../../components/Refresh/Refresh';
import * as API from '../../services/Api';
import { KialiAppState } from '../../store/Store';
import { DurationInSeconds } from '../../types/Common';
import * as MessageCenter from '../../utils/MessageCenter';

import * as MetricsHelper from './Helper';
import { MetricsSettingsDropdown, MetricsSettings } from '../MetricsOptions/MetricsSettings';
import MetricsRawAggregation from '../MetricsOptions/MetricsRawAggregation';
import MetricsDuration from '../MetricsOptions/MetricsDuration';
import { AllLabelsValues } from '../../types/Metrics';

type MetricsState = {
  dashboard?: DashboardModel;
  labelValues: AllLabelsValues;
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

  options: DashboardQuery;

  constructor(props: CustomMetricsProps) {
    super(props);

    this.options = this.initOptions();
    this.state = {
      labelValues: new Map()
    };
  }

  initOptions(): DashboardQuery {
    const filters = `${serverConfig.istioLabels.appLabelName}:${this.props.app}`;
    const options: DashboardQuery = this.props.version
      ? {
          labelsFilters: `${filters},${serverConfig.istioLabels.versionLabelName}:${this.props.version}`
        }
      : {
          labelsFilters: filters,
          additionalLabels: 'version:Version'
        };
    MetricsHelper.initMetricsSettings(options);
    MetricsHelper.initDuration(options);
    return options;
  }

  componentDidMount() {
    this.fetchMetrics();
  }

  fetchMetrics = () => {
    API.getCustomDashboard(this.props.namespace, this.props.template, this.options)
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

  onLabelsFiltersChanged = (label: LabelDisplayName, value: string, checked: boolean) => {
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

    const urlParams = new URLSearchParams(history.location.search);
    const expandedChart = urlParams.get('expand') || undefined;

    const convertedLabels = MetricsHelper.convertAsPromLabels(
      this.state.dashboard.aggregations,
      this.state.labelValues
    );
    return (
      <div>
        {this.renderOptionsBar()}
        <PF3Dashboard
          dashboard={this.state.dashboard}
          labelValues={convertedLabels}
          expandedChart={expandedChart}
          expandHandler={this.expandHandler}
        />
      </div>
    );
  }

  renderOptionsBar() {
    const hasHistograms =
      this.state.dashboard !== undefined &&
      this.state.dashboard.charts.some(chart => {
        if (chart.histogram) {
          return Object.keys(chart.histogram).length > 0;
        }
        return false;
      });
    return (
      <Toolbar>
        <FormGroup>
          <MetricsSettingsDropdown
            onChanged={this.onMetricsSettingsChanged}
            onLabelsFiltersChanged={this.onLabelsFiltersChanged}
            labelValues={this.state.labelValues}
            hasHistograms={hasHistograms}
          />
        </FormGroup>
        <FormGroup>
          <MetricsRawAggregation onChanged={this.onRawAggregationChanged} />
        </FormGroup>
        <ToolbarRightContent>
          <MetricsDuration onChanged={this.onDurationChanged} />
          <RefreshContainer id="metrics-refresh" handleRefresh={this.fetchMetrics} hideLabel={true} />
        </ToolbarRightContent>
      </Toolbar>
    );
  }

  private expandHandler = (expandedChart?: string) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.delete('expand');
    if (expandedChart) {
      urlParams.set('expand', expandedChart);
    }
    history.push(history.location.pathname + '?' + urlParams.toString());
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  isPageVisible: state.globalState.isPageVisible
});

const CustomMetricsContainer = withRouter<RouteComponentProps<{}> & CustomMetricsProps>(
  connect(mapStateToProps)(CustomMetrics)
);

export default CustomMetricsContainer;
