import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { RouteComponentProps, withRouter } from 'react-router';
import { Card, CardBody, Checkbox, Toolbar, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { style } from 'typestyle';
import * as API from 'services/Api';
import { KialiAppState } from 'store/Store';
import { TimeRange, evalTimeRange, TimeInMilliseconds, isEqualTimeRange } from 'types/Common';
import { Direction, IstioMetricsOptions, Reporter } from 'types/MetricsOptions';
import * as AlertUtils from 'utils/AlertUtils';
import { RenderComponentScroll } from 'components/Nav/Page';
import * as MetricsHelper from './Helper';
import { MetricsSettings, LabelsSettings } from '../MetricsOptions/MetricsSettings';
import { MetricsSettingsDropdown } from '../MetricsOptions/MetricsSettingsDropdown';
import MetricsReporter from '../MetricsOptions/MetricsReporter';
import history, { URLParam } from 'app/History';
import { MetricsObjectTypes } from 'types/Metrics';
import { GrafanaInfo } from 'types/GrafanaInfo';
import { MessageType } from 'types/MessageCenter';
import { GrafanaLinks } from './GrafanaLinks';
import { SpanOverlay, JaegerLineInfo } from './SpanOverlay';
import { DashboardModel, ExternalLink } from 'types/Dashboards';
import { Overlay } from 'types/Overlay';
import { RawOrBucket } from 'types/VictoryChartInfo';
import { Dashboard } from 'components/Charts/Dashboard';
import { timeRangeSelector } from 'store/Selectors';
import { KialiAppAction } from 'actions/KialiAppAction';
import { UserSettingsActions } from 'actions/UserSettingsActions';

type MetricsState = {
  dashboard?: DashboardModel;
  labelsSettings: LabelsSettings;
  grafanaLinks: ExternalLink[];
  spanOverlay?: Overlay<JaegerLineInfo>;
  tabHeight: number;
  showSpans: boolean;
  showTrendlines: boolean;
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
  lastRefreshAt: TimeInMilliseconds;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
};

const fullHeightStyle = style({
  height: '100%'
});

// For some reason checkbox as a ToolbarItem needs to be tweaked
const toolbarInputStyle = style({
  $nest: {
    '& > input': {
      marginTop: '2px'
    }
  }
});

class IstioMetrics extends React.Component<Props, MetricsState> {
  toolbarRef: React.RefObject<HTMLDivElement>;
  options: IstioMetricsOptions;
  spanOverlay: SpanOverlay;
  static grafanaInfoPromise: Promise<GrafanaInfo | undefined> | undefined;

  constructor(props: Props) {
    super(props);
    this.toolbarRef = React.createRef<HTMLDivElement>();
    const settings = MetricsHelper.retrieveMetricsSettings();
    this.options = this.initOptions(settings);
    // Initialize active filters from URL
    this.state = {
      labelsSettings: settings.labelsSettings,
      grafanaLinks: [],
      tabHeight: 300,
      showSpans: settings.showSpans,
      showTrendlines: settings.showTrendlines
    };
    this.spanOverlay = new SpanOverlay(changed => this.setState({ spanOverlay: changed }));
  }

  private initOptions(settings: MetricsSettings): IstioMetricsOptions {
    const options: IstioMetricsOptions = {
      reporter: MetricsReporter.initialReporter(this.props.direction),
      direction: this.props.direction
    };
    const defaultLabels = [
      this.props.direction === 'inbound' ? 'source_canonical_service' : 'destination_canonical_service',
      this.props.direction === 'inbound' ? 'source_workload_namespace' : 'destination_workload_namespace'
    ];
    MetricsHelper.settingsToOptions(settings, options, defaultLabels);
    return options;
  }

  componentDidMount() {
    this.fetchGrafanaInfo();
    this.refresh();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.direction !== prevProps.direction ||
      this.props.namespace !== prevProps.namespace ||
      this.props.object !== prevProps.object ||
      this.props.objectType !== prevProps.objectType ||
      this.props.lastRefreshAt !== prevProps.lastRefreshAt ||
      !isEqualTimeRange(this.props.timeRange, prevProps.timeRange)
    ) {
      if (this.props.direction !== prevProps.direction) {
        const settings = MetricsHelper.retrieveMetricsSettings();
        this.options = this.initOptions(settings);
        this.setState({
          labelsSettings: settings.labelsSettings,
          showSpans: settings.showSpans,
          showTrendlines: settings.showTrendlines
        });
      }
      this.spanOverlay.reset();
      this.refresh();
    }
  }

  private refresh = () => {
    this.fetchMetrics();
    if (this.props.jaegerIntegration) {
      this.spanOverlay.fetch({
        namespace: this.props.namespace,
        target: this.props.object,
        targetKind: this.props.objectType,
        range: this.props.timeRange
      });
    }
  };

  private fetchMetrics = () => {
    // Time range needs to be reevaluated everytime fetching
    MetricsHelper.timeRangeToOptions(this.props.timeRange, this.options);
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

  private fetchGrafanaInfo() {
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
        AlertUtils.addMessage({
          ...AlertUtils.extractAxiosError('Could not fetch Grafana info. Turning off links to Grafana.', err),
          group: 'default',
          type: MessageType.INFO,
          showNotification: false
        });
      });
  }

  private onMetricsSettingsChanged = (settings: MetricsSettings) => {
    const defaultLabels = [
      this.props.direction === 'inbound' ? 'source_canonical_service' : 'destination_canonical_service'
    ];
    MetricsHelper.settingsToOptions(settings, this.options, defaultLabels);
    this.fetchMetrics();
  };

  private onLabelsFiltersChanged = (labelsFilters: LabelsSettings) => {
    this.setState({ labelsSettings: labelsFilters });
  };

  private onReporterChanged = (reporter: Reporter) => {
    this.options.reporter = reporter;
    this.fetchMetrics();
  };

  private onClickDataPoint = (_, datum: RawOrBucket<JaegerLineInfo>) => {
    if ('start' in datum && 'end' in datum) {
      // Zoom-in bucket
      this.onDomainChange([datum.start as Date, datum.end as Date]);
    } else if ('traceId' in datum) {
      const traceId = datum.traceId;
      const spanId = datum.spanId;
      const domain =
        this.props.objectType === MetricsObjectTypes.APP
          ? 'applications'
          : this.props.objectType === MetricsObjectTypes.SERVICE
          ? 'services'
          : 'workloads';
      history.push(
        `/namespaces/${this.props.namespace}/${domain}/${this.props.object}?tab=traces&${URLParam.JAEGER_TRACE_ID}=${traceId}&${URLParam.JAEGER_SPAN_ID}=${spanId}`
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

    // 20px (card margin) + 24px (card padding) + 51px (toolbar) + 15px (toolbar padding) + 24px (card padding) + 20px (card margin)
    const toolbarHeight = this.toolbarRef.current ? this.toolbarRef.current.clientHeight : 51;
    const toolbarSpace = 20 + 24 + toolbarHeight + 15 + 24 + 20;
    const dashboardHeight = this.state.tabHeight - toolbarSpace;
    return (
      <RenderComponentScroll onResize={height => this.setState({ tabHeight: height })}>
        <Card className={fullHeightStyle}>
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
                showSpans={this.state.showSpans}
                showTrendlines={this.state.showTrendlines}
                dashboardHeight={dashboardHeight}
                timeWindow={evalTimeRange(this.props.timeRange)}
                brushHandlers={{ onDomainChangeEnd: (_, props) => this.onDomainChange(props.currentDomain.x) }}
              />
            )}
          </CardBody>
        </Card>
      </RenderComponentScroll>
    );
  }

  private onSpans = (checked: boolean) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(URLParam.SHOW_SPANS, String(checked));
    history.replace(history.location.pathname + '?' + urlParams.toString());
    this.setState({ showSpans: !this.state.showSpans });
  };

  private onTrendlines = (checked: boolean) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(URLParam.SHOW_TRENDLINES, String(checked));
    history.replace(history.location.pathname + '?' + urlParams.toString());
    this.setState({ showTrendlines: !this.state.showTrendlines });
  };

  private renderOptionsBar() {
    return (
      <div ref={this.toolbarRef}>
        <Toolbar style={{ padding: 0 }}>
          <ToolbarGroup>
            <ToolbarItem>
              <MetricsSettingsDropdown
                onChanged={this.onMetricsSettingsChanged}
                onLabelsFiltersChanged={this.onLabelsFiltersChanged}
                direction={this.props.direction}
                labelsSettings={this.state.labelsSettings}
                hasHistograms={true}
              />
            </ToolbarItem>
            <ToolbarItem>
              <MetricsReporter
                onChanged={this.onReporterChanged}
                direction={this.props.direction}
                reporter={this.options.reporter}
              />
            </ToolbarItem>
            <ToolbarItem>
              <Checkbox
                className={toolbarInputStyle}
                id={`spans-show-`}
                isChecked={this.state.showSpans}
                key={`spans-show-chart`}
                label="Spans"
                onChange={checked => this.onSpans(checked)}
              />
            </ToolbarItem>
            <ToolbarItem>
              <Checkbox
                className={toolbarInputStyle}
                id={`trendlines-show-`}
                isChecked={this.state.showTrendlines}
                key={`trendlines-show-chart`}
                label="Trendlines"
                onChange={checked => this.onTrendlines(checked)}
              />
            </ToolbarItem>
          </ToolbarGroup>
          <ToolbarGroup style={{ marginLeft: 'auto', paddingRight: '20px' }}>
            <GrafanaLinks
              links={this.state.grafanaLinks}
              namespace={this.props.namespace}
              object={this.props.object}
              objectType={this.props.objectType}
            />
          </ToolbarGroup>
        </Toolbar>
      </div>
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

const IstioMetricsContainer = withRouter<RouteComponentProps<{}> & IstioMetricsProps, any>(
  connect(mapStateToProps, mapDispatchToProps)(IstioMetrics)
);

export default IstioMetricsContainer;
