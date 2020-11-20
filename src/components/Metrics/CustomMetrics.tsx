import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Toolbar, ToolbarGroup, ToolbarItem, Grid, GridItem, Card, CardBody } from '@patternfly/react-core';
import { style } from 'typestyle';

import { serverConfig } from '../../config/ServerConfig';
import history, { URLParam } from '../../app/History';
import * as API from '../../services/Api';
import { KialiAppState } from '../../store/Store';
import { TimeRange, evalTimeRange, TimeInMilliseconds, isEqualTimeRange } from '../../types/Common';
import * as AlertUtils from '../../utils/AlertUtils';
import { RenderComponentScroll } from '../../components/Nav/Page';
import * as MetricsHelper from './Helper';
import { MetricsSettings, LabelsSettings } from '../MetricsOptions/MetricsSettings';
import { MetricsSettingsDropdown } from '../MetricsOptions/MetricsSettingsDropdown';
import MetricsRawAggregation from '../MetricsOptions/MetricsRawAggregation';
import { GrafanaLinks } from './GrafanaLinks';
import { MetricsObjectTypes } from 'types/Metrics';
import { SpanOverlay, JaegerLineInfo } from './SpanOverlay';
import { retrieveTimeRange } from 'components/Time/TimeRangeHelper';
import { DashboardModel, ExternalLink } from 'types/Dashboards';
import { Overlay } from 'types/Overlay';
import { Aggregator, DashboardQuery } from 'types/MetricsOptions';
import { RawOrBucket } from 'types/VictoryChartInfo';
import { Dashboard } from 'components/Charts/Dashboard';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { bindActionCreators } from 'redux';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { timeRangeSelector } from '../../store/Selectors';

type MetricsState = {
  dashboard?: DashboardModel;
  labelsSettings: LabelsSettings;
  grafanaLinks: ExternalLink[];
  spanOverlay?: Overlay<JaegerLineInfo>;
};

type CustomMetricsProps = RouteComponentProps<{}> & {
  namespace: string;
  app: string;
  version?: string;
  workload?: string;
  template: string;
};

type Props = CustomMetricsProps & {
  // Redux props
  jaegerIntegration: boolean;
  lastRefreshAt: TimeInMilliseconds;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
};

const displayFlex = style({
  display: 'flex'
});

export class CustomMetrics extends React.Component<Props, MetricsState> {
  options: DashboardQuery;
  spanOverlay: SpanOverlay;

  constructor(props: Props) {
    super(props);

    const settings = MetricsHelper.retrieveMetricsSettings();
    this.options = this.initOptions(settings);
    // Initialize active filters from URL
    this.state = { labelsSettings: settings.labelsSettings, grafanaLinks: [] };
    this.spanOverlay = new SpanOverlay(changed => this.setState({ spanOverlay: changed }));
  }

  private initOptions(settings: MetricsSettings): DashboardQuery {
    const filters = `${serverConfig.istioLabels.appLabelName}:${this.props.app}`;
    const options: DashboardQuery = this.props.version
      ? {
          labelsFilters: `${filters},${serverConfig.istioLabels.versionLabelName}:${this.props.version}`
        }
      : {
          labelsFilters: filters,
          additionalLabels: 'version:Version'
        };
    MetricsHelper.settingsToOptions(settings, options, []);
    return options;
  }

