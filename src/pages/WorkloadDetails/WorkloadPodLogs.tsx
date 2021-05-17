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
  KebabToggle
} from '@patternfly/react-core';
import { style } from 'typestyle';
import { Pod, LogEntry, AccessLog } from '../../types/IstioObjects';
import { getPodLogs } from '../../services/Api';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { ToolbarDropdown } from '../../components/ToolbarDropdown/ToolbarDropdown';
import { TimeRange, evalTimeRange, TimeInMilliseconds, isEqualTimeRange } from '../../types/Common';
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

const appContainerColors = [PFColors.White, PFColors.LightGreen400, PFColors.LightBlue400, PFColors.Purple100];
const proxyContainerColor = PFColors.Gold400;

export interface WorkloadPodLogsProps {
  namespace: string;
  pods: Pod[];
  timeRange: TimeRange;
  lastRefreshAt: TimeInMilliseconds;
}

interface Container {
  color: PFColorVal;
  displayName: string;
  isProxy: boolean;
  isSelected: boolean;
  name: string;
}

interface WorkloadPodLogsState {
  accessLogModals: Map<string, AccessLog>;
  containers?: Container[];
  filteredLogs: LogEntry[];
  fullscreen: boolean;
  hideError?: string;
  hideLogValue: string;
  kebabOpen: boolean;
  loadingLogs: boolean;
  loadingLogsError?: string;
  logWindowSelections: any[];
  podValue?: number;
  rawLogs: LogEntry[];
  showClearHideLogButton: boolean;
  showClearShowLogButton: boolean;
  showError?: string;
  showLogValue: string;
  showTimestamps: boolean;
  showToolbar: boolean;
  tailLines: number;
  useRegex: boolean;
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

class WorkloadPodLogs extends React.Component<WorkloadPodLogsProps, WorkloadPodLogsState> {
  private promises: PromisesRegistry = new PromisesRegistry();
  private podOptions: string[] = [];
  private readonly logsRef: React.RefObject<any>;

