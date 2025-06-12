import * as React from 'react';
import {
  Alert,
  Button,
  ButtonVariant,
  Card,
  CardBody,
  Checkbox,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  Form,
  FormGroup,
  Grid,
  GridItem,
  MenuGroup,
  MenuToggle,
  MenuToggleElement,
  Modal,
  Tab,
  TextInput,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import memoize from 'micro-memoize';
import { AutoSizer, List } from 'react-virtualized';
import { kialiStyle } from 'styles/StyleUtils';
import { addError, addSuccess } from 'utils/AlertUtils';
import { AccessLog, LogEntry, LogType, Pod, PodLogs } from '../../types/IstioObjects';
import { getPodLogs, getWorkloadSpans, setPodEnvoyProxyLogLevel } from '../../services/Api';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { ToolbarDropdown } from '../../components/Dropdown/ToolbarDropdown';
import {
  evalTimeRange,
  isEqualTimeRange,
  Theme,
  TimeInMilliseconds,
  TimeInSeconds,
  TimeRange
} from '../../types/Common';
import { RenderComponentScroll } from '../../components/Nav/Page';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { KialiIcon } from '../../config/KialiIcon';
import screenfull, { Screenfull } from 'screenfull';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { timeRangeSelector } from '../../store/Selectors';
import { PFColors } from 'components/Pf/PfColors';
import { AccessLogModal } from 'components/Envoy/AccessLogModal';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { location, router, URLParam } from 'app/History';
import { Span, TracingQuery } from 'types/Tracing';
import moment from 'moment';
import { formatDuration } from 'utils/tracing/TracingHelper';
import { kebabToggleStyle } from 'styles/DropdownStyles';
import { isValid } from 'utils/Common';
import { KioskElement } from '../../components/Kiosk/KioskElement';
import { TimeDurationModal } from '../../components/Time/TimeDurationModal';
import { TimeDurationIndicator } from '../../components/Time/TimeDurationIndicator';
import { serverConfig } from '../../config';
import { ApiResponse } from 'types/Api';
import { isParentKiosk, kioskContextMenuAction } from 'components/Kiosk/KioskActions';
import { TRACE_LIMIT_DEFAULT } from 'components/Metrics/TraceLimit';
import { TraceSpansLimit } from 'components/Metrics/TraceSpansLimit';
import { infoStyle } from 'styles/IconStyle';
import { WaypointInfo } from '../../types/Workload';
import { istioProxyName } from './WorkloadDetailsPage';
import AceEditor from 'react-ace';
import { istioAceEditorStyle } from 'styles/AceEditorStyle';
import { t } from 'i18next';
import { ParameterizedTabs } from 'components/Tab/Tabs';
import { basicTabStyle } from 'styles/TabStyles';
import { classes } from 'typestyle';

const appContainerColors = [PFColors.Blue200, PFColors.Blue300, PFColors.Blue400, PFColors.Blue100];
const proxyContainerColor = PFColors.Gold300;
const waypointContainerColor = PFColors.Gold500;
const spanColor = PFColors.Cyan300;

type ReduxProps = {
  kiosk: string;
  theme: string;
  timeRange: TimeRange;
  tracingIntegration: boolean;
};

const defaultTab = 'json';

const tabIndex: { [tab: string]: number } = {
  json: 0,
  table: 1
};

export type WorkloadPodLogsProps = ReduxProps & {
  cluster?: string;
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  pods: Pod[];
  waypointServiceFilter?: string;
  waypoints?: WaypointInfo[];
  workload: string;
};

type ContainerOption = {
  color: PFColors;
  displayName: string;
  isAmbient: boolean;
  isProxy: boolean;
  isSelected: boolean;
  name: string;
};

type Entry = {
  logEntry?: LogEntry;
  span?: Span;
  timestamp: string;
  timestampUnix: TimeInSeconds;
};

interface WorkloadPodLogsState {
  accessLogModals: Map<string, AccessLog>;
  containerOptions?: ContainerOption[];
  currentTab: string;
  entries: Entry[];
  fullscreen: boolean;
  hideError?: string;
  hideLogValue: string;
  isJSONModalOpen: boolean;
  isTimeOptionsOpen: boolean;
  jsonModalContent: string | undefined;
  kebabOpen: boolean;
  linesTruncatedContainers: string[];
  loadingLogs: boolean;
  loadingLogsError?: string;
  logWindowSelections: any[];
  maxLines: number;
  podValue?: number;
  showClearHideLogButton: boolean;
  showClearShowLogButton: boolean;
  showError?: string;
  showLogValue: string;
  showSpans: boolean;
  showSpansLimit: number;
  showTimestamps: boolean;
  showToolbar: boolean;
  showWaypoint: boolean;
  showZtunnel: boolean;
  useRegex: boolean;
}

// LogLevel are the log levels supported by the proxy.
enum LogLevel {
  Off = 'off',
  Trace = 'trace',
  Debug = 'debug',
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Critical = 'critical'
}

const defaultJSONIndentation = 2;

const NoLogsFoundMessage = 'No container logs found for the time period.';

const MaxLinesDefault = 3000;
const MaxLinesOptions = {
  '-1': 'All lines',
  '100': '100 lines',
  '500': '500 lines',
  '1000': '1000 lines',
  '3000': '3000 lines',
  '5000': '5000 lines',
  '10000': '10000 lines',
  '25000': '25000 lines'
};

const modalStyle = kialiStyle({
  height: '70%',
  width: '50%',
  overflow: 'auto',
  overflowY: 'hidden'
});

const previewLogLineStyle = kialiStyle({
  fontFamily: 'monospace',
  fontSize: 'var(--kiali-global--font-size)',
  backgroundColor: PFColors.Black1000,
  color: PFColors.Blue200,
  marginBottom: '1rem',
  overflowX: 'auto',
  overflowY: 'hidden',
  whiteSpace: 'nowrap',
  resize: 'none',
  padding: '0.75rem'
});

const alInfoIcon = kialiStyle({
  display: 'flex',
  width: '0.75rem'
});

const checkInfoIcon = kialiStyle({
  display: 'flex',
  width: '0.75rem',
  marginLeft: '-5px',
  marginTop: '5px'
});

const toolbarTail = kialiStyle({
  marginTop: '0.125rem'
});

const logsDiv = kialiStyle({
  marginRight: '0.5rem'
});

const logsDisplay = kialiStyle({
  fontFamily: 'monospace',
  margin: 0,
  padding: 0,
  resize: 'none',
  whiteSpace: 'pre',
  width: '100%'
});

const iconStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const copyActionStyle = kialiStyle({
  marginLeft: 'auto',
  marginTop: '0.375rem'
});

const expandActionStyle = kialiStyle({
  marginTop: '0.375rem'
});

const checkboxStyle = kialiStyle({
  marginLeft: '0.5rem',
  marginRight: '1rem'
});

const checkboxMarginStyle = kialiStyle({
  marginLeft: '1rem',
  marginRight: '1rem'
});

const logListStyle = kialiStyle({
  overflow: 'auto !important',
  paddingTop: '0.375rem',
  paddingBottom: '0.75rem'
});

const noLogsStyle = kialiStyle({
  paddingTop: '0.75rem',
  paddingLeft: '0.75rem'
});

const logLineStyle = kialiStyle({
  display: 'flex',
  height: '1.5rem',
  lineHeight: '1.5rem',
  paddingLeft: '0.75rem'
});

const logInfoStyle = kialiStyle({
  paddingLeft: 0,
  width: '0.75rem',
  height: '0.75rem',
  fontFamily: 'monospace',
  fontSize: '0.75rem'
});

const logMessageStyle = kialiStyle({
  fontSize: '0.75rem',
  paddingRight: '1rem'
});

const spansLabelStyle = kialiStyle({
  color: spanColor,
  fontWeight: 'bold'
});

const jsonTableStyle = kialiStyle({
  padding: '0.5rem',
  verticalAlign: 'top',
  borderBottom: '1px solid #eee'
});

const colorCheck = (color: string): string =>
  kialiStyle({
    accentColor: color
  });

const logsBackground = (enabled: boolean): React.CSSProperties => ({
  backgroundColor: enabled ? PFColors.Black1000 : PFColors.Black500
});

const logsHeight = (showToolbar: boolean, fullscreen: boolean, showMaxLinesWarning: boolean): React.CSSProperties => {
  const toolbarHeight = showToolbar ? '0px' : '49px';
  const maxLinesWarningHeight = showMaxLinesWarning ? '27px' : '0px';

  return {
    height: fullscreen
      ? `calc(100vh - 130px + ${toolbarHeight} - ${maxLinesWarningHeight})`
      : `calc(var(--kiali-details-pages-tab-content-height) - 155px + ${toolbarHeight} - ${maxLinesWarningHeight})`
  };
};

const tabStyle = kialiStyle({
  $nest: {
    '&& .pf-v5-c-tabs__list': {
      marginLeft: 0
    }
  }
});

export class WorkloadPodLogsComponent extends React.Component<WorkloadPodLogsProps, WorkloadPodLogsState> {
  private promises: PromisesRegistry = new PromisesRegistry();
  private podOptions: string[] = [];
  private readonly logsRef: React.RefObject<any>;

  constructor(props: WorkloadPodLogsProps) {
    super(props);
    this.logsRef = React.createRef();

    const urlParams = new URLSearchParams(location.getSearch());
    const showSpans = urlParams.get(URLParam.SHOW_SPANS);
    const showSpansLimit = urlParams.get(URLParam.TRACING_LIMIT_TRACES);
    const showWaypoint = urlParams.get(URLParam.SHOW_WAYPOINT);
    const showZtunnel = urlParams.get(URLParam.SHOW_ZTUNNEL);

    const defaultState = {
      accessLogModals: new Map<string, AccessLog>(),
      currentTab: defaultTab,
      entries: [],
      fullscreen: false,
      hideLogValue: '',
      isJSONModalOpen: false,
      isTimeOptionsOpen: false,
      jsonModalContent: undefined,
      kebabOpen: false,
      linesTruncatedContainers: [],
      loadingLogs: false,
      logWindowSelections: [],
      maxLines: MaxLinesDefault,
      showClearHideLogButton: false,
      showClearShowLogButton: false,
      showLogValue: '',
      showSpans: showSpans === 'true',
      showSpansLimit: showSpansLimit ? parseInt(showSpansLimit) : TRACE_LIMIT_DEFAULT,
      showWaypoint: showWaypoint === 'true',
      showZtunnel: showZtunnel === 'true',
      showTimestamps: false,
      showToolbar: true,
      useRegex: false
    };

    if (this.props.pods.length < 1) {
      this.state = {
        ...defaultState,
        loadingLogsError: 'There are no logs to display because no pods are available.'
      };
      return;
    }

    if (this.props.pods.length > 0) {
      for (let i = 0; i < this.props.pods.length; ++i) {
        this.podOptions[`${i}`] = this.props.pods[i].name;
      }
    }

    const podValue = 0;
    const pod = this.props.pods[podValue];
    const containerOptions = this.getContainerOptions(pod);

    this.state = {
      ...defaultState,
      containerOptions: containerOptions,
      podValue: podValue
    };
  }

  componentDidMount(): void {
    const screenFullAlias = screenfull as Screenfull;
    screenFullAlias.onchange(() => this.setState({ fullscreen: !this.state.fullscreen }));
    if (this.state.containerOptions) {
      const pod = this.props.pods[this.state.podValue!];
      this.fetchEntries(
        this.props.namespace,
        pod.name,
        this.state.containerOptions,
        this.state.showSpans,
        this.state.showSpansLimit,
        this.state.showWaypoint,
        this.state.showZtunnel,
        this.state.maxLines,
        this.props.timeRange,
        this.props.cluster
      );
    }
  }

  componentDidUpdate(prevProps: WorkloadPodLogsProps, prevState: WorkloadPodLogsState): void {
    const prevContainerOptions = prevState.containerOptions ? prevState.containerOptions : undefined;
    const newContainerOptions = this.state.containerOptions ? this.state.containerOptions : undefined;
    const updateContainerOptions = newContainerOptions && newContainerOptions !== prevContainerOptions;
    const updateMaxLines = this.state.maxLines && prevState.maxLines !== this.state.maxLines;
    const lastRefreshChanged = prevProps.lastRefreshAt !== this.props.lastRefreshAt;
    const showSpansChanged = prevState.showSpans !== this.state.showSpans;
    const showSpansLimitChanged = prevState.showSpansLimit !== this.state.showSpansLimit;
    const timeRangeChanged = !isEqualTimeRange(this.props.timeRange, prevProps.timeRange);
    const showWaypoint = prevState.showWaypoint !== this.state.showWaypoint;
    const showZtunnel = prevState.showZtunnel !== this.state.showZtunnel;

    if (
      updateContainerOptions ||
      updateMaxLines ||
      lastRefreshChanged ||
      showSpansChanged ||
      showSpansLimitChanged ||
      timeRangeChanged ||
      showWaypoint ||
      showZtunnel
    ) {
      const pod = this.props.pods[this.state.podValue!];
      this.fetchEntries(
        this.props.namespace,
        pod.name,
        newContainerOptions!,
        this.state.showSpans,
        this.state.showSpansLimit,
        this.state.showWaypoint,
        this.state.showZtunnel,
        this.state.maxLines,
        this.props.timeRange,
        this.props.cluster
      );
    }
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  render(): React.ReactNode {
    return (
      <>
        <RenderComponentScroll>
          {this.state.containerOptions && (
            <Grid key="logs" id="logs" style={{ height: '100%' }}>
              <GridItem span={12}>
                <Card>
                  <CardBody>
                    {this.state.showToolbar && (
                      <Toolbar style={{ padding: 0, width: '100%' }}>
                        <ToolbarGroup style={{ margin: 0, marginRight: '0.5rem' }}>
                          <ToolbarItem style={{ alignSelf: 'center' }}>
                            <PFBadge badge={PFBadges.Pod} position={TooltipPosition.top} />
                          </ToolbarItem>

                          <ToolbarItem style={{ alignSelf: 'center' }}>
                            <ToolbarDropdown
                              id="wpl_pods"
                              tooltip="Display logs for the selected pod"
                              handleSelect={key => this.setPod(key)}
                              value={this.state.podValue}
                              label={this.props.pods[this.state.podValue!].name}
                              options={this.podOptions!}
                            />
                          </ToolbarItem>

                          <ToolbarItem style={{ alignSelf: 'center' }}>
                            <TextInput
                              id="log_show"
                              name="log_show"
                              style={{ width: '10em' }}
                              validated={isValid(this.state.showLogValue ? !this.state.showError : undefined)}
                              autoComplete="on"
                              type="text"
                              onKeyDown={this.checkSubmitShow}
                              onChange={(_event, val) => this.updateShow(val)}
                              defaultValue={this.state.showLogValue}
                              aria-label="show log text"
                              placeholder="Show..."
                            />

                            {this.state.showClearShowLogButton && (
                              <Tooltip key="clear_show_log" position="top" content="Clear Show Log Entries...">
                                <Button variant={ButtonVariant.control} onClick={this.clearShow}>
                                  <KialiIcon.Close />
                                </Button>
                              </Tooltip>
                            )}
                          </ToolbarItem>
                          <ToolbarItem style={{ alignSelf: 'center' }}>
                            <TextInput
                              id="log_hide"
                              name="log_hide"
                              style={{ width: '10em' }}
                              validated={isValid(this.state.hideLogValue ? !this.state.hideError : undefined)}
                              autoComplete="on"
                              type="text"
                              onKeyDown={this.checkSubmitHide}
                              onChange={(_event, val) => this.updateHide(val)}
                              defaultValue={this.state.hideLogValue}
                              aria-label="hide log text"
                              placeholder="Hide..."
                            />

                            {this.state.showClearHideLogButton && (
                              <Tooltip key="clear_hide_log" position="top" content="Clear Hide Log Entries...">
                                <Button variant={ButtonVariant.control} onClick={this.clearHide}>
                                  <KialiIcon.Close />
                                </Button>
                              </Tooltip>
                            )}

                            {this.state.showError && <div style={{ color: 'red' }}>{this.state.showError}</div>}
                            {this.state.hideError && <div style={{ color: 'red' }}>{this.state.hideError}</div>}

                            <ToolbarItem style={{ alignSelf: 'center' }}>
                              <Tooltip
                                key="show_hide_log_help"
                                position="top"
                                content="Show only, or Hide all, matching log entries. Match by case-sensitive substring (default) or regular expression (as set in the kebab menu)."
                              >
                                <KialiIcon.Info className={infoStyle} />
                              </Tooltip>
                            </ToolbarItem>
                          </ToolbarItem>

                          {this.props.tracingIntegration && (
                            <ToolbarItem style={{ alignSelf: 'center' }}>
                              <TraceSpansLimit
                                inputClassName={colorCheck(spanColor)}
                                label="Spans"
                                labelClassName={spansLabelStyle}
                                onChange={this.onTraceSpansChange}
                                showSpans={this.state.showSpans}
                                traceLimit={this.state.showSpansLimit}
                              />
                            </ToolbarItem>
                          )}

                          <ToolbarItem style={{ marginLeft: 'auto' }}>
                            <ToolbarDropdown
                              id="wpl_maxLines"
                              handleSelect={key => this.setMaxLines(Number(key))}
                              value={this.state.maxLines}
                              label={MaxLinesOptions[this.state.maxLines]}
                              options={MaxLinesOptions}
                              tooltip="Truncate after N log lines"
                              className={toolbarTail}
                            />
                          </ToolbarItem>

                          <KioskElement>
                            <ToolbarItem style={{ alignSelf: 'center' }}>
                              <TimeDurationIndicator id="time_duration" onClick={this.toggleTimeOptionsVisibility} />
                            </ToolbarItem>
                          </KioskElement>
                        </ToolbarGroup>
                      </Toolbar>
                    )}
                    {this.getLogsDiv()}
                    {this.getAccessLogModals()}
                    {this.getJSONLogModal()}
                  </CardBody>
                </Card>
              </GridItem>
            </Grid>
          )}
          {this.state.loadingLogsError && <div>{this.state.loadingLogsError}</div>}
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

  private onTraceSpansChange = (checked: boolean, limit: number): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.set(URLParam.SHOW_SPANS, String(checked));
    if (checked) {
      urlParams.set(URLParam.TRACING_LIMIT_TRACES, String(limit));
    } else {
      urlParams.delete(URLParam.SHOW_SPANS);
    }

    router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });
    this.setState({ showSpans: checked, showSpansLimit: limit });
  };

  private getContainerLegend = (): React.ReactNode => {
    return (
      <Form data-test="workload-logs-pod-containers" style={{ marginTop: '0.375rem' }}>
        <FormGroup fieldId="container-log-selection" isInline>
          <PFBadge
            badge={{ badge: PFBadges.Container.badge, tt: 'Containers' }}
            style={{ marginRight: '0.75rem', height: '1.25rem' }}
            position={TooltipPosition.top}
          />

          {this.state.containerOptions!.map((c, i) => {
            return (
              <React.Fragment key={i}>
                <Checkbox
                  id={`container-${c.displayName}`}
                  key={`c-d-${i}`}
                  className={checkboxStyle}
                  inputClassName={colorCheck(c.color)}
                  isChecked={c.isSelected}
                  label={
                    <span
                      style={{
                        color: c.color,
                        fontWeight: 'bold'
                      }}
                    >
                      {c.displayName}
                    </span>
                  }
                  onChange={() => this.toggleSelected(c)}
                />
                {c.isAmbient && i + 1 === this.state.containerOptions?.length && (
                  <>
                    <Checkbox
                      id={`ztunnel-${c.displayName}`}
                      key={`ztunnel-${i}`}
                      className={checkboxStyle}
                      inputClassName={colorCheck(proxyContainerColor)}
                      isChecked={this.state.showZtunnel}
                      label={
                        <span
                          style={{
                            color: proxyContainerColor,
                            fontWeight: 'bold'
                          }}
                        >
                          ztunnel
                        </span>
                      }
                      onChange={() => this.toggleZtunnel()}
                    />
                    <Tooltip
                      key={`al-tt-tl`}
                      position={TooltipPosition.auto}
                      entryDelay={1000}
                      content="A filtered subset of log entries from the ztunnel's (ambient node proxy) pod logs, relevant to the selected workload pod"
                    >
                      <KialiIcon.Info key={`al-i-ki`} className={checkInfoIcon} color={proxyContainerColor} />
                    </Tooltip>
                    {this.props.waypoints && this.props.waypoints.length > 0 && (
                      <>
                        <Checkbox
                          id={`waypoint-${c.displayName}`}
                          key={`waypoint-${i}`}
                          className={checkboxMarginStyle}
                          inputClassName={colorCheck(waypointContainerColor)}
                          isChecked={this.state.showWaypoint}
                          label={
                            <span
                              style={{
                                color: waypointContainerColor,
                                fontWeight: 'bold'
                              }}
                            >
                              waypoint
                            </span>
                          }
                          onChange={() => this.toggleWaypoint()}
                        />
                        <Tooltip
                          key={`al-tt-tl`}
                          position={TooltipPosition.auto}
                          entryDelay={1000}
                          content="A filtered - by app name - subset of log entries from the waypoint's (ambient node proxy) pod logs, relevant to the selected workload pod"
                        >
                          <KialiIcon.Info key={`al-i-ki`} className={checkInfoIcon} color={waypointContainerColor} />
                        </Tooltip>
                      </>
                    )}
                  </>
                )}
              </React.Fragment>
            );
          })}
        </FormGroup>
      </Form>
    );
  };

  private toggleSelected = (c: ContainerOption): void => {
    c.isSelected = !c.isSelected;
    this.setState({ containerOptions: [...this.state.containerOptions!] });
  };

  private toggleZtunnel = (): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.set(URLParam.SHOW_ZTUNNEL, String(!this.state.showZtunnel));
    router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });

    this.setState({ showZtunnel: !this.state.showZtunnel });
  };

  private toggleWaypoint = (): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.set(URLParam.SHOW_WAYPOINT, String(!this.state.showWaypoint));
    router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });

    this.setState({ showWaypoint: !this.state.showWaypoint });
  };

  private toggleTimeOptionsVisibility = (): void => {
    this.setState(prevState => ({ isTimeOptionsOpen: !prevState.isTimeOptionsOpen }));
  };

  private renderLogLine = ({ index, style }: { index: number; style: React.CSSProperties }): React.ReactNode => {
    let e = this.filteredEntries(
      this.state.entries,
      this.state.showLogValue,
      this.state.hideLogValue,
      this.state.useRegex
    )[index];

    if (e.span) {
      return (
        <div key={`s-${index}`} className={logLineStyle} style={{ ...style }}>
          {this.state.showTimestamps && (
            <span key={`al-s-${index}`} className={logMessageStyle} style={{ color: spanColor }}>
              {e.timestamp}
            </span>
          )}
          <Tooltip
            key={`al-tt-${index}`}
            position={TooltipPosition.auto}
            entryDelay={1000}
            content="Click to navigate to span detail"
          >
            <Button
              key={`s-b-${index}`}
              variant={ButtonVariant.plain}
              className={logInfoStyle}
              onClick={() => {
                this.gotoSpan(e.span!);
              }}
            >
              <KialiIcon.Info key={`al-i-${index}`} className={alInfoIcon} color={spanColor} />
            </Button>
          </Tooltip>
          <p key={`al-p-${index}`} className={logMessageStyle} style={{ color: spanColor }}>
            {this.entryToString(e)}
          </p>
        </div>
      );
    }

    const le = e.logEntry!;
    const messageColor = le.color! ?? PFColors.Color200;

    return !le.accessLog ? (
      <div key={`le-d-${index}`} className={logLineStyle} style={{ ...style }}>
        {this.isJSON(e) && (
          <Tooltip
            key={`jod-tt-${index}`}
            position={TooltipPosition.auto}
            entryDelay={1000}
            content="Click for JSON object details"
          >
            <Button
              key={`jod-b-${index}`}
              variant={ButtonVariant.plain}
              className={logInfoStyle}
              onClick={() => this.openJSONModal(e)}
            >
              <KialiIcon.Info key={`jod-i-${index}`} className={alInfoIcon} color={messageColor} />
            </Button>
          </Tooltip>
        )}
        <p key={`le-${index}`} className={logMessageStyle} style={{ color: messageColor }}>
          {this.entryToString(e)}
        </p>
      </div>
    ) : (
      <div key={`al-${index}`} className={logLineStyle} style={{ ...style }}>
        {this.state.showTimestamps && (
          <span key={`al-s-${index}`} className={logMessageStyle} style={{ color: messageColor }}>
            {formatDate(le.timestamp)}
          </span>
        )}

        <Tooltip
          key={`al-tt-${index}`}
          position={TooltipPosition.auto}
          entryDelay={1000}
          content="Click for Envoy Access Log details"
        >
          <Button
            key={`al-b-${index}`}
            variant={ButtonVariant.plain}
            className={logInfoStyle}
            onClick={() => {
              this.addAccessLogModal(le.message, le.accessLog!);
            }}
          >
            <KialiIcon.Info key={`al-i-${index}`} className={alInfoIcon} color={messageColor} />
          </Button>
        </Tooltip>

        <p key={`al-p-${index}`} className={logMessageStyle} style={{ color: messageColor }}>
          {le.message}
        </p>
      </div>
    );
  };

  private getLogsDiv = (): React.ReactNode => {
    const hasProxyContainer = this.state.containerOptions?.some(opt => opt.isProxy);

    const logDropDowns = Object.keys(LogLevel).map(level => {
      return (
        <DropdownItem
          key={`setLogLevel${level}`}
          onClick={() => {
            this.setLogLevel(LogLevel[level]);
          }}
          isDisabled={serverConfig.deployment.viewOnlyMode}
        >
          {level}
        </DropdownItem>
      );
    });

    const dropdownGroupLabel = (
      <h1 className="pf-v5-c-menu__group-title">
        Set Proxy Log Level
        <Tooltip
          position={TooltipPosition.right}
          content={
            <div style={{ textAlign: 'left' }}>
              <div>
                This action configures the proxy logger level but does not affect the proxy <b>access</b> logs. Setting
                the log level to 'off' disables the proxy loggers but does <b>not</b> disable access logging. To hide
                all proxy logging from the logs view, including access logs, un-check the proxy container. <br />
                <br />
                This option is disabled for pods with no proxy container, or in view-only mode.
              </div>
            </div>
          }
        >
          <KialiIcon.Info className={infoStyle} />
        </Tooltip>
      </h1>
    );

    const kebabActions = [
      <DropdownItem key="toggleToolbar" onClick={this.toggleToolbar}>
        {`${this.state.showToolbar ? 'Collapse' : 'Expand'} Toolbar`}
      </DropdownItem>,

      <DropdownItem key="toggleRegex" onClick={this.toggleUseRegex}>
        {`Match via ${this.state.useRegex ? 'Substring' : 'Regex'}`}
      </DropdownItem>,

      <DropdownItem key="toggleTimestamps" onClick={this.toggleShowTimestamps}>
        {`${this.state.showTimestamps ? 'Remove' : 'Show'} Timestamps`}
      </DropdownItem>,

      <Divider key="logLevelSeparator" />,

      <MenuGroup key="setLogLevels" label={dropdownGroupLabel}>
        {hasProxyContainer && logDropDowns}
      </MenuGroup>
    ];

    const logEntries = this.state.entries
      ? this.filteredEntries(this.state.entries, this.state.showLogValue, this.state.hideLogValue, this.state.useRegex)
      : [];

    return (
      <div key="logsDiv" id="logsDiv" className={logsDiv}>
        <Toolbar style={{ padding: '0.25rem 0' }}>
          <ToolbarGroup style={{ margin: 0 }}>
            <ToolbarItem>{this.getContainerLegend()}</ToolbarItem>
            <ToolbarItem className={copyActionStyle}>
              <Tooltip key="copy_logs" position="top" content="Copy logs to clipboard">
                <CopyToClipboard text={this.entriesToString(this.state.entries)}>
                  <Button variant={ButtonVariant.link} isInline>
                    <KialiIcon.Copy />
                    <span className={iconStyle}>Copy</span>
                  </Button>
                </CopyToClipboard>
              </Tooltip>
            </ToolbarItem>

            <ToolbarItem className={expandActionStyle}>
              <Tooltip key="fullscreen_logs" position="top" content="Expand logs full screen">
                <Button
                  variant={ButtonVariant.link}
                  onClick={this.toggleFullscreen}
                  isDisabled={!this.hasEntries(this.state.entries)}
                  isInline
                >
                  <KialiIcon.Expand />
                  <span className={iconStyle}>Expand</span>
                </Button>
              </Tooltip>
            </ToolbarItem>

            <ToolbarItem>
              <Dropdown
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    className={kebabToggleStyle}
                    aria-label="Actions"
                    variant="plain"
                    onClick={() => this.setKebabOpen(!this.state.kebabOpen)}
                    isExpanded={this.state.kebabOpen}
                    style={{ float: 'right' }}
                  >
                    <KialiIcon.KebabToggle />
                  </MenuToggle>
                )}
                isOpen={this.state.kebabOpen}
                onOpenChange={(isOpen: boolean) => this.setKebabOpen(isOpen)}
                popperProps={{ position: 'right' }}
              >
                <DropdownList>{kebabActions}</DropdownList>
              </Dropdown>
            </ToolbarItem>
          </ToolbarGroup>
        </Toolbar>

        {this.state.linesTruncatedContainers.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <Alert
              variant="danger"
              isInline={true}
              isPlain={true}
              title={`Max lines exceeded for containers: ${this.state.linesTruncatedContainers.join(
                ', '
              )}. Increase maxLines for more lines, or decrease time period.`}
            />
          </div>
        )}

        <div
          key="logsText"
          id="logsText"
          className={logsDisplay}
          // note - for some reason the callable typescript needs to be applied as "style" and
          // not as a "className".  Otherwise the initial scroillHeight is incorrectly set
          // (to max) and when we try to assign scrollTop to scrollHeight (above),it stays at 0
          // and we fail to set the scroll correctly. So, don't change this!
          style={{
            ...logsHeight(
              this.state.showToolbar,
              this.state.fullscreen,
              this.state.linesTruncatedContainers.length > 0
            ),
            ...logsBackground(this.hasEntries(this.state.entries))
          }}
        >
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={this.logsRef}
                rowHeight={22}
                rowCount={logEntries.length}
                rowRenderer={this.renderLogLine}
                height={height}
                width={width}
                scrollToIndex={logEntries.length - 1}
                noRowsRenderer={() => <div className={noLogsStyle}>{NoLogsFoundMessage}</div>}
                containerStyle={{ overflow: 'initial' }}
                className={logListStyle}
              />
            )}
          </AutoSizer>
        </div>
      </div>
    );
  };

  private renderTabs = (): React.ReactNode[] => {
    const theme = this.props.theme;
    const jsonTab = (
      <Tab eventKey={0} title={t('JSON (Raw object)')} key="json">
        <AceEditor
          mode="json"
          theme={theme === Theme.DARK ? 'twilight' : 'eclipse'}
          value={this.state.jsonModalContent}
          className={istioAceEditorStyle}
          name="json-details-viewer"
          readOnly={true}
          width="100%"
          setOptions={{
            useWorker: false,
            showLineNumbers: true,
            tabSize: 2,
            showFoldWidgets: true
          }}
          editorProps={{ $blockScrolling: true }}
        />
      </Tab>
    );

    const tableTab = (
      <Tab eventKey={1} title={t('Parsed JSON')} key="table">
        {this.state.jsonModalContent && this.renderTableFromJson(JSON.parse(this.state.jsonModalContent))}
      </Tab>
    );

    return [jsonTab, tableTab];
  };

  private getJSONLogModal = (): React.ReactNode => {
    return (
      <Modal
        className={modalStyle}
        disableFocusTrap={true}
        title={t('JSON Log Details')}
        isOpen={this.state.isJSONModalOpen}
        onClose={this.closeJSONModal}
      >
        <p className={previewLogLineStyle}>{this.state.jsonModalContent}</p>
        <ParameterizedTabs
          id="json-log-details-tabs"
          className={classes(basicTabStyle, tabStyle)}
          onSelect={tabValue => {
            this.setState({ currentTab: tabValue });
          }}
          tabMap={tabIndex}
          defaultTab={defaultTab}
          activeTab={this.state.currentTab}
          mountOnEnter={true}
          unmountOnExit={true}
        >
          {this.renderTabs()}
        </ParameterizedTabs>
      </Modal>
    );
  };

  private getAccessLogModals = (): React.ReactNode[] => {
    const modals: React.ReactNode[] = [];
    let i = 0;

    this.state.accessLogModals.forEach((v, k) => {
      modals.push(
        <AccessLogModal
          key={`alm-${i++}`}
          accessLog={v}
          accessLogMessage={k}
          onClose={() => this.removeAccessLogModal(k)}
          isZtunnel={this.state.showZtunnel && v.upstream_cluster.includes('spiffe')}
          isWaypoint={this.state.showWaypoint && !v.upstream_cluster.includes('spiffe')}
        />
      );
    });

    return modals;
  };

  private setPod = (podValue: string): void => {
    const pod = this.props.pods[Number(podValue)];
    const containerNames = this.getContainerOptions(pod);
    this.setState({ containerOptions: containerNames, podValue: Number(podValue) });
  };

  private setMaxLines = (maxLines: number): void => {
    this.setState({ maxLines: maxLines });
  };

  private setKebabOpen = (kebabOpen: boolean): void => {
    this.setState({ kebabOpen: kebabOpen });
  };

  private gotoSpan = (span: Span): void => {
    const link =
      `/namespaces/${this.props.namespace}/workloads/${this.props.workload}` +
      `?tab=traces&${URLParam.TRACING_TRACE_ID}=${span.traceID}&${URLParam.TRACING_SPAN_ID}=${span.spanID}`;

    if (isParentKiosk(this.props.kiosk)) {
      kioskContextMenuAction(link);
    } else {
      router.navigate(link);
    }
  };

  private addAccessLogModal = (k: string, v: AccessLog): void => {
    const accessLogModals = new Map<string, AccessLog>(this.state.accessLogModals);
    accessLogModals.set(k, v);
    this.setState({ accessLogModals: accessLogModals });
  };

  private removeAccessLogModal = (k: string): void => {
    this.state.accessLogModals.delete(k);
    const accessLogModals = new Map<string, AccessLog>(this.state.accessLogModals);
    this.setState({ accessLogModals: accessLogModals });
  };

  private toggleShowTimestamps = (): void => {
    this.setState({ showTimestamps: !this.state.showTimestamps, kebabOpen: false });
  };

  private toggleToolbar = (): void => {
    this.setState({ showToolbar: !this.state.showToolbar, kebabOpen: false });
  };

  private toggleUseRegex = (): void => {
    this.setState({ useRegex: !this.state.useRegex, kebabOpen: false });
  };

  private setLogLevel = (level: LogLevel): void => {
    this.setState({ kebabOpen: false });
    const pod = this.props.pods[this.state.podValue!];

    setPodEnvoyProxyLogLevel(this.props.namespace, pod.name, level, this.props.cluster)
      .then(_resp => {
        addSuccess(`Successfully updated proxy log level to '${level}' for pod: ${pod.name}`);
      })
      .catch(error => {
        addError('Unable to set proxy pod level', error);
      });
  };

  private checkSubmitShow = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault();

      this.setState({
        showClearShowLogButton: !!(event.target as HTMLInputElement).value,
        showLogValue: (event.target as HTMLInputElement).value
      });
    }
  };

  private updateShow = (val: string): void => {
    if ('' === val) {
      this.clearShow();
    }
  };

  // filteredEntries is a memoized function which returns the set of entries that should be visible in the
  // logs pane, given the values of show and hide filter, and given the "use regex" configuration.
  // When the function is called for the first time with certain combination of parameters, the set of filtered
  // entries is calculated, cached and returned. Thereafter, if the function is called with the same values, the
  // cached set is returned; otherwise, a new set is re-calculated, re-cached and returned, and the old
  // set is discarded.
  private filteredEntries = memoize((entries: Entry[], showValue: string, hideValue: string, useRegex: boolean) => {
    let filteredEntries = entries;

    if (!!showValue) {
      if (useRegex) {
        try {
          const regexp = RegExp(showValue);
          filteredEntries = filteredEntries.filter(e => !e.logEntry || regexp.test(e.logEntry.message));

          if (!!this.state.showError) {
            this.setState({ showError: undefined });
          }
        } catch (e) {
          if (e instanceof Error) {
            this.setState({ showError: `Show: ${e.message}` });
          }
        }
      } else {
        filteredEntries = filteredEntries.filter(e => !e.logEntry || e.logEntry.message.includes(showValue));
      }
    }

    if (!!hideValue) {
      if (useRegex) {
        try {
          const regexp = RegExp(hideValue);
          filteredEntries = filteredEntries.filter(e => !e.logEntry || !regexp.test(e.logEntry.message));

          if (!!this.state.hideError) {
            this.setState({ hideError: undefined });
          }
        } catch (e) {
          if (e instanceof Error) {
            this.setState({ hideError: `Hide: ${e.message}` });
          }
        }
      } else {
        filteredEntries = filteredEntries.filter(e => !e.logEntry || !e.logEntry.message.includes(hideValue));
      }
    }

    return filteredEntries;
  });

  private clearShow = (): void => {
    // TODO: when TextInput refs are fixed in PF4 then use the ref and remove the direct HTMLElement usage
    // this.showInputRef.value = '';
    const htmlInputElement: HTMLInputElement = document.getElementById('log_show') as HTMLInputElement;
    if (htmlInputElement !== null) {
      htmlInputElement.value = '';
    }

    this.setState({
      showError: undefined,
      showLogValue: '',
      showClearShowLogButton: false
    });
  };

  private checkSubmitHide = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault();

      this.setState({
        showClearHideLogButton: !!(event.target as HTMLInputElement).value,
        hideLogValue: (event.target as HTMLInputElement).value
      });
    }
  };

  private updateHide = (val: string): void => {
    if ('' === val) {
      this.clearHide();
    }
  };

  private clearHide = (): void => {
    // TODO: when TextInput refs are fixed in PF4 then use the ref and remove the direct HTMLElement usage
    // this.hideInputRef.value = '';
    const htmlInputElement: HTMLInputElement = document.getElementById('log_hide') as HTMLInputElement;

    if (htmlInputElement !== null) {
      htmlInputElement.value = '';
    }

    this.setState({
      hideError: undefined,
      hideLogValue: '',
      showClearHideLogButton: false
    });
  };

  private toggleFullscreen = (): void => {
    const screenFullAlias = screenfull as Screenfull; // this casting was necessary

    if (screenFullAlias.isFullscreen) {
      screenFullAlias.exit();
    } else {
      const element = document.getElementById('logs');

      if (screenFullAlias.isEnabled) {
        if (element) {
          screenFullAlias.request(element);
        }
      }
    }
  };

  private getContainerOptions = (pod: Pod): ContainerOption[] => {
    // sort containers by name, consistently positioning proxy container first.
    let containers = [...(pod.istioContainers ?? [])];
    containers.push(...(pod.containers ?? []));
    // k8s native sidecars are listed within istioInitContainers
    containers.push(...(pod.istioInitContainers?.filter(cont => cont.name === istioProxyName) ?? []));

    containers = containers.sort((c1, c2) => {
      if (c1.isProxy !== c2.isProxy) {
        return c1.isProxy ? 0 : 1;
      }
      return c1.name < c2.name ? 0 : 1;
    });

    let appContainerCount = 0;
    let containerOptions = containers.map(c => {
      const name = c.name;

      const isAmbient = c.isAmbient;
      if (c.isProxy) {
        const proxyName = pod.name.includes('ztunnel') ? 'ztunnel' : 'sidecar-proxy';
        return {
          color: proxyContainerColor,
          displayName: proxyName,
          isAmbient: isAmbient,
          isProxy: true,
          isSelected: true,
          name: name
        };
      }

      const color = appContainerColors[appContainerCount++ % appContainerColors.length];
      return { color: color, displayName: name, isAmbient: isAmbient, isProxy: false, isSelected: true, name: name };
    });

    return containerOptions;
  };

  private fetchEntries = (
    namespace: string,
    podName: string,
    containerOptions: ContainerOption[],
    showSpans: boolean,
    showSpansLimit: number,
    showWaypoint: boolean,
    showZtunnel: boolean,
    maxLines: number,
    timeRange: TimeRange,
    cluster?: string
  ): void => {
    const now: TimeInMilliseconds = Date.now();
    const timeRangeDates = evalTimeRange(timeRange);
    const sinceTime: TimeInSeconds = Math.floor(timeRangeDates[0].getTime() / 1000);
    const endTime: TimeInMilliseconds = timeRangeDates[1].getTime();

    // to save work on the server-side, only supply duration when time range is in the past
    let duration = 0;

    if (endTime < now) {
      duration = Math.floor(timeRangeDates[1].getTime() / 1000) - sinceTime;
    }

    const selectedContainers = containerOptions.filter(c => c.isSelected);
    const extraContainers: ContainerOption[] = [];

    if (showZtunnel) {
      for (const c of containerOptions) {
        if (c.isAmbient) {
          const ztunnel = { ...c };
          ztunnel.isAmbient = false;
          ztunnel.color = proxyContainerColor;
          ztunnel.displayName = 'ztunnel';
          extraContainers.push(ztunnel);
        }
      }
    }

    if (showWaypoint) {
      for (const c of containerOptions) {
        if (c.isAmbient) {
          const extracontainer = { ...c };
          extracontainer.isAmbient = false;
          extracontainer.color = waypointContainerColor;
          extracontainer.displayName = 'waypoint';
          extraContainers.push(extracontainer);
        }
      }
    }

    const promises: Promise<ApiResponse<PodLogs | Span[]>>[] = selectedContainers.map(c => {
      return getPodLogs(
        namespace,
        podName,
        this.props.workload,
        this.props.waypointServiceFilter,
        c.name,
        maxLines,
        sinceTime,
        duration,
        c.isProxy ? LogType.PROXY : LogType.APP,
        cluster
      );
    });

    if (showZtunnel || showWaypoint) {
      extraContainers.forEach(c => {
        const containerType = c.displayName === 'ztunnel' ? LogType.ZTUNNEL : LogType.WAYPOINT;
        promises.push(
          getPodLogs(
            namespace,
            podName,
            this.props.workload,
            this.props.waypointServiceFilter,
            c.name,
            maxLines,
            sinceTime,
            duration,
            containerType,
            cluster
          )
        );
      });
    }

    if (showSpans) {
      // Convert seconds to microseconds
      const params: TracingQuery = {
        endMicros: endTime * 1000,
        limit: showSpansLimit,
        startMicros: sinceTime * 1000000
      };

      promises.unshift(getWorkloadSpans(namespace, this.props.workload, params, this.props.cluster));
    }

    this.promises
      .registerAll('logs', promises)
      .then(responses => {
        let entries = [] as Entry[];
        if (showSpans) {
          const spans = showSpans ? (responses[0].data as Span[]) : ([] as Span[]);

          entries = spans.map(span => {
            let startTimeU = Math.floor(span.startTime / 1000);

            return {
              timestamp: moment(startTimeU).utc().format('YYYY-MM-DD HH:mm:ss.SSS'),
              timestampUnix: startTimeU,
              span: span
            } as Entry;
          });
          responses.shift();
        }

        let linesTruncatedContainers: string[] = [];

        // TODO: Merge just if showZtunnel?
        const allContainers = selectedContainers.concat(extraContainers);
        for (let i = 0; i < responses.length; i++) {
          const response = responses[i].data as PodLogs;
          const containerLogEntries = response.entries as LogEntry[];

          if (!containerLogEntries) {
            continue;
          }

          const color = allContainers[i].color;
          containerLogEntries.forEach(le => {
            le.color = color;
            entries.push({ timestamp: le.timestamp, timestampUnix: le.timestampUnix, logEntry: le } as Entry);
          });

          if (response.linesTruncated) {
            linesTruncatedContainers.push(new URL(responses[i].request.responseURL).searchParams.get('container')!);
          }
        }

        const sortedEntries = entries.sort((a, b) => {
          return a.timestampUnix - b.timestampUnix;
        });

        this.setState({
          entries: sortedEntries,
          linesTruncatedContainers: linesTruncatedContainers,
          loadingLogs: false
        });

        return;
      })
      .catch(error => {
        if (error.isCanceled) {
          console.debug('Logs: Ignore fetch error (canceled).');
          this.setState({ loadingLogs: false });
          return;
        }

        const errorMsg = error.response?.data?.error ?? error.message;
        const now = Date.now();

        this.setState({
          loadingLogs: false,
          entries: [
            {
              timestamp: now.toString(),
              timestampUnix: now,
              logEntry: {
                severity: 'Error',
                timestamp: now.toString(),
                timestampUnix: now,
                message: `Failed to fetch workload logs: ${errorMsg}`
              }
            }
          ]
        });
      });

    this.setState({
      loadingLogs: true,
      entries: []
    });
  };

  private entriesToString = (entries: Entry[]): string => {
    return entries.map(entry => this.entryToString(entry)).join('\n');
  };

  private entryToString = (entry: Entry): string => {
    if (entry.logEntry) {
      const le = entry.logEntry;
      return this.state.showTimestamps ? `${formatDate(entry.timestamp)} ${le.message}` : le.message;
    }

    const { duration, operationName } = entry.span!;
    return `duration: ${formatDuration(duration)}, operationName: ${operationName}`;
  };

  private entryToJSON = (entry: Entry): string | undefined => {
    if (entry.logEntry) {
      return JSON.stringify(JSON.parse(entry.logEntry.message), null, defaultJSONIndentation);
    }
    return undefined;
  };

  private isJSON = (entry: Entry): boolean => {
    try {
      if (entry.logEntry) {
        const parsed = JSON.parse(entry.logEntry.message);
        return typeof parsed === 'object' && parsed !== null;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  private renderTableFromJson = (data: unknown): JSX.Element | null => {
    // Limited to objects, not arrays of objects
    if (typeof data === 'object' && data !== null) {
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <tbody>
            {Object.entries(data as Record<string, unknown>).map(([key, value]) => (
              <tr key={key}>
                <td className={jsonTableStyle} style={{ fontWeight: 'bold' }}>
                  {key}
                </td>
                <td className={jsonTableStyle}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return null;
  };

  openJSONModal = (jsonEntry: Entry): void => {
    this.setState({ isJSONModalOpen: true, jsonModalContent: this.entryToJSON(jsonEntry) });
  };

  closeJSONModal = (): void => {
    this.setState({ isJSONModalOpen: false, jsonModalContent: undefined });
  };

  private hasEntries = (entries: Entry[]): boolean => !!entries && entries.length > 0;
}

const formatDate = (timestamp: string): string => {
  let entryTimestamp = moment(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS');

  return entryTimestamp;
};

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    kiosk: state.globalState.kiosk,
    timeRange: timeRangeSelector(state),
    tracingIntegration: state.tracingState.info?.integration ?? false,
    theme: state.globalState.theme
  };
};

export const WorkloadPodLogs = connect(mapStateToProps)(WorkloadPodLogsComponent);
