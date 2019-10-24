import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Toolbar, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { Dashboard, DashboardModel, ExternalLink } from '@kiali/k-charted-pf4';
import { style } from 'typestyle';

import RefreshContainer from '../../components/Refresh/Refresh';
import * as API from '../../services/Api';
import { KialiAppState } from '../../store/Store';
import { DurationInSeconds } from '../../types/Common';
import { Direction, IstioMetricsOptions, Reporter } from '../../types/MetricsOptions';
import * as AlertUtils from '../../utils/AlertUtils';

import * as MetricsHelper from './Helper';
import { MetricsSettings, LabelsSettings } from '../MetricsOptions/MetricsSettings';
import { MetricsSettingsDropdown } from '../MetricsOptions/MetricsSettingsDropdown';
import MetricsReporter from '../MetricsOptions/MetricsReporter';
import MetricsDuration from '../MetricsOptions/MetricsDuration';
import history from '../../app/History';
import { MetricsObjectTypes } from '../../types/Metrics';
import { GrafanaInfo } from '../../types/GrafanaInfo';
import { MessageType } from '../../types/MessageCenter';
import { GrafanaLinks } from './GrafanaLinks';

type MetricsState = {
  dashboard?: DashboardModel;
  labelsSettings: LabelsSettings;
  grafanaLinks: ExternalLink[];
};

type ObjectId = {
  namespace: string;
  object: string;
};

type IstioMetricsProps = ObjectId &
  RouteComponentProps<{}> & {
    objectType: MetricsObjectTypes;
    direction: Direction;
  };

const displayFlex = style({
  display: 'flex'
});

class IstioMetrics extends React.Component<IstioMetricsProps, MetricsState> {
  options: IstioMetricsOptions;
  static grafanaInfoPromise: Promise<GrafanaInfo | undefined> | undefined;

  constructor(props: IstioMetricsProps) {
    super(props);

    const settings = MetricsHelper.readMetricsSettingsFromURL();
    this.options = this.initOptions(settings);
    // Initialize active filters from URL
    this.state = { labelsSettings: settings.labelsSettings, grafanaLinks: [] };
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
    this.fetchGrafanaInfo();
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
        const labelsSettings = MetricsHelper.extractLabelsSettings(response.data, this.state.labelsSettings);
        this.setState({
          dashboard: response.data,
          labelsSettings: labelsSettings
        });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch metrics.', error);
        throw error;
      });
  };

  fetchGrafanaInfo() {
    if (!IstioMetrics.grafanaInfoPromise) {
      IstioMetrics.grafanaInfoPromise = API.getGrafanaInfo().then(response => {
        if (response.status === 204) {
          return undefined;
        }
        return response.data;
      });
    }
    IstioMetrics.grafanaInfoPromise
      .then(grafanaInfo => {
        if (grafanaInfo) {
          this.setState({ grafanaLinks: grafanaInfo.externalLinks });
        } else {
          this.setState({ grafanaLinks: [] });
        }
      })
      .catch(err => {
        AlertUtils.addError(
          'Could not fetch Grafana info. Turning off links to Grafana.',
          err,
          'default',
          MessageType.INFO
        );
      });
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
          <ToolbarItem className={displayFlex}>
            <MetricsReporter onChanged={this.onReporterChanged} direction={this.props.direction} />
          </ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup>
          <GrafanaLinks
            links={this.state.grafanaLinks}
            namespace={this.props.namespace}
            object={this.props.object}
            objectType={this.props.objectType}
          />
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

const mapStateToProps = (_: KialiAppState) => ({});

const IstioMetricsContainer = withRouter<RouteComponentProps<{}> & IstioMetricsProps>(
  connect(mapStateToProps)(IstioMetrics)
);

export default IstioMetricsContainer;
