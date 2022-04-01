import * as React from 'react';
import {
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
  DropdownSeparator
} from '@patternfly/react-core';
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

const appContainerColors = [PFColors.White, PFColors.LightGreen400, PFColors.Purple100, PFColors.LightBlue400];
const proxyContainerColor = PFColors.Gold400;
const spanColor = PFColors.Cyan300;

type ReduxProps = {
  lastRefreshAt: TimeInMilliseconds;
  timeRange: TimeRange;
};

export type WorkloadPodLogsProps = ReduxProps & {
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
  isHidden?: boolean;
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
  kebabOpen: boolean;
  loadingLogs: boolean;
  loadingLogsError?: string;
  logWindowSelections: any[];
  podValue?: number;
  showClearHideLogButton: boolean;
  showClearShowLogButton: boolean;
  showError?: string;
  showLogValue: string;
  showSpans: boolean;
  showTimestamps: boolean;
  showToolbar: boolean;
  tailLines: number;
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

const TailLinesDefault = 100;
const TailLinesOptions = {
  '-1': 'All lines',
  '10': '10 lines',
  '50': '50 lines',
  '100': '100 lines',
  '300': '300 lines',
  '500': '500 lines',
  '1000': '1000 lines',
  '5000': '5000 lines'
};

const alInfoIcon = style({
  display: 'inline-block',
  margin: '0px 5px 0px 0px',
  width: '10px'
});

const displayFlex = style({
  display: 'flex'
});

const infoIcons = style({
  marginLeft: '0.5em',
  width: '24px'
});

const toolbar = style({
  margin: '0 0 10px 0'
});

const toolbarSpace = style({
  marginLeft: '1em'
});

const toolbarRight = style({
  marginLeft: 'auto'
});

const toolbarTail = style({
  marginTop: '2px'
});

const logsToolbar = style({
  height: '40px',
  margin: '0 10px 0 0'
});

const logsDiv = style({
  marginRight: '5px'
});

const logsDisplay = style({
  fontFamily: 'monospace',
  margin: 0,
  overflow: 'auto',
  padding: '10px',
  resize: 'none',
  whiteSpace: 'pre',
  width: '100%'
});

const logsBackground = (enabled: boolean) => ({ backgroundColor: enabled ? PFColors.Black1000 : 'gray' });
const logsHeight = (showToolbar: boolean, fullscreen: boolean) => {
  const toolbarHeight = showToolbar ? '0px' : '49px';
  return {
    height: fullscreen
      ? `calc(100vh - 130px + ${toolbarHeight})`
      : `calc(var(--kiali-details-pages-tab-content-height) - 155px + ${toolbarHeight})`
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
      kebabOpen: false,
      loadingLogs: false,
      logWindowSelections: [],
      showClearHideLogButton: false,
      showClearShowLogButton: false,
      showLogValue: '',
      showSpans: showSpans !== 'true' ? false : true,
      showTimestamps: false,
      showToolbar: true,
      tailLines: TailLinesDefault,
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
        this.state.tailLines,
        this.props.timeRange
      );
    }
  }

  componentDidUpdate(prevProps: WorkloadPodLogsProps, prevState: WorkloadPodLogsState) {
    const prevContainerOptions = prevState.containerOptions ? prevState.containerOptions : undefined;
    const newContainerOptions = this.state.containerOptions ? this.state.containerOptions : undefined;
    const updateContainerOptions = newContainerOptions && newContainerOptions !== prevContainerOptions;
    const updateTailLines = this.state.tailLines && prevState.tailLines !== this.state.tailLines;
    const lastRefreshChanged = prevProps.lastRefreshAt !== this.props.lastRefreshAt;
    const showSpansChanged = prevState.showSpans !== this.state.showSpans;
    const timeRangeChanged = !isEqualTimeRange(this.props.timeRange, prevProps.timeRange);
    if (updateContainerOptions || updateTailLines || lastRefreshChanged || showSpansChanged || timeRangeChanged) {
      const pod = this.props.pods[this.state.podValue!];
      this.fetchEntries(
        this.props.namespace,
        pod.name,
        newContainerOptions!,
        this.state.showSpans,
        this.state.tailLines,
        this.props.timeRange
      );
    }

    if (prevState.useRegex !== this.state.useRegex) {
      this.doShowAndHide();
    }

    // if we just loaded log entries, and we are scrolled to the top, position the user automatically
    // to the bottom/most recent.
    if (prevState.loadingLogs && !this.state.loadingLogs && this.logsRef.current.scrollTop === 0) {
      this.logsRef.current.scrollTop = this.logsRef.current.scrollHeight;
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  renderItem = object => {
    return <ToolbarItem className={displayFlex}>{object}</ToolbarItem>;
  };

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
                      <Toolbar className={toolbar}>
                        <ToolbarGroup>
                          <PFBadge badge={PFBadges.Pod} position={TooltipPosition.top} />
                          <ToolbarItem className={displayFlex}>
                            <ToolbarDropdown
                              id={'wpl_pods'}
                              tooltip="Display logs for the selected pod"
                              handleSelect={key => this.setPod(key)}
                              value={this.state.podValue}
                              label={this.props.pods[this.state.podValue!].name}
                              options={this.podOptions!}
                            />
                          </ToolbarItem>
                        </ToolbarGroup>
                        <ToolbarGroup>
                          <ToolbarItem>
                            <TextInput
                              id="log_show"
                              name="log_show"
                              style={{ width: '8em' }}
                              isValid={!this.state.showError}
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
                              style={{ width: '8em' }}
                              isValid={!this.state.hideError}
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
                          </ToolbarItem>
                          <ToolbarItem>
                            <Tooltip
                              key="show_hide_log_help"
                              position="top"
                              content="Show only, or Hide all, matching log entries. Match by case-sensitive substring (default) or regular expression (as set in the kebab menu)."
                            >
                              <KialiIcon.Info className={infoIcons} />
                            </Tooltip>
                          </ToolbarItem>
                        </ToolbarGroup>
                        <ToolbarGroup>
                          <ToolbarItem className={displayFlex}>
                            <div className="pf-c-check">
                              <input
                                key={`spans-show-chart`}
                                id={`spans-show-`}
                                className="pf-c-check__input"
                                style={{ marginBottom: '3px' }}
                                type="checkbox"
                                checked={this.state.showSpans}
                                onChange={event => this.toggleSpans(event.target.checked)}
                              />
                              <label
                                className="pf-c-check__label"
                                style={{
                                  backgroundColor: PFColors.Black1000,
                                  color: spanColor,
                                  paddingLeft: '5px',
                                  paddingRight: '5px'
                                }}
                              >
                                spans
                              </label>
                            </div>
                          </ToolbarItem>
                        </ToolbarGroup>
                        <ToolbarGroup className={toolbarRight}>
                          <ToolbarItem className={displayFlex}>
                            <ToolbarDropdown
                              id={'wpl_tailLines'}
                              handleSelect={key => this.setTailLines(Number(key))}
                              value={this.state.tailLines}
                              label={TailLinesOptions[this.state.tailLines]}
                              options={TailLinesOptions}
                              tooltip={'Show up to last N log lines'}
                              classNameSelect={toolbarTail}
                            />
                          </ToolbarItem>
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
      <Form>
        <FormGroup fieldId="container-log-selection" isInline>
          <PFBadge
            badge={{ badge: PFBadges.Container.badge, tt: 'Containers' }}
            style={{ marginRight: '10px' }}
            position={TooltipPosition.top}
          />
          {this.state.containerOptions!.map((c, i) => {
            return (
              <div key={`c-d-${i}`} className="pf-c-check">
                <input
                  key={`c-i-${i}`}
                  id={`container-${i}`}
                  className="pf-c-check__input"
                  style={{ marginBottom: '3px' }}
                  type="checkbox"
                  checked={c.isSelected}
                  onChange={() => this.toggleSelected(c)}
                />
                <label
                  key={`c-l-${i}`}
                  htmlFor={`container-${i}`}
                  className="pf-c-check__label"
                  style={{
                    backgroundColor: PFColors.Black1000,
                    color: c.color,
                    paddingLeft: '5px',
                    paddingRight: '5px'
                  }}
                >
                  {c.displayName}
                </label>
              </div>
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

  private getLogsDiv = () => {
    const hasProxyContainer = this.state.containerOptions?.some(opt => opt.isProxy);
    const logDropDowns = Object.keys(LogLevel).map(level => {
      return (
        <DropdownItem
          key={`setLogLevel${level}`}
          onClick={() => {
            this.setLogLevel(LogLevel[level]);
          }}
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
                This option is disabled for pods with no proxy container.
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

    return (
      <div key="logsDiv" id="logsDiv" className={logsDiv}>
        <Toolbar className={logsToolbar}>
          <ToolbarGroup>
            <ToolbarItem>{this.getContainerLegend()}</ToolbarItem>
          </ToolbarGroup>
          <ToolbarGroup className={toolbarRight}>
            <ToolbarItem>
              <Tooltip key="copy_logs" position="top" content="Copy logs to clipboard">
                <CopyToClipboard text={this.entriesToString(this.state.entries)}>
                  <Button variant={ButtonVariant.link} isInline>
                    <KialiIcon.Copy className={defaultIconStyle} />
                  </Button>
                </CopyToClipboard>
              </Tooltip>
            </ToolbarItem>
            <ToolbarItem className={toolbarSpace}>
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

        <div
          key="logsText"
          id="logsText"
          className={logsDisplay}
          // note - for some reason the callable typescript needs to be applied as "style" and
          // not as a "className".  Otherwise the initial scroillHeight is incorrectly set
          // (to max) and when we try to assign scrollTop to scrollHeight (above),it stays at 0
          // and we fail to set the scroll correctly. So, don't change this!
          style={{
            ...logsHeight(this.state.showToolbar, this.state.fullscreen),
            ...logsBackground(this.hasEntries(this.state.entries))
          }}
          ref={this.logsRef}
        >
          {this.hasEntries(this.state.entries)
            ? this.state.entries
                .filter(e => !e.isHidden)
                .map((e, i) => {
                  if (e.span) {
                    return (
                      <div key={`s-${i}`} style={{ height: '22px', lineHeight: '22px' }}>
                        {this.state.showTimestamps && (
                          <span key={`al-s-${i}`} style={{ color: spanColor, fontSize: '12px', marginRight: '5px' }}>
                            {e.timestamp}
                          </span>
                        )}
                        <Tooltip
                          key={`al-tt-${i}`}
                          position={TooltipPosition.auto}
                          entryDelay={1000}
                          content="Click to navigate to span detail"
                        >
                          <Button
                            key={`s-b-${i}`}
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
                            <KialiIcon.Info key={`al-i-${i}`} className={alInfoIcon} color={spanColor} />
                          </Button>
                        </Tooltip>
                        <p
                          key={`al-p-${i}`}
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
                    <div key={`le-d-${i}`} style={{ height: '22px', lineHeight: '22px' }}>
                      <p key={`le-${i}`} style={{ color: le.color!, fontSize: '12px' }}>
                        {this.entryToString(e)}
                      </p>
                    </div>
                  ) : (
                    <div key={`al-${i}`} style={{ height: '22px', lineHeight: '22px' }}>
                      {this.state.showTimestamps && (
                        <span key={`al-s-${i}`} style={{ color: le.color!, fontSize: '12px', marginRight: '5px' }}>
                          {e.timestamp}
                        </span>
                      )}
                      <Tooltip
                        key={`al-tt-${i}`}
                        position={TooltipPosition.auto}
                        entryDelay={1000}
                        content="Click for Envoy Access Log details"
                      >
                        <Button
                          key={`al-b-${i}`}
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
                          <KialiIcon.Info key={`al-i-${i}`} className={alInfoIcon} color={le.color!} />
                        </Button>
                      </Tooltip>
                      <p
                        key={`al-p-${i}`}
                        style={{ color: le.color!, fontSize: '12px', verticalAlign: 'center', display: 'inline-block' }}
                      >
                        {le.message}
                      </p>
                    </div>
                  );
                })
            : NoLogsFoundMessage}
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

  private setTailLines = (tailLines: number) => {
    this.setState({ tailLines: tailLines });
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

  private doShowAndHide = () => {
    this.filterEntries(this.state.entries, this.state.showLogValue, this.state.hideLogValue);
    this.setState({
      entries: [...this.state.entries],
      showClearShowLogButton: !!this.state.showLogValue,
      showClearHideLogButton: !!this.state.hideLogValue
    });
  };

  private checkSubmitShow = event => {
    const keyCode = event.keyCode ? event.keyCode : event.which;
    if (keyCode === RETURN_KEY_CODE) {
      event.preventDefault();
      this.doShowAndHide();
    }
  };

  private updateShow = val => {
    if ('' === val) {
      this.clearShow();
    } else {
      this.setState({ showLogValue: val });
    }
  };

  private filterEntries = (entries: Entry[], showValue: string, hideValue: string): void => {
    entries.forEach(e => (e.isHidden = undefined));

    if (!!showValue) {
      if (this.state.useRegex) {
        try {
          const regexp = RegExp(showValue);
          entries.forEach(e => (e.isHidden = e.logEntry && !regexp.test(e.logEntry.message)));
          if (!!this.state.showError) {
            this.setState({ showError: undefined });
          }
        } catch (e) {
          this.setState({ showError: `Show: ${e.message}` });
        }
      } else {
        entries.forEach(e => (e.isHidden = e.logEntry && !e.logEntry.message.includes(showValue)));
      }
    }
    if (!!hideValue) {
      if (this.state.useRegex) {
        try {
          const regexp = RegExp(hideValue);
          entries.forEach(e => (e.isHidden = e.isHidden || (e.logEntry && regexp.test(e.logEntry.message))));
          if (!!this.state.hideError) {
            this.setState({ hideError: undefined });
          }
        } catch (e) {
          this.setState({ hideError: `Hide: ${e.message}` });
        }
      } else {
        entries.forEach(e => (e.isHidden = e.isHidden || (e.logEntry && e.logEntry.message.includes(hideValue))));
      }
    }
  };

  private clearShow = () => {
    // TODO: when TextInput refs are fixed in PF4 then use the ref and remove the direct HTMLElement usage
    // this.showInputRef.value = '';
    const htmlInputElement: HTMLInputElement = document.getElementById('log_show') as HTMLInputElement;
    if (htmlInputElement !== null) {
      htmlInputElement.value = '';
    }

    this.filterEntries(this.state.entries, '', this.state.hideLogValue);
    this.setState({
      showError: undefined,
      showLogValue: '',
      showClearShowLogButton: false,
      entries: [...this.state.entries]
    });
  };

  private checkSubmitHide = event => {
    const keyCode = event.keyCode ? event.keyCode : event.which;
    if (keyCode === RETURN_KEY_CODE) {
      event.preventDefault();
      this.doShowAndHide();
    }
  };

  private updateHide = val => {
    if ('' === val) {
      this.clearHide();
    } else {
      this.setState({ hideLogValue: val });
    }
  };

  private clearHide = () => {
    // TODO: when TextInput refs are fixed in PF4 then use the ref and remove the direct HTMLElement usage
    // this.hideInputRef.value = '';
    const htmlInputElement: HTMLInputElement = document.getElementById('log_hide') as HTMLInputElement;
    if (htmlInputElement !== null) {
      htmlInputElement.value = '';
    }

    this.filterEntries(this.state.entries, this.state.showLogValue, '');
    this.setState({
      hideError: undefined,
      hideLogValue: '',
      showClearHideLogButton: false,
      entries: [...this.state.entries]
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
    tailLines: number,
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
      return getPodLogs(namespace, podName, c.name, tailLines, sinceTime, duration, c.isProxy);
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
            span.startTime = Math.floor(span.startTime / 1000000);
            return {
              timestamp: moment(span.startTime * 1000)
                .utc()
                .format('YYYY-MM-DD HH:mm:ss'),
              timestampUnix: span.startTime,
              span: span
            } as Entry;
          });
          responses.shift();
        }

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
        }

        this.filterEntries(entries, this.state.showLogValue, this.state.hideLogValue);
        const sortedEntries = entries.sort((a, b) => {
          return a.timestampUnix - b.timestampUnix;
        });

        this.setState({
          entries: sortedEntries,
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
        const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
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
      return this.state.showTimestamps ? `${entry.timestamp} ${le.message}` : le.message;
    }

    const { duration, operationName } = entry.span!;
    return `duration: ${formatDuration(duration)}, operationName: ${operationName}`;
  };

  private hasEntries = (entries: Entry[]): boolean => !!entries && entries.length > 0;
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    timeRange: timeRangeSelector(state),
    lastRefreshAt: state.globalState.lastRefreshAt
  };
};

const WorkloadPodLogsContainer = connect(mapStateToProps)(WorkloadPodLogs);
export default WorkloadPodLogsContainer;
