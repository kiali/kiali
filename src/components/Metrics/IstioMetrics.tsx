import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Toolbar, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { Dashboard, DashboardModel } from '@kiali/k-charted-pf4';

import RefreshContainer from '../../components/Refresh/Refresh';
import * as API from '../../services/Api';
import { GrafanaInfo, KialiAppState } from '../../store/Store';
import { DurationInSeconds } from '../../types/Common';
import { Direction, IstioMetricsOptions, Reporter } from '../../types/MetricsOptions';
import * as MessageCenter from '../../utils/MessageCenter';

import * as MetricsHelper from './Helper';
import { MetricsSettings, LabelsSettings } from '../MetricsOptions/MetricsSettings';
import { MetricsSettingsDropdown } from '../MetricsOptions/MetricsSettingsDropdown';
import MetricsReporter from '../MetricsOptions/MetricsReporter';
import MetricsDuration from '../MetricsOptions/MetricsDuration';
import history from '../../app/History';
import { MetricsObjectTypes } from '../../types/Metrics';

type MetricsState = {
  dashboard?: DashboardModel;
  labelsSettings: LabelsSettings;
};

type ObjectId = {
  namespace: string;
  object: string;
};

type IstioMetricsProps = ObjectId &
  RouteComponentProps<{}> & {
    grafanaInfo?: GrafanaInfo;
    objectType: MetricsObjectTypes;
    direction: Direction;
  };

class IstioMetrics extends React.Component<IstioMetricsProps, MetricsState> {
  options: IstioMetricsOptions;
  grafanaLink: string | undefined;

  constructor(props: IstioMetricsProps) {
    super(props);

    this.grafanaLink = this.getGrafanaLink();
    const settings = MetricsHelper.readMetricsSettingsFromURL();
    this.options = this.initOptions(settings);
    // Initialize active filters from URL
    this.state = { labelsSettings: settings.labelsSettings };
  }

  initOptions(settings: MetricsSettings): IstioMetricsOptions {
    const options: IstioMetricsOptions = {
      reporter: MetricsReporter.initialReporter(this.props.direction),
      direction: this.props.direction
    };
    MetricsHelper.settingsToOptions(settings, options);
    MetricsHelper.initDuration(options);
    return options;
  }

  componentDidMount() {
    this.fetchMetrics();
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
        const labelsSettings = MetricsHelper.extractLabelsSettings(response.data);
        this.setState({
          dashboard: response.data,
          labelsSettings: labelsSettings
        });
      })
      .catch(error => {
        MessageCenter.addError('Could not fetch metrics.', error);
        // TODO: Is this console logging necessary?
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
    MetricsHelper.settingsToOptions(settings, this.options);
    this.fetchMetrics();
  };

  onLabelsFiltersChanged = (labelsFilters: LabelsSettings) => {
    this.setState({ labelsSettings: labelsFilters });
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
    if (!this.state.dashboard) {
      return this.renderOptionsBar();
    }

    const urlParams = new URLSearchParams(history.location.search);
    const expandedChart = urlParams.get('expand') || undefined;

    return (
      <div>
        {this.renderOptionsBar()}
        <Dashboard
          dashboard={this.state.dashboard}
          labelValues={MetricsHelper.convertAsPromLabels(this.state.labelsSettings)}
          expandedChart={expandedChart}
          expandHandler={this.expandHandler}
          labelPrettifier={MetricsHelper.prettyLabelValues}
        />
      </div>
    );
  }

  renderOptionsBar() {
    return (
      <Toolbar style={{ padding: 10 }}>
        <ToolbarGroup>
          <ToolbarItem>
            <MetricsSettingsDropdown
              onChanged={this.onMetricsSettingsChanged}
              onLabelsFiltersChanged={this.onLabelsFiltersChanged}
              labelsSettings={this.state.labelsSettings}
              hasHistograms={true}
            />
          </ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarItem>
            <MetricsReporter onChanged={this.onReporterChanged} direction={this.props.direction} />
          </ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup>
          {this.grafanaLink && (
            <ToolbarItem style={{ borderRight: 'none' }}>
              <a id={'grafana_link'} href={this.grafanaLink} target="_blank" rel="noopener noreferrer">
                View in Grafana <ExternalLinkAltIcon />
              </a>
            </ToolbarItem>
          )}
        </ToolbarGroup>
        <ToolbarGroup style={{ marginLeft: 'auto', marginRight: 0 }}>
          <ToolbarItem>
            <MetricsDuration onChanged={this.onDurationChanged} />
          </ToolbarItem>
          <ToolbarItem>
            <RefreshContainer id="metrics-refresh" handleRefresh={this.fetchMetrics} hideLabel={true} />
          </ToolbarItem>
        </ToolbarGroup>
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
  grafanaInfo: state.grafanaInfo || undefined
});

const IstioMetricsContainer = withRouter<RouteComponentProps<{}> & IstioMetricsProps>(
  connect(mapStateToProps)(IstioMetrics)
);

export default IstioMetricsContainer;