  constructor(props: WorkloadPodLogsProps) {
    super(props);
    this.logsRef = React.createRef();

    const defaultState = {
      accessLogModals: new Map<string, AccessLog>(),
      filteredLogs: [],
      fullscreen: false,
      hideLogValue: '',
      kebabOpen: false,
      loadingLogs: false,
      logWindowSelections: [],
      rawLogs: [],
      showClearHideLogButton: false,
      showClearShowLogButton: false,
      showLogValue: '',
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
    const containers = this.getContainers(pod);

    this.state = {
      ...defaultState,
      containers: containers,
      podValue: podValue
    };
  }

  componentDidMount() {
    const screenFullAlias = screenfull as Screenfull;
    screenFullAlias.onchange(() => this.setState({ fullscreen: !this.state.fullscreen }));

    if (this.state.containers) {
      const pod = this.props.pods[this.state.podValue!];
      this.fetchLogs(this.props.namespace, pod.name, this.state.containers, this.state.tailLines, this.props.timeRange);
    }
  }

  componentDidUpdate(prevProps: WorkloadPodLogsProps, prevState: WorkloadPodLogsState) {
    const prevContainers = prevState.containers ? prevState.containers : undefined;
    const newContainers = this.state.containers ? this.state.containers : undefined;
    const updateContainerInfo = this.state.containers && this.state.containers !== prevState.containers;
    const updateContainer = newContainers && newContainers !== prevContainers;
    const updateTailLines = this.state.tailLines && prevState.tailLines !== this.state.tailLines;
    const lastRefreshChanged = prevProps.lastRefreshAt !== this.props.lastRefreshAt;
    const timeRangeChanged = !isEqualTimeRange(this.props.timeRange, prevProps.timeRange);
    if (updateContainerInfo || updateContainer || updateTailLines || lastRefreshChanged || timeRangeChanged) {
      const pod = this.props.pods[this.state.podValue!];
      this.fetchLogs(this.props.namespace, pod.name, newContainers!, this.state.tailLines, this.props.timeRange);
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
          {this.state.containers && (
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

  private getContainerLegend = () => {
    return (
      <Form>
        <FormGroup fieldId="container-log-selection" isInline>
          <PFBadge
            badge={{ badge: PFBadges.Container.badge, tt: 'Containers' }}
            style={{ marginRight: '10px' }}
            position={TooltipPosition.top}
          />
          {this.state.containers!.map((c, i) => {
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

  private toggleSelected = (c: Container) => {
    c.isSelected = !c.isSelected;
    this.setState({ containers: [...this.state.containers!] });
  };

  private getLogsDiv = () => {
    const kebabActions = [
      <DropdownItem key="toggleToolbar" onClick={this.toggleToolbar}>
        {`${this.state.showToolbar ? 'Collapse' : 'Expand'} Toolbar`}
      </DropdownItem>,
      <DropdownItem key="toggleRegex" onClick={this.toggleUseRegex}>
        {`Match via ${this.state.useRegex ? 'Substring' : 'Regex'}`}
      </DropdownItem>,
      <DropdownItem key="toggleTimestamps" onClick={this.toggleShowTimestamps}>
        {`${this.state.showTimestamps ? 'Remove' : 'Show'} Timestamps`}
      </DropdownItem>
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
                <CopyToClipboard text={this.entriesToString(this.state.filteredLogs)}>
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
                  isDisabled={!this.hasEntries(this.state.filteredLogs)}
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
            ...logsBackground(this.hasEntries(this.state.filteredLogs))
          }}
          ref={this.logsRef}
        >
          {this.hasEntries(this.state.filteredLogs)
            ? this.state.filteredLogs.map((le, i) => {
                return !le.accessLog ? (
                  <>
                    <p key={`le-${i}`} style={{ color: le.color!, fontSize: '12px' }}>
                      {this.entryToString(le)}
                    </p>
                  </>
                ) : (
                  <div key={`al-${i}`} style={{ height: '22px', lineHeight: '22px' }}>
                    {this.state.showTimestamps && (
                      <span key={`al-s-${i}`} style={{ color: le.color!, fontSize: '12px', marginRight: '5px' }}>
                        {le.timestamp}
                      </span>
                    )}
                    <Tooltip
                      key={`al-tt-${i}`}
                      position={TooltipPosition.auto}
                      entryDelay={2000}
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
                        <KialiIcon.Info key={`al-i-${i}`} className={alInfoIcon} color={PFColors.Gold400} />
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
    const containerNames = this.getContainers(pod);
    this.setState({ containers: containerNames, podValue: Number(podValue) });
  };

  private setTailLines = (tailLines: number) => {
    this.setState({ tailLines: tailLines });
  };

  private setKebabOpen = (kebabOpen: boolean) => {
    this.setState({ kebabOpen: kebabOpen });
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

  private doShowAndHide = () => {
    const filteredLogs = this.filterLogs(this.state.rawLogs, this.state.showLogValue, this.state.hideLogValue);
    this.setState({
      filteredLogs: filteredLogs,
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

  private filterLogs = (rawLogs: LogEntry[], showValue: string, hideValue: string): LogEntry[] => {
    let filteredLogs = rawLogs;

    if (!!showValue) {
      if (this.state.useRegex) {
        try {
          const regexp = RegExp(showValue);
          filteredLogs = filteredLogs.filter(le => regexp.test(le.message));
          if (!!this.state.showError) {
            this.setState({ showError: undefined });
          }
        } catch (e) {
          this.setState({ showError: `Show: ${e.message}` });
        }
      } else {
        filteredLogs = filteredLogs.filter(le => le.message.includes(showValue));
      }
    }
    if (!!hideValue) {
      if (this.state.useRegex) {
        try {
          const regexp = RegExp(hideValue);
          filteredLogs = filteredLogs.filter(le => !regexp.test(le.message));
          if (!!this.state.hideError) {
            this.setState({ hideError: undefined });
          }
        } catch (e) {
          this.setState({ hideError: `Hide: ${e.message}` });
        }
      } else {
        filteredLogs = filteredLogs.filter(le => !le.message.includes(hideValue));
      }
    }

    return filteredLogs;
  };

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
      showClearShowLogButton: false,
      filteredLogs: this.filterLogs(this.state.rawLogs, '', this.state.hideLogValue)
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

    this.setState({
      hideError: undefined,
      hideLogValue: '',
      showClearHideLogButton: false,
      filteredLogs: this.filterLogs(this.state.rawLogs, this.state.showLogValue, '')
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

  private getContainers = (pod: Pod): Container[] => {
    // sort containers by name, consistently positioning proxy container first.
    let podContainers = pod.istioContainers || [];
    podContainers.push(...(pod.containers || []));
    podContainers = podContainers.sort((c1, c2) => {
      if (c1.isProxy !== c2.isProxy) {
        return c1.isProxy ? 0 : 1;
      }
      return c1.name < c2.name ? 0 : 1;
    });
    let appContainers = 0;
    let containers = podContainers.map(c => {
      const name = c.name;
      if (c.isProxy) {
        return { color: proxyContainerColor, displayName: name, isProxy: true, isSelected: true, name: name };
      }

      const color = appContainerColors[appContainers++ % appContainerColors.length];
      return { color: color, displayName: name, isProxy: false, isSelected: true, name: name };
    });

    return containers;
  };

  private fetchLogs = (
    namespace: string,
    podName: string,
    containers: Container[],
    tailLines: number,
    timeRange: TimeRange
  ) => {
    const now = Date.now();
    const timeRangeDates = evalTimeRange(timeRange);
    const sinceTime = Math.floor(timeRangeDates[0].getTime() / 1000);
    const endTime = timeRangeDates[1].getTime();
    // to save work on the server-side, only supply duration when time range is in the past
    let duration = 0;
    if (endTime < now) {
      duration = Math.floor(timeRangeDates[1].getTime() / 1000) - sinceTime;
    }

    const selectedContainers = containers.filter(c => c.isSelected);
    const containerPromises = selectedContainers.map(c => {
      return getPodLogs(namespace, podName, c.name, tailLines, sinceTime, duration, c.isProxy);
    });

    this.promises
      .registerAll('logs', containerPromises)
      .then(responses => {
        let rawLogs: LogEntry[] = [];

        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];
          const containerRawLogs = response.data.entries as LogEntry[];
          if (!containerRawLogs) {
            continue;
          }
          const color = selectedContainers[i].color;
          containerRawLogs.forEach(le => (le.color = color));
          rawLogs.push(...containerRawLogs);
        }

        const filteredLogs = this.filterLogs(rawLogs, this.state.showLogValue, this.state.hideLogValue);
        const sortedFilteredLogs = filteredLogs.sort((a, b) => {
          return a.timestampUnix - b.timestampUnix;
        });

        this.setState({
          loadingLogs: false,
          rawLogs: rawLogs,
          filteredLogs: sortedFilteredLogs
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
        this.setState({
          loadingLogs: false,
          rawLogs: [
            {
              severity: 'Error',
              timestamp: Date.toString(),
              timestampUnix: Date.now(),
              message: `Failed to fetch app logs: ${errorMsg}`
            }
          ]
        });
      });

    this.setState({
      loadingLogs: true,
      rawLogs: []
    });
  };

  private entriesToString = (entries: LogEntry[]): string => {
    return entries.map(le => this.entryToString(le)).join('\n');
  };

  private entryToString = (le: LogEntry): string => {
    return this.state.showTimestamps ? `${le.timestamp} ${le.message}` : le.message;
  };

  private hasEntries = (entries: LogEntry[]): boolean => !!entries && entries.length > 0;
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    timeRange: timeRangeSelector(state),
    lastRefreshAt: state.globalState.lastRefreshAt
  };
};

const WorkloadPodLogsContainer = connect(mapStateToProps)(WorkloadPodLogs);
export default WorkloadPodLogsContainer;
