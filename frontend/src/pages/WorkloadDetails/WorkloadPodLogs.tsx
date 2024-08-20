import * as React from 'react';
import {
  Alert,
  Button,
  ButtonVariant,
  Card,
  CardBody,
  Grid,
  GridItem,
  TextInput,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
  TooltipPosition,
  Form,
  FormGroup,
  Dropdown,
  DropdownItem,
  KebabToggle,
  DropdownGroup,
  DropdownSeparator,
  Checkbox
} from '@patternfly/react-core';
import memoize from 'micro-memoize';
import { AutoSizer, List } from 'react-virtualized';
import { style } from 'typestyle';
import { addError, addSuccess } from 'utils/AlertUtils';
import { Pod, LogEntry, AccessLog, PodLogs } from '../../types/IstioObjects';
import { getPodLogs, getWorkloadSpans, setPodEnvoyProxyLogLevel } from '../../services/Api';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { ToolbarDropdown } from '../../components/ToolbarDropdown/ToolbarDropdown';
import { TimeRange, evalTimeRange, TimeInMilliseconds, isEqualTimeRange, TimeInSeconds } from '../../types/Common';
import { RenderComponentScroll } from '../../components/Nav/Page';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { KialiIcon, defaultIconStyle } from '../../config/KialiIcon';
import screenfull, { Screenfull } from 'screenfull';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { timeRangeSelector } from '../../store/Selectors';
import { PFColors, PFColorVal } from 'components/Pf/PfColors';
import AccessLogModal from 'components/Envoy/AccessLogModal';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import history, { URLParam } from 'app/History';
import { TracingQuery, Span } from 'types/Tracing';
import { AxiosResponse } from 'axios';
import moment from 'moment';
import { formatDuration } from 'utils/tracing/TracingHelper';
import { infoStyle } from 'styles/DropdownStyles';
import { isValid } from 'utils/Common';
import { isKiosk } from '../../components/Kiosk/KioskActions';
import { KioskElement } from '../../components/Kiosk/KioskElement';
import { TimeDurationModal } from '../../components/Time/TimeDurationModal';
import TimeDurationIndicatorContainer from '../../components/Time/TimeDurationIndicatorComponent';
import { serverConfig } from '../../config';

const appContainerColors = [PFColors.White, PFColors.LightGreen400, PFColors.Purple100, PFColors.LightBlue400];
const proxyContainerColor = PFColors.Gold400;
const spanColor = PFColors.Cyan300;

type ReduxProps = {
  kiosk: string;
  timeRange: TimeRange;
};

export type WorkloadPodLogsProps = ReduxProps & {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  pods: Pod[];
  workload: string;
};