  componentDidMount() {
    this.refresh();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.namespace !== prevProps.namespace ||
      this.props.app !== prevProps.app ||
      this.props.workload !== prevProps.workload ||
      this.props.version !== prevProps.version ||
      this.props.template !== prevProps.template ||
      this.props.lastRefreshAt !== prevProps.lastRefreshAt ||
      !isEqualTimeRange(this.props.timeRange, prevProps.timeRange)
    ) {
      const settings = MetricsHelper.retrieveMetricsSettings();
      this.options = this.initOptions(settings);
      this.spanOverlay.reset();
      this.refresh();
    }
  }

  private refresh = () => {
    this.fetchMetrics();
    if (this.props.jaegerIntegration) {
      this.spanOverlay.fetch({
        namespace: this.props.namespace,
        target: this.props.workload || this.props.app,
        targetKind: this.props.workload ? MetricsObjectTypes.WORKLOAD : MetricsObjectTypes.APP,
        range: this.props.timeRange
      });
    }
  };

  private fetchMetrics = () => {
    // Time range needs to be reevaluated everytime fetching
    MetricsHelper.timeRangeToOptions(this.props.timeRange, this.options);
    API.getCustomDashboard(this.props.namespace, this.props.template, this.options)
      .then(response => {
        const labelsSettings = MetricsHelper.extractLabelsSettings(response.data, this.state.labelsSettings);
        this.setState({
          dashboard: response.data,
          labelsSettings: labelsSettings,
          grafanaLinks: response.data.externalLinks
        });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch custom dashboard.', error);
      });
  };

  private onMetricsSettingsChanged = (settings: MetricsSettings) => {
    MetricsHelper.settingsToOptions(settings, this.options, []);
    this.fetchMetrics();
  };

  private onLabelsFiltersChanged = (labelsFilters: LabelsSettings) => {
    this.setState({ labelsSettings: labelsFilters });
  };

  private onRawAggregationChanged = (aggregator: Aggregator) => {
    this.options.rawDataAggregator = aggregator;
    this.fetchMetrics();
  };

  private onClickDataPoint = (_, datum: RawOrBucket<JaegerLineInfo>) => {
    if ('start' in datum && 'end' in datum) {
      // Zoom-in bucket
      this.onDomainChange([datum.start as Date, datum.end as Date]);
    } else if ('traceId' in datum) {
      const traceId = datum.traceId;
      history.push(
        `/namespaces/${this.props.namespace}/applications/${this.props.app}?tab=traces&${URLParam.JAEGER_TRACE_ID}=${traceId}`
      );
    }
  };

  private onDomainChange(dates: [Date, Date]) {
    if (dates && dates[0] && dates[1]) {
      const range: TimeRange = {
        from: dates[0].getTime(),
        to: dates[1].getTime()
      };
      this.props.setTimeRange(range);
    }
  }

  render() {
    const urlParams = new URLSearchParams(history.location.search);
    const expandedChart = urlParams.get('expand') || undefined;

    return (
      <>
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
                      overlay={this.state.spanOverlay}
                      timeWindow={evalTimeRange(retrieveTimeRange())}
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

  private renderOptionsBar() {
    const hasHistograms =
      this.state.dashboard !== undefined && this.state.dashboard.charts.some(chart => chart.metrics.some(m => m.stat));
    return (
      <Toolbar style={{ paddingBottom: 8 }}>
        <ToolbarGroup>
          <ToolbarItem>
            <MetricsSettingsDropdown
              onChanged={this.onMetricsSettingsChanged}
              onLabelsFiltersChanged={this.onLabelsFiltersChanged}
              labelsSettings={this.state.labelsSettings}
              hasHistograms={hasHistograms}
            />
          </ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarItem className={displayFlex}>
            <MetricsRawAggregation onChanged={this.onRawAggregationChanged} />
          </ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup>
          <GrafanaLinks
            links={this.state.grafanaLinks}
            namespace={this.props.namespace}
            object={this.props.app}
            objectType={MetricsObjectTypes.APP}
            version={this.props.version}
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
    jaegerIntegration: state.jaegerState.info ? state.jaegerState.info.integration : false,
    lastRefreshAt: state.globalState.lastRefreshAt,
    timeRange: timeRangeSelector(state)
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setTimeRange: bindActionCreators(UserSettingsActions.setTimeRange, dispatch)
  };
};

const CustomMetricsContainer = withRouter<RouteComponentProps<{}> & CustomMetricsProps, any>(
  connect(mapStateToProps, mapDispatchToProps)(CustomMetrics)
);

export default CustomMetricsContainer;
