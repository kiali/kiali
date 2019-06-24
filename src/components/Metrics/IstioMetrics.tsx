import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Icon, Toolbar, ToolbarRightContent, FormGroup } from 'patternfly-react';
import { PF3Dashboard, DashboardModel, SingleLabelValues, LabelDisplayName } from 'k-charted-react';

import RefreshContainer from '../../components/Refresh/Refresh';
import * as API from '../../services/Api';
import { GrafanaInfo, KialiAppState } from '../../store/Store';
import { DurationInSeconds } from '../../types/Common';
import { Direction, IstioMetricsOptions, Reporter } from '../../types/MetricsOptions';
import * as MessageCenter from '../../utils/MessageCenter';

import * as MetricsHelper from './Helper';
import { MetricsSettings, MetricsSettingsDropdown } from '../MetricsOptions/MetricsSettings';
import MetricsReporter from '../MetricsOptions/MetricsReporter';
import MetricsDuration from '../MetricsOptions/MetricsDuration';
import history, { URLParam } from '../../app/History';
import { AllLabelsValues, MetricsObjectTypes } from '../../types/Metrics';

type MetricsState = {
  dashboard?: DashboardModel;
  labelValues: AllLabelsValues;
};

type ObjectId = {
  namespace: string;
  object: string;
};

type IstioMetricsProps = ObjectId &
  RouteComponentProps<{}> & {
    isPageVisible?: boolean;
    grafanaInfo?: GrafanaInfo;
    objectType: MetricsObjectTypes;
    direction: Direction;
  };

class IstioMetrics extends React.Component<IstioMetricsProps, MetricsState> {
  static defaultProps = {
    isPageVisible: true
  };

  options: IstioMetricsOptions;
  grafanaLink: string | undefined;

  constructor(props: IstioMetricsProps) {
    super(props);

    this.options = this.initOptions();
    this.grafanaLink = this.getGrafanaLink();
    this.state = {
      labelValues: new Map()
    };
  }

  initOptions(): IstioMetricsOptions {
    const options: IstioMetricsOptions = {
      reporter: MetricsReporter.initialReporter(this.props.direction),
      direction: this.props.direction
    };
    MetricsHelper.initMetricsSettings(options);
    MetricsHelper.initDuration(options);
    return options;
  }

  componentDidMount() {
    this.fetchMetrics().then(() => {
      const urlParams = new URLSearchParams(history.location.search);
      const byLabels = urlParams.getAll(URLParam.BY_LABELS);

      if (byLabels.length === 0 || !this.state.dashboard) {
        return;
      }

      // On first load, if there are aggregations enabled,
      // re-initialize the options.
      MetricsHelper.initMetricsSettings(this.options, this.state.dashboard.aggregations);

      // Get the labels passed by URL
      const labelsMap = new Map<string, string[]>();
      byLabels.forEach(val => {
        const splitted = val.split('=', 2);
        labelsMap.set(splitted[0], splitted[1] ? splitted[1].split(',') : []);
      });

      // Then, set label values using the URL, if aggregation was applied.
      const newLabelValues: AllLabelsValues = new Map();
      this.state.dashboard!.aggregations.forEach(aggregation => {
        if (!this.state.labelValues.has(aggregation.displayName)) {
          return;
        }
        const lblVal = this.state.labelValues.get(aggregation.displayName)!;
        newLabelValues.set(aggregation.displayName, lblVal);

        if (!this.options.byLabels!.includes(aggregation.label)) {
          return;
        }

        const urlLabels = labelsMap.get(aggregation.displayName)!;
        const newVals: SingleLabelValues = {};
        urlLabels.forEach(val => {
          newVals[val] = true;
        });
        newLabelValues.set(aggregation.displayName, newVals);
      });

      // Fetch again to display the right groupings for the initial load
      this.setState(
        {
          labelValues: newLabelValues
        },
        this.fetchMetrics
      );
    });
  }

  fetchMetrics = () => {
    let promise: Promise<API.Response<DashboardModel>>;
    switch (this.props.objectType) {
      case MetricsObjectTypes.WORKLOAD:
        promise = API.getWorkloadDashboard(this.props.namespace, this.props.object, this.options);
        break;
      case MetricsObjectTypes.APP:
        promise = API.getAppDashboard(this.props.namespace, this.props.object, this.options);
        break;
      case MetricsObjectTypes.SERVICE:
      default:
        promise = API.getServiceDashboard(this.props.namespace, this.props.object, this.options);
        break;
    }
    return promise
      .then(response => {
        const labelValues = MetricsHelper.extractLabelValues(response.data, this.state.labelValues);
        this.setState({
          dashboard: response.data,
          labelValues: labelValues
        });
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Cannot fetch metrics', error));
        console.error(error);
        throw error;
      });
  };

  getGrafanaLink(): string | undefined {
    if (this.props.grafanaInfo) {
      switch (this.props.objectType) {
        case MetricsObjectTypes.SERVICE:
          return `${this.props.grafanaInfo.url}${this.props.grafanaInfo.serviceDashboardPath}?var-service=${
            this.props.object
          }.${this.props.namespace}.svc.cluster.local`;
        case MetricsObjectTypes.WORKLOAD:
          return `${this.props.grafanaInfo.url}${this.props.grafanaInfo.workloadDashboardPath}?var-namespace=${
            this.props.namespace
          }&var-workload=${this.props.object}`;
        default:
          return undefined;
      }
    }
    return undefined;
  }

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

  onReporterChanged = (reporter: Reporter) => {
    this.options.reporter = reporter;
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
    return (
      <Toolbar>
        <FormGroup>
          <MetricsSettingsDropdown
            onChanged={this.onMetricsSettingsChanged}
            onLabelsFiltersChanged={this.onLabelsFiltersChanged}
            labelValues={this.state.labelValues}
            hasHistograms={true}
          />
        </FormGroup>
        <FormGroup>
          <MetricsReporter onChanged={this.onReporterChanged} direction={this.props.direction} />
        </FormGroup>
        {this.grafanaLink && (
          <FormGroup style={{ borderRight: 'none' }}>
            <a id={'grafana_link'} href={this.grafanaLink} target="_blank" rel="noopener noreferrer">
              View in Grafana <Icon type={'fa'} name={'external-link'} />
            </a>
          </FormGroup>
        )}
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
  isPageVisible: state.globalState.isPageVisible,
  grafanaInfo: state.grafanaInfo || undefined
});

const IstioMetricsContainer = withRouter<RouteComponentProps<{}> & IstioMetricsProps>(
  connect(mapStateToProps)(IstioMetrics)
);

export default IstioMetricsContainer;