type ContainerOption = {
  color: PFColorVal;
  displayName: string;
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
  entries: Entry[];
  fullscreen: boolean;
  hideError?: string;
  hideLogValue: string;
  isTimeOptionsOpen: boolean;
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
  showTimestamps: boolean;
  showToolbar: boolean;
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

const RETURN_KEY_CODE = 13;
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

const alInfoIcon = style({
  display: 'inline-block',
  margin: '0px 5px 0px 0px',
  width: '10px'
});

const infoIcons = style({
  marginLeft: '0.5em',
  width: '24px'
});

const toolbarTail = style({
  marginTop: '2px'
});

const logsDiv = style({
  marginRight: '5px'
});

const logsDisplay = style({
  fontFamily: 'monospace',
  margin: 0,
  overflow: 'auto',
  padding: 0,
  resize: 'none',
  whiteSpace: 'pre',
  width: '100%'
});

// For some reason checkbox as a ToolbarItem needs to be tweaked
const toolbarInputStyle = style({
  $nest: {
    '& > input': {
      marginTop: '2px'
    }
  }
});

const logsBackground = (enabled: boolean) => ({ backgroundColor: enabled ? PFColors.Black1000 : 'gray' });
const logsHeight = (showToolbar: boolean, fullscreen: boolean, kiosk: string, showMaxLinesWarning: boolean) => {
  const toolbarHeight = showToolbar ? '0px' : '49px';
  const maxLinesWarningHeight = showMaxLinesWarning ? '27px' : '0px';
  return {
    height: fullscreen
      ? `calc(100vh - 130px + ${toolbarHeight} - ${maxLinesWarningHeight})`
      : `calc(var(--kiali-details-pages-tab-content-height) - ${
          !isKiosk(kiosk) ? '155px' : '0px'
        } + ${toolbarHeight} - ${maxLinesWarningHeight})`
  };
};

export class WorkloadPodLogs extends React.Component<WorkloadPodLogsProps, WorkloadPodLogsState> {
  private promises: PromisesRegistry = new PromisesRegistry();
  private podOptions: string[] = [];
  private readonly logsRef: React.RefObject<any>;

  constructor(props: WorkloadPodLogsProps) {
    super(props);
    this.logsRef = React.createRef();

    const urlParams = new URLSearchParams(history.location.search);
    const showSpans = urlParams.get(URLParam.SHOW_SPANS);

    const defaultState = {
      accessLogModals: new Map<string, AccessLog>(),
      entries: [],
      fullscreen: false,
      hideLogValue: '',
      isTimeOptionsOpen: false,
      kebabOpen: false,
      linesTruncatedContainers: [],
      loadingLogs: false,
      logWindowSelections: [],
      maxLines: MaxLinesDefault,
      showClearHideLogButton: false,
      showClearShowLogButton: false,
      showLogValue: '',
      showSpans: showSpans === 'true',
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

  componentDidMount() {
    const screenFullAlias = screenfull as Screenfull;
    screenFullAlias.onchange(() => this.setState({ fullscreen: !this.state.fullscreen }));

    if (this.state.containerOptions) {
      const pod = this.props.pods[this.state.podValue!];
      this.fetchEntries(
        this.props.namespace,
        pod.name,
        this.state.containerOptions,
        this.state.showSpans,
        this.state.maxLines,
        this.props.timeRange
      );
    }
  }

  componentDidUpdate(prevProps: WorkloadPodLogsProps, prevState: WorkloadPodLogsState) {
    const prevContainerOptions = prevState.containerOptions ? prevState.containerOptions : undefined;
    const newContainerOptions = this.state.containerOptions ? this.state.containerOptions : undefined;
    const updateContainerOptions = newContainerOptions && newContainerOptions !== prevContainerOptions;
    const updateMaxLines = this.state.maxLines && prevState.maxLines !== this.state.maxLines;
    const lastRefreshChanged = prevProps.lastRefreshAt !== this.props.lastRefreshAt;
    const showSpansChanged = prevState.showSpans !== this.state.showSpans;
    const timeRangeChanged = !isEqualTimeRange(this.props.timeRange, prevProps.timeRange);
    if (updateContainerOptions || updateMaxLines || lastRefreshChanged || showSpansChanged || timeRangeChanged) {
      const pod = this.props.pods[this.state.podValue!];
      this.fetchEntries(
        this.props.namespace,
        pod.name,
        newContainerOptions!,
        this.state.showSpans,
        this.state.maxLines,
        this.props.timeRange
      );
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  render() {
    return (
      <>
        <RenderComponentScroll>
          {this.state.containerOptions && (
            <Grid key="logs" id="logs" style={{ height: '100%' }}>
              <GridItem span={12}>
                <Card style={{ height: '100%' }}>
                  <CardBody>
                    {this.state.showToolbar && (
                      <Toolbar style={{ padding: 0, width: '100%' }}>
                        <ToolbarGroup style={{ margin: 0, marginRight: '5px' }}>
                          <PFBadge badge={PFBadges.Pod} position={TooltipPosition.top} />
                          <ToolbarItem>
                            <ToolbarDropdown
                              id={'wpl_pods'}
                              tooltip="Display logs for the selected pod"
                              handleSelect={key => this.setPod(key)}
                              value={this.state.podValue}
                              label={this.props.pods[this.state.podValue!].name}
                              options={this.podOptions!}
                            />
                          </ToolbarItem>
                          <ToolbarItem>
                            <TextInput
                              id="log_show"
                              name="log_show"
                              style={{ width: '10em' }}
                              validated={isValid(this.state.showLogValue ? !this.state.showError : undefined)}
                              autoComplete="on"
                              type="text"
                              onKeyPress={this.checkSubmitShow}
                              onChange={this.updateShow}
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
                            <TextInput
                              id="log_hide"
                              name="log_hide"
                              style={{ width: '10em' }}
                              validated={isValid(this.state.hideLogValue ? !this.state.hideError : undefined)}
                              autoComplete="on"
                              type="text"
                              onKeyPress={this.checkSubmitHide}
                              onChange={this.updateHide}
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
                            <Tooltip
                              key="show_hide_log_help"
                              position="top"
                              content="Show only, or Hide all, matching log entries. Match by case-sensitive substring (default) or regular expression (as set in the kebab menu)."
                            >
                              <KialiIcon.Info className={infoIcons} />
                            </Tooltip>
                          </ToolbarItem>
                          <ToolbarItem>
                            <Checkbox
                              className={toolbarInputStyle}
                              id="log-spans"
                              isChecked={this.state.showSpans}
                              label={
                                <span
                                  style={{
                                    backgroundColor: PFColors.Black1000,
                                    color: spanColor
                                  }}
                                >
                                  spans
                                </span>
                              }
                              onChange={checked => this.toggleSpans(checked)}
                            />
                          </ToolbarItem>
                          <ToolbarItem style={{ marginLeft: 'auto' }}>
                            <ToolbarDropdown
                              id={'wpl_maxLines'}
                              handleSelect={key => this.setMaxLines(Number(key))}
                              value={this.state.maxLines}
                              label={MaxLinesOptions[this.state.maxLines]}
                              options={MaxLinesOptions}
                              tooltip={'Truncate after N log lines'}
                              classNameSelect={toolbarTail}
                            />
                          </ToolbarItem>
                          <KioskElement>
                            <ToolbarItem>
                              <TimeDurationIndicatorContainer onClick={this.toggleTimeOptionsVisibility} />
                            </ToolbarItem>
                          </KioskElement>
                        </ToolbarGroup>
                      </Toolbar>
                    )}
                    {this.getLogsDiv()}
                    {this.getAccessLogModals()}
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

  private toggleSpans = (checked: boolean) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.set(URLParam.SHOW_SPANS, String(checked));
    history.replace(history.location.pathname + '?' + urlParams.toString());
    this.setState({ showSpans: !this.state.showSpans });
  };

  private getContainerLegend = () => {
    return (
      <Form data-test={'workload-logs-pod-containers'}>
        <FormGroup fieldId="container-log-selection" isInline>
          <PFBadge
            badge={{ badge: PFBadges.Container.badge, tt: 'Containers' }}
            style={{ marginRight: '10px' }}
            position={TooltipPosition.top}
          />
          {this.state.containerOptions!.map((c, i) => {
            return (
              <Checkbox
                className={toolbarInputStyle}
                id={`container-${c.displayName}`}
                key={`c-d-${i}`}
                isChecked={c.isSelected}
                label={
                  <span
                    style={{
                      backgroundColor: PFColors.Black1000,
                      color: c.color
                    }}
                  >
                    {c.displayName}
                  </span>
                }
                onChange={() => this.toggleSelected(c)}
              />
            );
          })}
        </FormGroup>
      </Form>
    );
  };

  private toggleSelected = (c: ContainerOption) => {
    c.isSelected = !c.isSelected;
    this.setState({ containerOptions: [...this.state.containerOptions!] });
  };

  private toggleTimeOptionsVisibility = () => {
    this.setState(prevState => ({ isTimeOptionsOpen: !prevState.isTimeOptionsOpen }));
  };

  private renderLogLine = ({ index, style }: { index: number; style: Object }) => {
    let e = this.filteredEntries(
      this.state.entries,
      this.state.showLogValue,
      this.state.hideLogValue,
      this.state.useRegex
    )[index];
    if (e.span) {
      return (
        <div key={`s-${index}`} style={{ height: '22px', lineHeight: '22px', paddingLeft: '10px', ...style }}>
          {this.state.showTimestamps && (
            <span key={`al-s-${index}`} style={{ color: spanColor, fontSize: '12px', marginRight: '5px' }}>
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
              style={{
                paddingLeft: '6px',
                width: '10px',
                height: '10px',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
              onClick={() => {
                this.gotoSpan(e.span!);
              }}
            >
              <KialiIcon.Info key={`al-i-${index}`} className={alInfoIcon} color={spanColor} />
            </Button>
          </Tooltip>
          <p
            key={`al-p-${index}`}
            style={{
              color: spanColor,
              fontSize: '12px',
              verticalAlign: 'center',
              display: 'inline-block'
            }}
          >
            {this.entryToString(e)}
          </p>
        </div>
      );
    }
    const le = e.logEntry!;
    return !le.accessLog ? (
      <div key={`le-d-${index}`} style={{ height: '22px', lineHeight: '22px', paddingLeft: '10px', ...style }}>
        <p key={`le-${index}`} style={{ color: le.color!, fontSize: '12px' }}>
          {this.entryToString(e)}
        </p>
      </div>
    ) : (
      <div key={`al-${index}`} style={{ height: '22px', lineHeight: '22px', paddingLeft: '10px', ...style }}>
        {this.state.showTimestamps && (
          <span key={`al-s-${index}`} style={{ color: le.color!, fontSize: '12px', marginRight: '5px' }}>
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
            style={{
              paddingLeft: '6px',
              width: '10px',
              height: '10px',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}
            onClick={() => {
              this.addAccessLogModal(le.message, le.accessLog!);
            }}
          >
            <KialiIcon.Info key={`al-i-${index}`} className={alInfoIcon} color={le.color!} />
          </Button>
        </Tooltip>
        <p
          key={`al-p-${index}`}
          style={{ color: le.color!, fontSize: '12px', verticalAlign: 'center', display: 'inline-block' }}
        >
          {le.message}
        </p>
      </div>
    );
  };

  private getLogsDiv = () => {
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
      // nowrap is needed for the info icon to appear on same line as the label text
      <div style={{ whiteSpace: 'nowrap' }}>
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
      </div>
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
      <DropdownSeparator key="logLevelSeparator" />,
      <DropdownGroup label={dropdownGroupLabel} key="setLogLevels">
        {hasProxyContainer && logDropDowns}
      </DropdownGroup>
    ];

    const logEntries = this.state.entries
      ? this.filteredEntries(this.state.entries, this.state.showLogValue, this.state.hideLogValue, this.state.useRegex)
      : [];
    return (
      <div key="logsDiv" id="logsDiv" className={logsDiv}>
        <Toolbar style={{ padding: '5px 0' }}>
          <ToolbarGroup>
            <ToolbarItem>{this.getContainerLegend()}</ToolbarItem>
            <ToolbarItem style={{ marginLeft: 'auto' }}>
              <Tooltip key="copy_logs" position="top" content="Copy logs to clipboard">
                <CopyToClipboard text={this.entriesToString(this.state.entries)}>
                  <Button variant={ButtonVariant.link} isInline>
                    <KialiIcon.Copy className={defaultIconStyle} />
                  </Button>
                </CopyToClipboard>
              </Tooltip>
            </ToolbarItem>
            <ToolbarItem>
              <Tooltip key="fullscreen_logs" position="top" content="Expand logs full screen">
                <Button
                  variant={ButtonVariant.link}
                  onClick={this.toggleFullscreen}
                  isDisabled={!this.hasEntries(this.state.entries)}
                  isInline
                >
                  <KialiIcon.Expand className={defaultIconStyle} />
                </Button>
              </Tooltip>
            </ToolbarItem>
            <ToolbarItem>
              <Dropdown
                style={{ width: '20px' }}
                toggle={<KebabToggle onToggle={this.setKebabOpen} />}
                dropdownItems={kebabActions}
                isPlain
                isOpen={this.state.kebabOpen}
                position={'right'}
              />
            </ToolbarItem>
          </ToolbarGroup>
        </Toolbar>
        {this.state.linesTruncatedContainers.length > 0 && (
          <div style={{ marginBottom: '5px' }}>
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
              this.props.kiosk,
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
                noRowsRenderer={() => (
                  <div style={{ paddingTop: '10px', paddingLeft: '10px' }}>{NoLogsFoundMessage}</div>
                )}
                containerStyle={{ overflow: 'initial !important' }}
              />
            )}
          </AutoSizer>
        </div>
      </div>
    );
  };

  private getAccessLogModals = (): React.ReactFragment[] => {
    const modals: React.ReactFragment[] = [];
    let i = 0;

    this.state.accessLogModals.forEach((v, k) => {
      modals.push(
        <AccessLogModal
          key={`alm-${i++}`}
          accessLog={v}
          accessLogMessage={k}
          onClose={() => this.removeAccessLogModal(k)}
        />
      );
    });

    return modals;
  };

  private setPod = (podValue: string) => {
    const pod = this.props.pods[Number(podValue)];
    const containerNames = this.getContainerOptions(pod);
    this.setState({ containerOptions: containerNames, podValue: Number(podValue) });
  };

  private setMaxLines = (maxLines: number) => {
    this.setState({ maxLines: maxLines });
  };

  private setKebabOpen = (kebabOpen: boolean) => {
    this.setState({ kebabOpen: kebabOpen });
  };

  private gotoSpan = (span: Span) => {
    const link =
      `/namespaces/${this.props.namespace}/workloads/${this.props.workload}` +
      `?tab=traces&${URLParam.JAEGER_TRACE_ID}=${span.traceID}&${URLParam.JAEGER_SPAN_ID}=${span.spanID}`;
    history.push(link);
  };

  private addAccessLogModal = (k: string, v: AccessLog) => {
    const accessLogModals = new Map<string, AccessLog>(this.state.accessLogModals);
    accessLogModals.set(k, v);
    this.setState({ accessLogModals: accessLogModals });
  };

  private removeAccessLogModal = (k: string) => {
    this.state.accessLogModals.delete(k);
    const accessLogModals = new Map<string, AccessLog>(this.state.accessLogModals);
    this.setState({ accessLogModals: accessLogModals });
  };

  private toggleShowTimestamps = () => {
    this.setState({ showTimestamps: !this.state.showTimestamps, kebabOpen: false });
  };

  private toggleToolbar = () => {
    this.setState({ showToolbar: !this.state.showToolbar, kebabOpen: false });
  };

  private toggleUseRegex = () => {
    this.setState({ useRegex: !this.state.useRegex, kebabOpen: false });
  };

  private setLogLevel = (level: LogLevel) => {
    this.setState({ kebabOpen: false });
    const pod = this.props.pods[this.state.podValue!];

    setPodEnvoyProxyLogLevel(this.props.namespace, pod.name, level)
      .then(_resp => {
        addSuccess(`Successfully updated proxy log level to '${level}' for pod: ${pod.name}`);
      })
      .catch(error => {
        addError('Unable to set proxy pod level', error);
      });
  };

  private checkSubmitShow = event => {
    const keyCode = event.keyCode ? event.keyCode : event.which;
    if (keyCode === RETURN_KEY_CODE) {
      event.preventDefault();
      this.setState({
        showClearShowLogButton: !!event.target.value,
        showLogValue: event.target.value
      });
    }
  };

  private updateShow = val => {
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
            this.setState({showError: `Show: ${e.message}`});
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
            this.setState({hideError: `Hide: ${e.message}`});
          }
        }
      } else {
        filteredEntries = filteredEntries.filter(e => !e.logEntry || !e.logEntry.message.includes(hideValue));
      }
    }

    return filteredEntries;
  });

  private clearShow = () => {
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

  private checkSubmitHide = event => {
    const keyCode = event.keyCode ? event.keyCode : event.which;
    if (keyCode === RETURN_KEY_CODE) {
      event.preventDefault();
      this.setState({
        showClearHideLogButton: !!event.target.value,
        hideLogValue: event.target.value
      });
    }
  };

  private updateHide = val => {
    if ('' === val) {
      this.clearHide();
    }
  };

  private clearHide = () => {
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

  private toggleFullscreen = () => {
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
    let containers = [...(pod.istioContainers || [])];
    containers.push(...(pod.containers || []));
    containers = containers.sort((c1, c2) => {
      if (c1.isProxy !== c2.isProxy) {
        return c1.isProxy ? 0 : 1;
      }
      return c1.name < c2.name ? 0 : 1;
    });
    let appContainerCount = 0;
    let containerOptions = containers.map(c => {
      const name = c.name;
      if (c.isProxy) {
        return { color: proxyContainerColor, displayName: name, isProxy: true, isSelected: true, name: name };
      }

      const color = appContainerColors[appContainerCount++ % appContainerColors.length];
      return { color: color, displayName: name, isProxy: false, isSelected: true, name: name };
    });

    return containerOptions;
  };

  private fetchEntries = (
    namespace: string,
    podName: string,
    containerOptions: ContainerOption[],
    showSpans: boolean,
    maxLines: number,
    timeRange: TimeRange
  ) => {
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
    const promises: Promise<AxiosResponse<PodLogs | Span[]>>[] = selectedContainers.map(c => {
      return getPodLogs(namespace, podName, c.name, maxLines, sinceTime, duration, c.isProxy);
    });
    if (showSpans) {
      // Convert seconds to microseconds
      const params: TracingQuery = {
        endMicros: endTime * 1000,
        startMicros: sinceTime * 1000000
      };
      promises.unshift(getWorkloadSpans(namespace, this.props.workload, params));
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
        for (let i = 0; i < responses.length; i++) {
          const response = responses[i].data as PodLogs;
          const containerLogEntries = response.entries as LogEntry[];
          if (!containerLogEntries) {
            continue;
          }
          const color = selectedContainers[i].color;
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
        const errorMsg = error.response?.data?.error || error.message;
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

  private hasEntries = (entries: Entry[]): boolean => !!entries && entries.length > 0;
}

const formatDate = (timestamp: string): string => {
  let entryTimestamp = moment(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS');

  return entryTimestamp;
};

const mapStateToProps = (state: KialiAppState) => {
  return {
    kiosk: state.globalState.kiosk,
    timeRange: timeRangeSelector(state)
  };
};

const WorkloadPodLogsContainer = connect(mapStateToProps)(WorkloadPodLogs);
export default WorkloadPodLogsContainer;
