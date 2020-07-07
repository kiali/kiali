import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Card, CardBody, Grid, GridItem, Toolbar, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { Dashboard, DashboardModel, ExternalLink, RawOrBucket, Overlay } from '@kiali/k-charted-pf4';
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
import history, { URLParam } from '../../app/History';
import { MetricsObjectTypes } from '../../types/Metrics';
import { GrafanaInfo } from '../../types/GrafanaInfo';
import { MessageType } from '../../types/MessageCenter';
import { GrafanaLinks } from './GrafanaLinks';
import { SpanOverlay, JaegerLineInfo } from './SpanOverlay';
import TimeRangeComponent from 'components/Time/TimeRangeComponent';
import { retrieveTimeRange, storeBounds } from 'components/Time/TimeRangeHelper';
import { RightActionBar } from 'components/RightActionBar/RightActionBar';

type MetricsState = {
  dashboard?: DashboardModel;
  labelsSettings: LabelsSettings;
  grafanaLinks: ExternalLink[];
  spanOverlay?: Overlay<JaegerLineInfo>;
  timeRange: TimeRange;
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

type Props = IstioMetricsProps & {
  // Redux props
  jaegerIntegration: boolean;
};

const displayFlex = style({
  display: 'flex'
});

class IstioMetrics extends React.Component<Props, MetricsState> {
  options: IstioMetricsOptions;
  spanOverlay: SpanOverlay;
  static grafanaInfoPromise: Promise<GrafanaInfo | undefined> | undefined;

  constructor(props: Props) {
    super(props);

    const settings = MetricsHelper.retrieveMetricsSettings();
    const timeRange = retrieveTimeRange() || MetricsHelper.defaultMetricsDuration;
    this.options = this.initOptions(settings);
    // Initialize active filters from URL
    this.state = { labelsSettings: settings.labelsSettings, grafanaLinks: [], timeRange: timeRange };
    this.spanOverlay = new SpanOverlay(props.namespace, props.object, changed =>
      this.setState({ spanOverlay: changed })
    );
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
    if (this.props.jaegerIntegration) {
      this.spanOverlay.fetch(this.state.timeRange);
    }
  };

  fetchMetrics = () => {
    // Time range needs to be reevaluated everytime fetching
    MetricsHelper.timeRangeToOptions(this.state.timeRange, this.options);
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
    this.setState({ timeRange: range }, () => {
      this.refresh();
    });
  };

  onReporterChanged = (reporter: Reporter) => {
    this.options.reporter = reporter;
    this.fetchMetrics();
  };

  onClickDataPoint = (_, datum: RawOrBucket<JaegerLineInfo>) => {
    if ('start' in datum && 'end' in datum) {
      // Zoom-in bucket
      this.onDomainChange([datum.start as Date, datum.end as Date]);
    } else if ('traceId' in datum) {
      const traceId = datum.traceId;
      history.push(
        `/namespaces/${this.props.namespace}/services/${this.props.object}?tab=traces&${URLParam.JAEGER_TRACE_ID}=${traceId}`
      );
    }
  };

  private onDomainChange(dates: [Date, Date]) {
    if (dates && dates[0] && dates[1]) {
      const range: TimeRange = {
        from: dates[0].getTime(),
        to: dates[1].getTime()
      };
      storeBounds(range);
      this.onTimeFrameChanged(range);
    }
  }

  render() {
    const urlParams = new URLSearchParams(history.location.search);
    const expandedChart = urlParams.get('expand') || undefined;

    return (
      <>
        <RightActionBar>
          <TimeRangeComponent
            range={this.state.timeRange}
            onChanged={this.onTimeFrameChanged}
            tooltip={'Time range'}
            allowCustom={true}
          />
          <RefreshContainer id="metrics-refresh" handleRefresh={this.refresh} hideLabel={true} />
        </RightActionBar>
        <RenderComponentScroll>
          <Grid style={{ padding: '10px' }}>
            <GridItem span={12}>
              <Card>
                <CardBody>
                  {this.renderOptionsBar()}
                  {this.state.dashboard && (
                    <Dashboard
                      dashboard={this.state.dashboard}
                      labelValues={MetricsHelper.convertAsPromLabels(this.state.labelsSettings)}
                      maximizedChart={expandedChart}
                      expandHandler={this.expandHandler}
                      onClick={this.onClickDataPoint}
                      labelPrettifier={MetricsHelper.prettyLabelValues}
                      overlay={this.state.spanOverlay}
                      timeWindow={evalTimeRange(retrieveTimeRange() || MetricsHelper.defaultMetricsDuration)}
                      brushHandlers={{ onDomainChangeEnd: (_, props) => this.onDomainChange(props.currentDomain.x) }}
                    />
                  )}
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        </RenderComponentScroll>
      </>
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

const mapStateToProps = (state: KialiAppState) => {
  return {
    jaegerIntegration: state.jaegerState.info ? state.jaegerState.info.integration : false
  };
};

const IstioMetricsContainer = withRouter<RouteComponentProps<{}> & IstioMetricsProps, any>(
  connect(mapStateToProps)(IstioMetrics)
);

export default IstioMetricsContainer;
