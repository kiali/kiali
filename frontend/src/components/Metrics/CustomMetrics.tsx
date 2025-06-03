import * as React from 'react';
import { connect } from 'react-redux';
import {
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Card,
  CardBody,
  EmptyState,
  EmptyStateVariant,
  EmptyStateHeader
} from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { router, HistoryManager, URLParam, location } from '../../app/History';
import * as API from '../../services/Api';
import { KialiAppState } from '../../store/Store';
import { TimeRange, evalTimeRange, TimeInMilliseconds, isEqualTimeRange } from '../../types/Common';
import * as AlertUtils from '../../utils/AlertUtils';
import { RenderComponentScroll } from '../../components/Nav/Page';
import * as MetricsHelper from './Helper';
import { KioskElement } from '../Kiosk/KioskElement';
import { MetricsSettings, LabelsSettings } from '../MetricsOptions/MetricsSettings';
import { MetricsSettingsDropdown } from '../MetricsOptions/MetricsSettingsDropdown';
import { MetricsRawAggregation } from '../MetricsOptions/MetricsRawAggregation';
import { TimeDurationModal } from '../Time/TimeDurationModal';
import { GrafanaLinks } from './GrafanaLinks';
import { MetricsObjectTypes } from 'types/Metrics';
import { SpanOverlay, JaegerLineInfo } from './SpanOverlay';
import { DashboardModel } from 'types/Dashboards';
import { Overlay } from 'types/Overlay';
import { Aggregator, DashboardQuery } from 'types/MetricsOptions';
import { RawOrBucket } from 'types/VictoryChartInfo';
import { Dashboard } from 'components/Charts/Dashboard';
import { KialiDispatch } from 'types/Redux';
import { bindActionCreators } from 'redux';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { timeRangeSelector } from '../../store/Selectors';
import { TimeDurationIndicator } from '../Time/TimeDurationIndicator';
import { isParentKiosk, kioskContextMenuAction } from 'components/Kiosk/KioskActions';
import { TraceSpansLimit } from './TraceSpansLimit';
import { GrafanaInfo } from '../../types/GrafanaInfo';

type MetricsState = {
  cluster?: string;
  dashboard?: DashboardModel;
  grafanaInfo: GrafanaInfo;
  isTimeOptionsOpen: boolean;
  labelsSettings: LabelsSettings;
  showSpans: boolean;
  spanOverlay?: Overlay<JaegerLineInfo>;
  tabHeight: number;
  traceLimit: number;
};

type CustomMetricsProps = {
  app: string;
  appLabelName?: string;
  embedded?: boolean;
  height?: number;
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  template: string;
  version?: string;
  versionLabelName?: string;
  workload?: string;
  workloadType?: string;
};

type ReduxStateProps = {
  kiosk: string;
  timeRange: TimeRange;
  tracingIntegration: boolean;
};

type ReduxDispatchProps = {
  setTimeRange: (range: TimeRange) => void;
};

type Props = ReduxStateProps & ReduxDispatchProps & CustomMetricsProps;

// lower that the standard default, we apply it to several small charts
const traceLimitDefault = 20;

const fullHeightStyle = kialiStyle({
  height: '100%'
});

const emptyStyle = kialiStyle({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
  // fix height + padding
  height: '350px',
  textAlign: 'center'
});

class CustomMetricsComponent extends React.Component<Props, MetricsState> {
  toolbarRef: React.RefObject<HTMLDivElement>;
  options: DashboardQuery;
  spanOverlay: SpanOverlay;

  constructor(props: Props) {
    super(props);
    this.toolbarRef = React.createRef<HTMLDivElement>();
    const settings = MetricsHelper.retrieveMetricsSettings(traceLimitDefault);
    this.options = this.initOptions(settings);

    // Initialize active filters from URL
    const cluster = HistoryManager.getClusterName();
    this.state = {
      cluster: cluster,
      grafanaInfo: {
        externalLinks: []
      },
      isTimeOptionsOpen: false,
      labelsSettings: settings.labelsSettings,
      showSpans: settings.showSpans,
      tabHeight: 300,
      traceLimit: settings.spanLimit
    };

    this.spanOverlay = new SpanOverlay(changed => this.setState({ spanOverlay: changed }));
  }

  private initOptions = (settings: MetricsSettings): DashboardQuery => {
    const filters = this.props.app && this.props.appLabelName ? `${this.props.appLabelName}:${this.props.app}` : '';

    const options: DashboardQuery = this.props.version
      ? {
          labelsFilters: `${filters},${this.props.versionLabelName}:${this.props.version}`
        }
      : {
          labelsFilters: filters,
          additionalLabels: 'version:Version'
        };

    MetricsHelper.settingsToOptions(settings, options, []);

    return options;
  };

