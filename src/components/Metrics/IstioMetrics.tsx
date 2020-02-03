import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Card, CardBody, Grid, GridItem, Toolbar, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { Dashboard, DashboardModel, ExternalLink, Overlay } from '@kiali/k-charted-pf4';
import { style } from 'typestyle';

import RefreshContainer from '../../components/Refresh/Refresh';
import { RenderComponentScroll } from '../../components/Nav/Page';
import * as API from '../../services/Api';
import { KialiAppState } from '../../store/Store';
import { TimeRange, evalTimeRange } from '../../types/Common';
import { Direction, IstioMetricsOptions, Reporter } from '../../types/MetricsOptions';
import * as AlertUtils from '../../utils/AlertUtils';

import * as MetricsHelper from './Helper';
import { MetricsSettings, LabelsSettings } from '../MetricsOptions/MetricsSettings';
import { MetricsSettingsDropdown } from '../MetricsOptions/MetricsSettingsDropdown';
import MetricsReporter from '../MetricsOptions/MetricsReporter';
import history from '../../app/History';
import { MetricsObjectTypes } from '../../types/Metrics';
import { GrafanaInfo } from '../../types/GrafanaInfo';
import { MessageType } from '../../types/MessageCenter';
import { GrafanaLinks } from './GrafanaLinks';
import { SpanOverlay } from './SpanOverlay';
import TimeRangeComponent from 'components/Time/TimeRangeComponent';
import { retrieveTimeRange } from 'components/Time/TimeRangeHelper';

type MetricsState = {
  dashboard?: DashboardModel;
  labelsSettings: LabelsSettings;
  grafanaLinks: ExternalLink[];
  spanOverlay?: Overlay;
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
  timeRange: TimeRange;
  spanOverlay: SpanOverlay;
  static grafanaInfoPromise: Promise<GrafanaInfo | undefined> | undefined;

  constructor(props: IstioMetricsProps) {
    super(props);

    const settings = MetricsHelper.retrieveMetricsSettings();
    this.timeRange = retrieveTimeRange() || MetricsHelper.defaultMetricsDuration;
    this.options = this.initOptions(settings);
    // Initialize active filters from URL
    this.state = { labelsSettings: settings.labelsSettings, grafanaLinks: [] };
    this.spanOverlay = new SpanOverlay(changed => this.setState({ spanOverlay: changed }));
  }

  initOptions(settings: MetricsSettings): IstioMetricsOptions {
    const options: IstioMetricsOptions = {
      reporter: MetricsReporter.initialReporter(this.props.direction),
      direction: this.props.direction
    };
    MetricsHelper.settingsToOptions(settings, options);
    return options;
  }

  componentDidMount() {
    this.fetchGrafanaInfo();
    this.refresh();
  }

  refresh = () => {
    this.fetchMetrics();
    this.spanOverlay.fetch(
      this.props.namespace,
      this.props.object,
      this.options.duration || MetricsHelper.defaultMetricsDuration
    );
  };

  fetchMetrics = () => {
    // Time range needs to be reevaluated everytime fetching
    MetricsHelper.timeRangeToOptions(this.timeRange, this.options);
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

  onTimeFrameChanged = (range: TimeRange) => {
    this.timeRange = range;
    this.spanOverlay.resetLastFetchTime();
    this.refresh();
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
      <RenderComponentScroll>
        <Grid style={{ padding: '20px' }}>
          <GridItem span={12}>
            <Card>
              <CardBody>
                {this.renderOptionsBar()}
                <Dashboard
                  dashboard={this.state.dashboard}
                  labelValues={MetricsHelper.convertAsPromLabels(this.state.labelsSettings)}
                  expandedChart={expandedChart}
                  expandHandler={this.expandHandler}
                  labelPrettifier={MetricsHelper.prettyLabelValues}
                  overlay={this.state.spanOverlay}
                  timeWindow={evalTimeRange(retrieveTimeRange() || MetricsHelper.defaultMetricsDuration)}
                />
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </RenderComponentScroll>
    );
  }

  renderOptionsBar() {
    return (
      <Toolbar style={{ paddingBottom: 8 }}>
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
            <TimeRangeComponent
              onChanged={this.onTimeFrameChanged}
              tooltip={'Time range for metrics'}
              allowCustom={true}
            />
          </ToolbarItem>
          <ToolbarItem>
            <RefreshContainer id="metrics-refresh" handleRefresh={this.refresh} hideLabel={true} />
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

const IstioMetricsContainer = withRouter<RouteComponentProps<{}> & IstioMetricsProps, any>(
  connect(mapStateToProps)(IstioMetrics)
);

export default IstioMetricsContainer;
