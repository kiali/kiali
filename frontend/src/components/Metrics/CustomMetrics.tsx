import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import {
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Card,
  CardBody,
  Checkbox,
  EmptyState,
  EmptyStateVariant,
  Title,
  TitleSizes
} from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { serverConfig } from '../../config/ServerConfig';
import { history, HistoryManager, URLParam } from '../../app/History';
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
import { DashboardModel, ExternalLink } from 'types/Dashboards';
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

type MetricsState = {
  cluster?: string;
  dashboard?: DashboardModel;
  isTimeOptionsOpen: boolean;
  labelsSettings: LabelsSettings;
  grafanaLinks: ExternalLink[];
  spanOverlay?: Overlay<JaegerLineInfo>;
  tabHeight: number;
  showSpans: boolean;
};

type CustomMetricsProps = RouteComponentProps<{}> & {
  namespace: string;
  app: string;
  lastRefreshAt: TimeInMilliseconds;
  version?: string;
  workload?: string;
  workloadType?: string;
  template: string;
  embedded?: boolean;
  height?: number;
};

type ReduxProps = {
  jaegerIntegration: boolean;
  kiosk: string;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
};

type Props = ReduxProps & CustomMetricsProps;

const fullHeightStyle = kialiStyle({
  height: '100%'
});

// For some reason checkbox as a ToolbarItem needs to be tweaked
const toolbarInputStyle = kialiStyle({
  $nest: {
    '&.pf-c-check input[type=checkbox]': {
      marginTop: '2px'
    }
  }
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
    const settings = MetricsHelper.retrieveMetricsSettings();
    this.options = this.initOptions(settings);
    // Initialize active filters from URL
    const cluster = HistoryManager.getClusterName();
    this.state = {
      cluster: cluster,
      isTimeOptionsOpen: false,
      labelsSettings: settings.labelsSettings,
      grafanaLinks: [],
      tabHeight: 300,
      showSpans: settings.showSpans
    };
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
        cluster: this.state.cluster,
        target: this.props.workload || this.props.app,
        targetKind: this.props.workload ? MetricsObjectTypes.WORKLOAD : MetricsObjectTypes.APP,
        range: this.props.timeRange
      });
    }
  };

  private fetchMetrics = () => {
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
      const spanId = datum.spanId;

      const traceUrl = `/namespaces/${this.props.namespace}/applications/${this.props.app}?tab=traces&${URLParam.JAEGER_TRACE_ID}=${traceId}&${URLParam.JAEGER_SPAN_ID}=${spanId}`;

      if (isParentKiosk(this.props.kiosk)) {
        kioskContextMenuAction(traceUrl);
      } else {
        history.push(traceUrl);
      }
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

  renderFetchMetrics = title => {
    return (
      <div className={emptyStyle}>
        <EmptyState variant={EmptyStateVariant.small}>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            {title}
          </Title>
        </EmptyState>
      </div>
    );
  };

  render() {
    const urlParams = new URLSearchParams(history.location.search);
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

  private onSpans = (checked: boolean) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(URLParam.SHOW_SPANS, String(checked));
    history.replace(history.location.pathname + '?' + urlParams.toString());
    this.setState({ showSpans: !this.state.showSpans });
  };

  private renderOptionsBar() {
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
            <KioskElement>
              <ToolbarItem style={{ marginLeft: 'auto' }}>
                <TimeDurationIndicator onClick={this.toggleTimeOptionsVisibility} />
              </ToolbarItem>
            </KioskElement>
          </ToolbarGroup>
          <ToolbarGroup style={{ marginLeft: 'auto', paddingRight: '20px' }}>
            <GrafanaLinks
              links={this.state.grafanaLinks}
              namespace={this.props.namespace}
              object={this.props.app}
              objectType={MetricsObjectTypes.APP}
              version={this.props.version}
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

  private toggleTimeOptionsVisibility = () => {
    this.setState(prevState => ({ isTimeOptionsOpen: !prevState.isTimeOptionsOpen }));
  };
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    jaegerIntegration: state.jaegerState.info ? state.jaegerState.info.integration : false,
    kiosk: state.globalState.kiosk,
    timeRange: timeRangeSelector(state)
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    setTimeRange: bindActionCreators(UserSettingsActions.setTimeRange, dispatch)
  };
};

export const CustomMetrics = withRouter<RouteComponentProps<{}> & CustomMetricsProps, any>(
  connect(mapStateToProps, mapDispatchToProps)(CustomMetricsComponent)
);
