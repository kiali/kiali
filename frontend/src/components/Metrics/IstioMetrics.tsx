import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { KialiDispatch } from 'types/Redux';
import { Card, CardBody, Checkbox, Toolbar, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import * as API from 'services/Api';
import { KialiAppState } from 'store/Store';
import { TimeRange, evalTimeRange, TimeInMilliseconds, isEqualTimeRange, IntervalInMilliseconds } from 'types/Common';
import { Direction, IstioMetricsOptions, Reporter } from 'types/MetricsOptions';
import * as AlertUtils from 'utils/AlertUtils';
import { RenderComponentScroll } from 'components/Nav/Page';
import * as MetricsHelper from './Helper';
import { KioskElement } from '../Kiosk/KioskElement';
import { MetricsSettings, LabelsSettings } from '../MetricsOptions/MetricsSettings';
import { MetricsSettingsDropdown } from '../MetricsOptions/MetricsSettingsDropdown';
import { MetricsReporter } from '../MetricsOptions/MetricsReporter';
import { TimeDurationModal } from '../Time/TimeDurationModal';
import { location, router, URLParam } from 'app/History';
import { MetricsObjectTypes } from 'types/Metrics';
import { GrafanaInfo } from 'types/GrafanaInfo';
import { MessageType } from 'types/MessageCenter';
import { GrafanaLinks } from './GrafanaLinks';
import { SpanOverlay, JaegerLineInfo } from './SpanOverlay';
import { ChartModel, DashboardModel, ExternalLink } from 'types/Dashboards';
import { Overlay } from 'types/Overlay';
import { RawOrBucket } from 'types/VictoryChartInfo';
import { Dashboard } from 'components/Charts/Dashboard';
import { refreshIntervalSelector, timeRangeSelector } from 'store/Selectors';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { KialiCrippledFeatures } from 'types/ServerConfig';
import { TimeDurationIndicator } from '../Time/TimeDurationIndicator';
import { ApiResponse } from 'types/Api';
import { isParentKiosk, kioskContextMenuAction } from 'components/Kiosk/KioskActions';

type MetricsState = {
  crippledFeatures?: KialiCrippledFeatures;
  dashboard?: DashboardModel;
  grafanaLinks: ExternalLink[];
  isTimeOptionsOpen: boolean;
  labelsSettings: LabelsSettings;
  showSpans: boolean;
  showTrendlines: boolean;
  spanOverlay?: Overlay<JaegerLineInfo>;
  tabHeight: number;
};

type ObjectId = {
  cluster?: string;
  namespace: string;
  object: string;
};

type IstioMetricsProps = ObjectId & {
  direction: Direction;
  includeAmbient: boolean;
  objectType: MetricsObjectTypes;
} & {
  lastRefreshAt: TimeInMilliseconds;
};

type ReduxStateProps = {
  kiosk: string;
  refreshInterval: IntervalInMilliseconds;
  timeRange: TimeRange;
  tracingIntegration: boolean;
};

type ReduxDispatchProps = {
  setTimeRange: (range: TimeRange) => void;
};

type Props = ReduxStateProps & ReduxDispatchProps & IstioMetricsProps;

const fullHeightStyle = kialiStyle({
  height: '100%'
});

class IstioMetricsComponent extends React.Component<Props, MetricsState> {
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
      isTimeOptionsOpen: false,
      tabHeight: 300,
      showSpans: settings.showSpans,
      showTrendlines: settings.showTrendlines
    };

    this.spanOverlay = new SpanOverlay(changed => this.setState({ spanOverlay: changed }));
  }

  private initOptions(settings: MetricsSettings): IstioMetricsOptions {
    const options: IstioMetricsOptions = {
      direction: this.props.direction,
      includeAmbient: this.props.includeAmbient,
      reporter: MetricsReporter.initialReporter(this.props.direction)
    };

    const defaultLabels = [
      this.props.direction === 'inbound' ? 'source_canonical_service' : 'destination_canonical_service',
      this.props.direction === 'inbound' ? 'source_workload_namespace' : 'destination_workload_namespace'
    ];

    MetricsHelper.settingsToOptions(settings, options, defaultLabels);

    return options;
  }

  componentDidMount(): void {
    API.getCrippledFeatures().then(response => {
      this.setState({ crippledFeatures: response.data });
    });

    this.fetchGrafanaInfo();
    this.refresh();
  }

  componentDidUpdate(prevProps: Props): void {
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

  private refresh = (): void => {
    this.fetchMetrics();

    if (this.props.tracingIntegration) {
      this.spanOverlay.fetch({
        namespace: this.props.namespace,
        cluster: this.props.cluster,
        target: this.props.object,
        targetKind: this.props.objectType,
        range: this.props.timeRange
      });
    }
  };

  private fetchMetrics = (): Promise<void> => {
    // Time range needs to be reevaluated everytime fetching
    MetricsHelper.timeRangeToOptions(this.props.timeRange, this.options);
    let opts = { ...this.options };

    if (opts.reporter === 'both') {
      opts.byLabels = (opts.byLabels ?? []).concat('reporter');
    }

    let promise: Promise<ApiResponse<DashboardModel>>;

    switch (this.props.objectType) {
      case MetricsObjectTypes.WORKLOAD:
        promise = API.getWorkloadDashboard(this.props.namespace, this.props.object, opts, this.props.cluster);
        break;
      case MetricsObjectTypes.APP:
        promise = API.getAppDashboard(this.props.namespace, this.props.object, opts, this.props.cluster);
        break;
      case MetricsObjectTypes.SERVICE:
      default:
        promise = API.getServiceDashboard(this.props.namespace, this.props.object, opts, this.props.cluster);
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

  private fetchGrafanaInfo(): void {
    if (!IstioMetricsComponent.grafanaInfoPromise) {
      IstioMetricsComponent.grafanaInfoPromise = API.getGrafanaInfo().then(response => {
        if (response.status === 204) {
          return undefined;
        }

        return response.data;
      });
    }

    IstioMetricsComponent.grafanaInfoPromise
      .then(grafanaInfo => {
        if (grafanaInfo) {
          this.setState({ grafanaLinks: grafanaInfo.externalLinks });
        } else {
          this.setState({ grafanaLinks: [] });
        }
      })
      .catch(err => {
        AlertUtils.addMessage({
          ...AlertUtils.extractApiError('Could not fetch Grafana info. Turning off links to Grafana.', err),
          group: 'default',
          type: MessageType.INFO,
          showNotification: false
        });
      });
  }

  private onMetricsSettingsChanged = (settings: MetricsSettings): void => {
    const defaultLabels = [
      this.props.direction === 'inbound' ? 'source_canonical_service' : 'destination_canonical_service'
    ];

    MetricsHelper.settingsToOptions(settings, this.options, defaultLabels);
    this.fetchMetrics();
  };

  private onLabelsFiltersChanged = (labelsFilters: LabelsSettings): void => {
    this.setState({ labelsSettings: labelsFilters });
  };

  private onReporterChanged = (reporter: Reporter): void => {
    this.options.reporter = reporter;
    this.fetchMetrics();
  };

  private onClickDataPoint = (_chart: ChartModel, datum: RawOrBucket<JaegerLineInfo>): void => {
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

      const traceUrl = `/namespaces/${this.props.namespace}/${domain}/${this.props.object}?tab=traces&${URLParam.TRACING_TRACE_ID}=${traceId}&${URLParam.TRACING_SPAN_ID}=${spanId}`;

      if (isParentKiosk(this.props.kiosk)) {
        kioskContextMenuAction(traceUrl);
      } else {
        router.navigate(traceUrl);
      }
    }
  };

  private onDomainChange(dates: [Date, Date]): void {
    if (dates && dates[0] && dates[1]) {
      const range: TimeRange = {
        from: dates[0].getTime(),
        to: dates[1].getTime()
      };

      this.props.setTimeRange(range);
    }
  }

  render(): React.ReactNode {
    const urlParams = new URLSearchParams(location.getSearch());
    const expandedChart = urlParams.get('expand') ?? undefined;

    // 20px (card margin) + 24px (card padding) + 51px (toolbar) + 15px (toolbar padding) + 24px (card padding) + 20px (card margin)
    const toolbarHeight = this.toolbarRef.current ? this.toolbarRef.current.clientHeight : 51;
    const toolbarSpace = 20 + 24 + toolbarHeight + 15 + 24 + 20;
    const dashboardHeight = this.state.tabHeight - toolbarSpace;

    return (
      <>
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

        <TimeDurationModal
          customDuration={true}
          isOpen={this.state.isTimeOptionsOpen}
          onConfirm={this.toggleTimeOptionsVisibility}
          onCancel={this.toggleTimeOptionsVisibility}
        />
      </>
    );
  }

  private onSpans = (checked: boolean): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.set(URLParam.SHOW_SPANS, String(checked));
    router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });
    this.setState({ showSpans: !this.state.showSpans });
  };

  private onTrendlines = (checked: boolean): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.set(URLParam.SHOW_TRENDLINES, String(checked));
    router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });
    this.setState({ showTrendlines: !this.state.showTrendlines });
  };

  private toggleTimeOptionsVisibility = (): void => {
    this.setState(prevState => ({ isTimeOptionsOpen: !prevState.isTimeOptionsOpen }));
  };

  private renderOptionsBar(): React.ReactNode {
    const hasHistogramsAverage =
      !this.state.crippledFeatures?.requestSizeAverage ||
      !this.state.crippledFeatures?.responseSizeAverage ||
      !this.state.crippledFeatures?.responseTimeAverage;

    const hasHistogramsPercentiles =
      !this.state.crippledFeatures?.requestSizePercentiles ||
      !this.state.crippledFeatures?.responseSizePercentiles ||
      !this.state.crippledFeatures?.responseTimePercentiles;

    return (
      <div ref={this.toolbarRef}>
        <Toolbar style={{ padding: 0, marginBottom: '1.25rem' }}>
          <ToolbarGroup>
            <ToolbarItem>
              <MetricsSettingsDropdown
                onChanged={this.onMetricsSettingsChanged}
                onLabelsFiltersChanged={this.onLabelsFiltersChanged}
                direction={this.props.direction}
                labelsSettings={this.state.labelsSettings}
                hasHistograms={true}
                hasHistogramsAverage={hasHistogramsAverage}
                hasHistogramsPercentiles={hasHistogramsPercentiles}
              />
            </ToolbarItem>

            <ToolbarItem>
              <MetricsReporter
                onChanged={this.onReporterChanged}
                direction={this.props.direction}
                reporter={this.options.reporter}
              />
            </ToolbarItem>

            <ToolbarItem style={{ alignSelf: 'center' }}>
              <Checkbox
                id="spans-show-"
                isChecked={this.state.showSpans}
                key="spans-show-chart"
                label="Spans"
                onChange={(_event, checked) => this.onSpans(checked)}
              />
            </ToolbarItem>

            <ToolbarItem style={{ alignSelf: 'center' }}>
              <Checkbox
                id="trendlines-show-"
                isChecked={this.state.showTrendlines}
                key="trendlines-show-chart"
                label="Trendlines"
                onChange={(_event, checked) => this.onTrendlines(checked)}
              />
            </ToolbarItem>

            <ToolbarItem style={{ marginLeft: 'auto', paddingRight: '20px' }}>
              <GrafanaLinks
                links={this.state.grafanaLinks}
                namespace={this.props.namespace}
                object={this.props.object}
                objectType={this.props.objectType}
              />
            </ToolbarItem>

            <KioskElement>
              <ToolbarItem>
                <TimeDurationIndicator onClick={this.toggleTimeOptionsVisibility} />
              </ToolbarItem>
            </KioskElement>
          </ToolbarGroup>
        </Toolbar>
      </div>
    );
  }

  private expandHandler = (expandedChart?: string): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.delete('expand');

    if (expandedChart) {
      urlParams.set('expand', expandedChart);
    }

    router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
  };
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => {
  return {
    kiosk: state.globalState.kiosk,
    tracingIntegration: state.tracingState.info ? state.tracingState.info.integration : false,
    timeRange: timeRangeSelector(state),
    refreshInterval: refreshIntervalSelector(state)
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    setTimeRange: bindActionCreators(UserSettingsActions.setTimeRange, dispatch)
  };
};

export const IstioMetrics = connect(mapStateToProps, mapDispatchToProps)(IstioMetricsComponent);