  componentDidMount(): void {
    this.refresh();
  }

  componentDidUpdate(prevProps: Props, prevState: MetricsState): void {
    if (
      this.props.namespace !== prevProps.namespace ||
      this.props.app !== prevProps.app ||
      this.props.workload !== prevProps.workload ||
      this.props.version !== prevProps.version ||
      this.props.template !== prevProps.template ||
      this.props.lastRefreshAt !== prevProps.lastRefreshAt ||
      this.state.showSpans !== prevState.showSpans ||
      this.state.traceLimit !== prevState.traceLimit ||
      !isEqualTimeRange(this.props.timeRange, prevProps.timeRange)
    ) {
      const settings = MetricsHelper.retrieveMetricsSettings(this.state.traceLimit);
      this.options = this.initOptions(settings);
      this.spanOverlay.reset();
      this.refresh();
    }
  }

  private refresh = (): void => {
    this.fetchMetrics();

    if (this.state.showSpans) {
      this.spanOverlay.fetch({
        cluster: this.state.cluster,
        limit: this.state.traceLimit,
        namespace: this.props.namespace,
        range: this.props.timeRange,
        target: this.props.workload || this.props.app,
        targetKind: this.props.workload ? MetricsObjectTypes.WORKLOAD : MetricsObjectTypes.APP
      });
    }
  };

  private fetchMetrics = (): void => {
    // Time range needs to be reevaluated everytime fetching
    MetricsHelper.timeRangeToOptions(this.props.timeRange, this.options);

    // Workload name can be used to find personalized dashboards defined at workload level
    this.options.workload = this.props.workload;
    this.options.workloadType = this.props.workloadType;

    API.getCustomDashboard(this.props.namespace, this.props.template, this.options, this.state.cluster)
      .then(response => {
        const labelsSettings = MetricsHelper.extractLabelsSettings(response.data, this.state.labelsSettings);

        this.setState({
          dashboard: response.data,
          labelsSettings: labelsSettings,
          grafanaInfo: response.data
        });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch custom dashboard.', error);
      });
  };

  private onMetricsSettingsChanged = (settings: MetricsSettings): void => {
    MetricsHelper.settingsToOptions(settings, this.options, []);
    this.fetchMetrics();
  };

  private onLabelsFiltersChanged = (labelsFilters: LabelsSettings): void => {
    this.setState({ labelsSettings: labelsFilters });
  };

  private onRawAggregationChanged = (aggregator: Aggregator): void => {
    this.options.rawDataAggregator = aggregator;
    this.fetchMetrics();
  };

  private onClickDataPoint = (_, datum: RawOrBucket<JaegerLineInfo>): void => {
    if ('start' in datum && 'end' in datum) {
      // Zoom-in bucket
      this.onDomainChange([datum.start as Date, datum.end as Date]);
    } else if ('traceId' in datum) {
      const traceId = datum.traceId;
      const spanId = datum.spanId;

      const traceUrl = `/namespaces/${this.props.namespace}/applications/${this.props.app}?tab=traces&${URLParam.TRACING_TRACE_ID}=${traceId}&${URLParam.TRACING_SPAN_ID}=${spanId}`;

      if (isParentKiosk(this.props.kiosk)) {
        kioskContextMenuAction(traceUrl);
      } else {
        router.navigate(traceUrl);
      }
    }
  };

  private onDomainChange = (dates: [Date, Date]): void => {
    if (dates && dates[0] && dates[1]) {
      const range: TimeRange = {
        from: dates[0].getTime(),
        to: dates[1].getTime()
      };

      this.props.setTimeRange(range);
    }
  };

  renderFetchMetrics = (title: string): React.ReactNode => {
    return (
      <div className={emptyStyle}>
        <EmptyState variant={EmptyStateVariant.sm}>
          <EmptyStateHeader titleText={<>{title}</>} headingLevel="h5" />
        </EmptyState>
      </div>
    );
  };

