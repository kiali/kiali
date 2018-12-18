import * as React from 'react';
import { RouteComponentProps } from 'react-router';

import IstioMetricsOptionsBar from '../MetricsOptions/IstioMetricsOptionsBar';
import * as API from '../../services/Api';
import { computePrometheusQueryInterval } from '../../services/Prometheus';
import { GrafanaInfo } from '../../store/Store';
import * as M from '../../types/Metrics';
import { Direction, MetricsOptions } from '../../types/MetricsOptions';
import { authentication } from '../../utils/Authentication';
import * as MessageCenter from '../../utils/MessageCenter';

import { Dashboard } from './Dashboard';
import MetricsHelper from './Helper';

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

  constructor(props: IstioMetricsProps) {
    super(props);

    this.state = {
      labelValues: new Map()
    };
  }

  onOptionsChanged = (options: MetricsOptions) => {
    this.options = options;
    const intervalOpts = computePrometheusQueryInterval(options.duration!);
    options.step = intervalOpts.step;
    options.rateInterval = intervalOpts.rateInterval;
    this.fetchMetrics();
  };

  fetchMetrics = () => {
    let promise: Promise<API.Response<M.MonitoringDashboard>>;
    switch (this.props.objectType) {
      case M.MetricsObjectTypes.WORKLOAD:
        promise = API.getWorkloadDashboard(authentication(), this.props.namespace, this.props.object, this.options);
        break;
      case M.MetricsObjectTypes.APP:
        promise = API.getAppDashboard(authentication(), this.props.namespace, this.props.object, this.options);
        break;
      case M.MetricsObjectTypes.SERVICE:
      default:
        promise = API.getServiceDashboard(authentication(), this.props.namespace, this.props.object, this.options);
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
      <IstioMetricsOptionsBar
        onOptionsChanged={this.onOptionsChanged}
        onRefresh={this.fetchMetrics}
        onLabelsFiltersChanged={this.onLabelsFiltersChanged}
        direction={this.props.direction}
        labelValues={this.state.labelValues}
        aggregations={this.state.dashboard ? this.state.dashboard.aggregations : []}
        grafanaLink={this.getGrafanaLink()}
      />
    );
  }
}

export { IstioMetricsProps };
export default IstioMetrics;
