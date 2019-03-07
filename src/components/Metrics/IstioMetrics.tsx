import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import { Icon, Toolbar, ToolbarRightContent, FormGroup } from 'patternfly-react';

import RefreshContainer from '../../components/Refresh/Refresh';
import * as API from '../../services/Api';
import { GrafanaInfo } from '../../store/Store';
import { DurationInSeconds } from '../../types/Common';
import * as M from '../../types/Metrics';
import { Direction, MetricsOptions, Reporter } from '../../types/MetricsOptions';
import * as MessageCenter from '../../utils/MessageCenter';

import { Dashboard } from './Dashboard';
import MetricsHelper from './Helper';
import { MetricsSettings, MetricsSettingsDropdown } from '../MetricsOptions/MetricsSettings';
import MetricsReporter from '../MetricsOptions/MetricsReporter';
import MetricsDurationContainer from '../MetricsOptions/MetricsDuration';

type MetricsState = {
  dashboard?: M.MonitoringDashboard;
  labelValues: M.AllLabelsValues;
};

type ObjectId = {
  namespace: string;
  object: string;
};

type IstioMetricsProps = ObjectId &
  RouteComponentProps<{}> & {
    isPageVisible?: boolean;
    grafanaInfo?: GrafanaInfo;
    objectType: M.MetricsObjectTypes;
    direction: Direction;
  };

class IstioMetrics extends React.Component<IstioMetricsProps, MetricsState> {
  static defaultProps = {
    isPageVisible: true
  };

  options: MetricsOptions;
  grafanaLink: string | undefined;

  constructor(props: IstioMetricsProps) {
    super(props);

    this.options = this.initOptions();
    this.grafanaLink = this.getGrafanaLink();
    this.state = {
      labelValues: new Map()
    };
  }

  initOptions(): MetricsOptions {
    const options: MetricsOptions = {
      reporter: MetricsReporter.initialReporter(this.props.direction),
      direction: this.props.direction
    };
    MetricsHelper.initMetricsSettings(options);
    MetricsHelper.initDuration(options);
    return options;
  }

  componentDidMount() {
    this.fetchMetrics();
  }

  fetchMetrics = () => {
    let promise: Promise<API.Response<M.MonitoringDashboard>>;
    switch (this.props.objectType) {
      case M.MetricsObjectTypes.WORKLOAD:
        promise = API.getWorkloadDashboard(this.props.namespace, this.props.object, this.options);
        break;
      case M.MetricsObjectTypes.APP:
        promise = API.getAppDashboard(this.props.namespace, this.props.object, this.options);
        break;
      case M.MetricsObjectTypes.SERVICE:
      default:
        promise = API.getServiceDashboard(this.props.namespace, this.props.object, this.options);
        break;
    }
    promise
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
      });
  };

  getGrafanaLink(): string | undefined {
    if (this.props.grafanaInfo) {
      switch (this.props.objectType) {
        case M.MetricsObjectTypes.SERVICE:
          return `${this.props.grafanaInfo.url}${this.props.grafanaInfo.serviceDashboardPath}?${
            this.props.grafanaInfo.varService
          }=${this.props.object}.${this.props.namespace}.svc.cluster.local`;
        case M.MetricsObjectTypes.WORKLOAD:
          return `${this.props.grafanaInfo.url}${this.props.grafanaInfo.workloadDashboardPath}?${
            this.props.grafanaInfo.varNamespace
          }=${this.props.namespace}&${this.props.grafanaInfo.varWorkload}=${this.props.object}`;
        default:
          return `${this.props.grafanaInfo.url}${this.props.grafanaInfo.workloadDashboardPath}?${
            this.props.grafanaInfo.varNamespace
          }=${this.props.namespace}`;
      }
    }
    return undefined;
  }

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
          <MetricsDurationContainer onChanged={this.onDurationChanged} />
          <RefreshContainer id="metrics-refresh" handleRefresh={this.fetchMetrics} hideLabel={true} />
        </ToolbarRightContent>
      </Toolbar>
    );
  }
}

export { IstioMetricsProps };
export default IstioMetrics;