  render(): React.ReactNode {
    const urlParams = new URLSearchParams(location.getSearch());
    const expandedChart = urlParams.get('expand') || undefined;

    // 20px (card margin) + 24px (card padding) + 51px (toolbar) + 15px (toolbar padding) + 24px (card padding) + 20px (card margin)
    const toolbarHeight = this.toolbarRef.current ? this.toolbarRef.current.clientHeight : 51;
    const toolbarSpace = 20 + 24 + toolbarHeight + 15 + 24 + 20;
    const dashboardHeight = (this.props.height ? this.props.height : this.state.tabHeight) - toolbarSpace;

    const dashboard = this.state.dashboard && (
      <Dashboard
        dashboard={this.state.dashboard}
        customMetric={true}
        template={this.props.template}
        labelValues={MetricsHelper.convertAsPromLabels(this.state.labelsSettings)}
        maximizedChart={expandedChart}
        expandHandler={this.expandHandler}
        onClick={this.onClickDataPoint}
        showSpans={this.state.showSpans}
        dashboardHeight={dashboardHeight}
        overlay={this.state.spanOverlay}
        timeWindow={evalTimeRange(this.props.timeRange)}
        brushHandlers={{ onDomainChangeEnd: (_, props) => this.onDomainChange(props.currentDomain.x) }}
      />
    );

    const content = (
      <>
        {this.renderOptionsBar()}
        {this.state.dashboard !== undefined ? dashboard : this.renderFetchMetrics('Loading metrics')}
      </>
    );

    return (
      <>
        {this.props.embedded ? (
          <>{content}</>
        ) : (
          <RenderComponentScroll onResize={height => this.setState({ tabHeight: height })}>
            <Card className={fullHeightStyle}>
              <CardBody>{content}</CardBody>
            </Card>
          </RenderComponentScroll>
        )}

        <TimeDurationModal
          customDuration={true}
          isOpen={this.state.isTimeOptionsOpen}
          onConfirm={this.toggleTimeOptionsVisibility}
          onCancel={this.toggleTimeOptionsVisibility}
        />
      </>
    );
  }

  private onTraceSpansChange = (checked: boolean, limit: number): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.set(URLParam.SHOW_SPANS, String(checked));
    if (checked) {
      urlParams.set(URLParam.TRACING_LIMIT_TRACES, String(limit));
    } else {
      urlParams.delete(URLParam.SHOW_SPANS);
    }
    router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });
    this.setState({ showSpans: checked, traceLimit: limit });
  };

  private renderOptionsBar = (): React.ReactNode => {
    const hasHistograms =
      this.state.dashboard !== undefined && this.state.dashboard.charts.some(chart => chart.metrics.some(m => m.stat));

    const hasLabels = this.state.labelsSettings.size > 0;

    return (
      <div ref={this.toolbarRef}>
        <Toolbar style={{ paddingBottom: 15 }}>
          <ToolbarGroup>
            {(hasHistograms || hasLabels) && (
              <ToolbarItem>
                <MetricsSettingsDropdown
                  onChanged={this.onMetricsSettingsChanged}
                  onLabelsFiltersChanged={this.onLabelsFiltersChanged}
                  direction={this.state.dashboard?.title || 'dashboard'}
                  labelsSettings={this.state.labelsSettings}
                  hasHistograms={hasHistograms}
                  hasHistogramsAverage={hasHistograms}
                  hasHistogramsPercentiles={hasHistograms}
                />
              </ToolbarItem>
            )}

            <ToolbarItem>
              <MetricsRawAggregation onChanged={this.onRawAggregationChanged} />
            </ToolbarItem>

            {this.props.tracingIntegration && (
              <ToolbarItem style={{ alignSelf: 'center' }}>
                <TraceSpansLimit
                  label="Spans"
                  onChange={this.onTraceSpansChange}
                  showSpans={this.state.showSpans}
                  traceLimit={this.state.traceLimit}
                />
              </ToolbarItem>
            )}

            <KioskElement>
              <ToolbarItem style={{ marginLeft: 'auto' }}>
                <TimeDurationIndicator onClick={this.toggleTimeOptionsVisibility} />
              </ToolbarItem>
            </KioskElement>
          </ToolbarGroup>

          <ToolbarGroup style={{ marginLeft: 'auto', paddingRight: '20px' }}>
            <GrafanaLinks
              links={this.state.grafanaInfo.externalLinks}
              namespace={this.props.namespace}
              object={this.props.workload ? this.props.workload : this.props.app}
              objectType={this.props.workload ? MetricsObjectTypes.WORKLOAD : MetricsObjectTypes.APP}
              datasourceUID={this.state.grafanaInfo.datasourceUID}
              version={this.props.version}
            />
          </ToolbarGroup>
        </Toolbar>
      </div>
    );
  };

  private expandHandler = (expandedChart?: string): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.delete('expand');

    if (expandedChart) {
      urlParams.set('expand', expandedChart);
    }

    router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
  };

  private toggleTimeOptionsVisibility = (): void => {
    this.setState(prevState => ({ isTimeOptionsOpen: !prevState.isTimeOptionsOpen }));
  };
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => {
  return {
    kiosk: state.globalState.kiosk,
    timeRange: timeRangeSelector(state),
    tracingIntegration: state.tracingState.info ? state.tracingState.info.integration : false
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    setTimeRange: bindActionCreators(UserSettingsActions.setTimeRange, dispatch)
  };
};

export const CustomMetrics = connect(mapStateToProps, mapDispatchToProps)(CustomMetricsComponent);
