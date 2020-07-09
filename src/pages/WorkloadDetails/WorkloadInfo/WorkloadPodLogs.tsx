import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Card,
  CardBody,
  Grid,
  GridItem,
  Switch,
  TextInput,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Tooltip
} from '@patternfly/react-core';
import { style } from 'typestyle';
import { Pod, PodLogs } from '../../../types/IstioObjects';
import { getPodLogs, Response } from '../../../services/Api';
import { CancelablePromise, makeCancelablePromise } from '../../../utils/CancelablePromises';
import { ToolbarDropdown } from '../../../components/ToolbarDropdown/ToolbarDropdown';
import { DurationInSeconds, TimeRange } from '../../../types/Common';
import { RenderComponentScroll } from '../../../components/Nav/Page';
import { retrieveDuration } from 'components/Time/TimeRangeHelper';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import TimeRangeComponent from 'components/Time/TimeRangeComponent';
import Splitter from 'm-react-splitters';
import RefreshContainer from '../../../components/Refresh/Refresh';
import { KialiIcon } from '../../../config/KialiIcon';
import * as AlertUtils from '../../../utils/AlertUtils';

export interface WorkloadPodLogsProps {
  namespace: string;
  pods: Pod[];
}

interface ContainerInfo {
  container: string;
  containerOptions: string[];
}

type LogLines = string[];

type TextAreaPosition = 'left' | 'right' | 'top' | 'bottom';

interface WorkloadPodLogsState {
  containerInfo?: ContainerInfo;
  duration: DurationInSeconds;
  filteredAppLogs?: LogLines;
  filteredProxyLogs?: LogLines;
  hideLogValue: string;
  isLogWindowSelectExpanded: boolean;
  loadingAppLogs: boolean;
  loadingAppLogsError?: string;
  loadingProxyLogs: boolean;
  loadingProxyLogsError?: string;
  logWindowSelections: any[];
  podValue?: number;
  rawAppLogs?: LogLines;
  rawProxyLogs?: LogLines;
  showClearHideLogButton: boolean;
  showClearShowLogButton: boolean;
  showLogValue: string;
  sideBySideOrientation: boolean;
  tailLines: number;
  useRegex: boolean;
}

const RETURN_KEY_CODE = 13;
const NoAppLogsFoundMessage = 'No application container logs found for the time period.';
const NoProxyLogsFoundMessage = 'No istio-proxy for the pod, or proxy logs for the time period.';

const TailLinesDefault = 500;
const TailLinesOptions = {
  '-1': 'All lines',
  '10': 'Last 10 lines',
  '50': 'Last 50 lines',
  '100': 'Last 100 lines',
  '300': 'Last 300 lines',
  '500': 'Last 500 lines',
  '1000': 'Last 1000 lines',
  '5000': 'Last 5000 lines'
};

const appLogsDivHorizontal = style({
  height: '100%',
  marginRight: '5px'
});

const appLogsDivVertical = style({
  height: 'calc(100% + 3px)'
});

const displayFlex = style({
  display: 'flex'
});

const infoIcons = style({
  marginLeft: '0.5em',
  width: '24px'
});

const logsTitle = style({
  fontWeight: 'bold'
});

const proxyLogsDiv = style({
  height: '100%'
});

const splitter = style({
  height: 'calc(100% - 80px)' // 80px compensates for toolbar height
});

const toolbar = style({
  margin: '0 0 10px 0'
});

const toolbarRight = style({
  marginLeft: 'auto'
});

const toolbarTail = style({
  marginTop: '2px'
});

const toolbarTitle = (position: TextAreaPosition = 'top') =>
  style({
    margin: `${position === 'right' ? '0 0 0 10px' : 0}`
  });

const logTextAreaBackground = (enabled = true) => ({ backgroundColor: enabled ? '#003145' : 'gray' });

const logsTextarea = (enabled = true, position: TextAreaPosition = 'top', hasTitle = true) =>
  style(logTextAreaBackground(enabled), {
    width: `${['top', 'bottom'].includes(position) ? '100%' : 'calc(100% - 10px)'}`,
    height: `calc(100% - ${position === 'top' ? '20px' : '0px'} - ${hasTitle ? '36px' : '0px'})`,
    overflow: 'auto',
    resize: 'none',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '11pt',
    margin: `${position === 'right' ? '0 0 0 10px' : 0}`,
    padding: '10px',
    whiteSpace: 'pre'
  });

export default class WorkloadPodLogs extends React.Component<WorkloadPodLogsProps, WorkloadPodLogsState> {
  private loadProxyLogsPromise?: CancelablePromise<Response<PodLogs>[]>;
  private loadAppLogsPromise?: CancelablePromise<Response<PodLogs>[]>;
  private readonly appLogsRef: any;
  private readonly proxyLogsRef: any;
  private podOptions: string[] = [];

  constructor(props: WorkloadPodLogsProps) {
    super(props);
    this.appLogsRef = React.createRef();
    this.proxyLogsRef = React.createRef();

    if (this.props.pods.length < 1) {
      this.state = {
        duration: retrieveDuration() || 600,
        hideLogValue: '',
        isLogWindowSelectExpanded: false,
        loadingAppLogs: false,
        loadingAppLogsError: 'There are no logs to display because no pods are available.',
        loadingProxyLogs: false,
        loadingProxyLogsError: 'There are no logs to display because no container logs are available.',
        logWindowSelections: [],
        sideBySideOrientation: false,
        showClearHideLogButton: false,
        showClearShowLogButton: false,
        showLogValue: '',
        tailLines: TailLinesDefault,
        useRegex: false
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
    const containerInfo = this.getContainerInfo(pod);

    this.state = {
      containerInfo: containerInfo,
      duration: retrieveDuration() || 600,
      hideLogValue: '',
      isLogWindowSelectExpanded: false,
      loadingAppLogs: false,
      loadingProxyLogs: false,
      logWindowSelections: [],
      podValue: podValue,
      showClearHideLogButton: false,
      showClearShowLogButton: false,
      showLogValue: '',
      sideBySideOrientation: false,
      tailLines: TailLinesDefault,
      useRegex: false
    };
  }

  componentDidMount() {
    if (this.state.containerInfo) {
      const pod = this.props.pods[this.state.podValue!];
      this.fetchLogs(
        this.props.namespace,
        pod.name,
        this.state.containerInfo.container,
        this.state.tailLines,
        this.state.duration
      );
    }
  }

  componentDidUpdate(_prevProps: WorkloadPodLogsProps, prevState: WorkloadPodLogsState) {
    const prevContainer = prevState.containerInfo ? prevState.containerInfo.container : undefined;
    const newContainer = this.state.containerInfo ? this.state.containerInfo.container : undefined;
    const updateContainerInfo = this.state.containerInfo && this.state.containerInfo !== prevState.containerInfo;
    const updateContainer = newContainer && newContainer !== prevContainer;
    const updateDuration = this.state.duration && prevState.duration !== this.state.duration;
    const updateTailLines = this.state.tailLines && prevState.tailLines !== this.state.tailLines;
    if (updateContainerInfo || updateContainer || updateDuration || updateTailLines) {
      const pod = this.props.pods[this.state.podValue!];
      this.fetchLogs(this.props.namespace, pod.name, newContainer!, this.state.tailLines, this.state.duration);
    }
    this.proxyLogsRef.current.scrollTop = this.proxyLogsRef.current.scrollHeight;
    this.appLogsRef.current.scrollTop = this.appLogsRef.current.scrollHeight;

    if (prevState.useRegex !== this.state.useRegex) {
      this.doShowAndHide();
    }
  }

  renderItem = object => {
    return <ToolbarItem className={displayFlex}>{object}</ToolbarItem>;
  };

  render() {
    return (
      <RenderComponentScroll key={this.state.sideBySideOrientation ? 'vertical' : 'horizontal'}>
        {this.state.containerInfo && (
          <Grid style={{ padding: '10px 10px 0 10px', height: '100%' }}>
            <GridItem span={12}>
              <Card style={{ height: '100%' }}>
                <CardBody>
                  <Toolbar className={toolbar}>
                    <ToolbarGroup>
                      <ToolbarItem className={displayFlex}>
                        <ToolbarDropdown
                          id={'wpl_pods'}
                          nameDropdown="Pod"
                          tooltip="Display logs for the selected pod"
                          handleSelect={key => this.setPod(key)}
                          value={this.state.podValue}
                          label={this.props.pods[this.state.podValue!].name}
                          options={this.podOptions!}
                        />
                      </ToolbarItem>
                      <ToolbarItem className={displayFlex} style={{ marginLeft: '1em' }}>
                        <ToolbarDropdown
                          id={'wpl_containers'}
                          nameDropdown="Container"
                          tooltip="Choose container for selected pod"
                          handleSelect={key => this.setContainer(key)}
                          value={this.state.containerInfo.container}
                          label={this.state.containerInfo.container}
                          options={this.state.containerInfo.containerOptions!}
                        />
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
                      <ToolbarItem>
                        <TimeRangeComponent
                          tooltip="Time range for log messages"
                          onChanged={this.setTimeRange}
                          allowCustom={false}
                        />
                      </ToolbarItem>
                      <ToolbarItem>
                        <RefreshContainer
                          id="workload_logging_refresh"
                          hideLabel={true}
                          disabled={!this.state.rawAppLogs}
                          handleRefresh={this.handleRefresh}
                        />
                      </ToolbarItem>
                    </ToolbarGroup>
                  </Toolbar>
                  <Toolbar className={toolbar}>
                    <ToolbarGroup>
                      <ToolbarItem>
                        <Switch
                          id="orientation-switch"
                          label="Side by Side"
                          isChecked={this.state.sideBySideOrientation}
                          onChange={this.handleOrientationChange}
                        />
                      </ToolbarItem>
                    </ToolbarGroup>
                    <ToolbarGroup className={toolbarRight}>
                      <ToolbarItem>
                        <TextInput
                          id="log_show"
                          name="log_show"
                          style={{ width: '10em' }}
                          autoComplete="on"
                          type="text"
                          onKeyPress={this.checkSubmitShow}
                          onChange={this.updateShow}
                          defaultValue={this.state.showLogValue}
                          aria-label="show log text"
                          placeholder="Show..."
                        />
                      </ToolbarItem>
                      <ToolbarItem>
                        {this.state.showClearShowLogButton && (
                          <Tooltip key="clear_show_log" position="top" content="Clear Show Log Entries...">
                            <Button variant={ButtonVariant.control} onClick={this.clearShow}>
                              <KialiIcon.Close />
                            </Button>
                          </Tooltip>
                        )}
                      </ToolbarItem>
                      <ToolbarItem>
                        <TextInput
                          id="log_hide"
                          name="log_hide"
                          style={{ width: '10em' }}
                          autoComplete="on"
                          type="text"
                          onKeyPress={this.checkSubmitHide}
                          onChange={this.updateHide}
                          defaultValue={this.state.hideLogValue}
                          aria-label="hide log text"
                          placeholder="Hide..."
                        />
                      </ToolbarItem>
                      <ToolbarItem>
                        {this.state.showClearHideLogButton && (
                          <Tooltip key="clear_hide_log" position="top" content="Clear Hide Log Entries...">
                            <Button variant={ButtonVariant.control} onClick={this.clearHide}>
                              <KialiIcon.Close />
                            </Button>
                          </Tooltip>
                        )}
                      </ToolbarItem>
                      <ToolbarItem>
                        <Tooltip
                          key="show_hide_log_help"
                          position="top"
                          content="Show only lines containing a substring. Hide all lines containing a substring. Case sensitive."
                        >
                          <KialiIcon.Info className={infoIcons} />
                        </Tooltip>
                      </ToolbarItem>
                      <ToolbarItem style={{ marginLeft: '1em' }}>
                        <Switch
                          id="regex-switch"
                          label="Activate Regex"
                          isChecked={this.state.useRegex}
                          onChange={this.handleRegexChange}
                        />
                        <Tooltip
                          key="show_log_regex_help"
                          position="top"
                          content="Use Regex instead of substring for more advanced use"
                        >
                          <KialiIcon.Info className={infoIcons} />
                        </Tooltip>
                      </ToolbarItem>
                    </ToolbarGroup>
                  </Toolbar>
                  <div className={splitter}>{this.getSplitter()}</div>
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        )}
        {this.state.loadingAppLogsError && <div>{this.state.loadingAppLogsError}</div>}
      </RenderComponentScroll>
    );
  }

  private getSplitter = () => {
    return this.state.sideBySideOrientation ? (
      <Splitter
        position="vertical"
        primaryPaneMaxWidth="80%"
        primaryPaneMinWidth="15%"
        primaryPaneWidth="50%"
        dispatchResize={true}
        postPoned={true}
      >
        {this.getAppDiv()}
        {this.getProxyDiv()}
      </Splitter>
    ) : (
      <Splitter
        position="horizontal"
        primaryPaneMaxHeight="80%"
        primaryPaneMinHeight="15%"
        primaryPaneHeight="50%"
        dispatchResize={true}
        postPoned={true}
      >
        {this.getAppDiv()}
        {this.getProxyDiv()}
      </Splitter>
    );
  };

  private getAppDiv = () => {
    const appLogsEnabled = !!this.state.filteredAppLogs;
    const appLogs = appLogsEnabled ? WorkloadPodLogs.linesToString(this.state.filteredAppLogs) : NoAppLogsFoundMessage;
    return (
      <div className={this.state.sideBySideOrientation ? appLogsDivHorizontal : appLogsDivVertical}>
        <Toolbar className={toolbarTitle()}>
          <ToolbarItem className={logsTitle}>
            {this.state.containerInfo!.containerOptions[this.state.containerInfo!.container]}
          </ToolbarItem>
          <ToolbarGroup className={toolbarRight}>
            <ToolbarItem>
              <Tooltip key="copy_app_logs" position="top" content="Copy app logs to clipboard">
                <CopyToClipboard
                  onCopy={this.copyAppLogCallback}
                  text={WorkloadPodLogs.linesToString(this.state.filteredAppLogs)}
                >
                  <Button variant={ButtonVariant.plain}>
                    <KialiIcon.Copy />
                  </Button>
                </CopyToClipboard>
              </Tooltip>
            </ToolbarItem>
          </ToolbarGroup>
        </Toolbar>

        <textarea
          className={logsTextarea(appLogsEnabled, this.state.sideBySideOrientation ? 'left' : 'top')}
          ref={this.appLogsRef}
          readOnly={true}
          value={appLogs}
        />
      </div>
    );
  };

  private getProxyDiv = () => {
    const proxyLogsEnabled = !!this.state.filteredProxyLogs;
    const proxyLogs = proxyLogsEnabled
      ? WorkloadPodLogs.linesToString(this.state.filteredProxyLogs)
      : NoProxyLogsFoundMessage;
    return (
      <div className={proxyLogsDiv}>
        <Toolbar className={toolbarTitle(this.state.sideBySideOrientation ? 'right' : 'bottom')}>
          <ToolbarItem className={logsTitle}>Istio proxy (sidecar)</ToolbarItem>
          <ToolbarGroup className={toolbarRight}>
            <ToolbarItem>
              <Tooltip key="copy_proxy_logs" position="top" content="Copy Istio proxy logs to clipboard">
                <CopyToClipboard
                  onCopy={this.copyProxyLogCallback}
                  text={WorkloadPodLogs.linesToString(this.state.filteredProxyLogs)}
                >
                  <Button variant={ButtonVariant.plain}>
                    <KialiIcon.Copy />
                  </Button>
                </CopyToClipboard>
              </Tooltip>
            </ToolbarItem>
          </ToolbarGroup>
        </Toolbar>
        <textarea
          className={logsTextarea(proxyLogsEnabled, this.state.sideBySideOrientation ? 'right' : 'bottom')}
          ref={this.proxyLogsRef}
          readOnly={true}
          value={proxyLogs}
        />
      </div>
    );
  };

  private setPod = (podValue: string) => {
    const pod = this.props.pods[Number(podValue)];
    const containerInfo = this.getContainerInfo(pod);
    this.setState({ containerInfo: containerInfo, podValue: Number(podValue) });
  };

  private setContainer = (container: string) => {
    this.setState({
      containerInfo: { container: container, containerOptions: this.state.containerInfo!.containerOptions }
    });
  };

  private setTimeRange = (range: TimeRange) => {
    this.setState({ duration: range as DurationInSeconds });
  };

  private setTailLines = (tailLines: number) => {
    this.setState({ tailLines: tailLines });
  };

  private handleOrientationChange = (isChecked: boolean) => {
    this.setState({ sideBySideOrientation: isChecked });
  };

  private handleRegexChange = () => {
    this.setState({
      useRegex: !this.state.useRegex
    });
  };

  private handleRefresh = () => {
    const pod = this.props.pods[this.state.podValue!];
    this.fetchLogs(
      this.props.namespace,
      pod.name,
      this.state.containerInfo!.container,
      this.state.tailLines,
      this.state.duration
    );
  };

  private doShowAndHide = () => {
    const rawAppLogs = !!this.state.rawAppLogs ? this.state.rawAppLogs : ([] as LogLines);
    const rawProxyLogs = !!this.state.rawProxyLogs ? this.state.rawProxyLogs : ([] as LogLines);
    const filteredAppLogs = this.filterLogs(rawAppLogs, this.state.showLogValue, this.state.hideLogValue);
    const filteredProxyLogs = this.filterLogs(rawProxyLogs, this.state.showLogValue, this.state.hideLogValue);
    this.setState({
      filteredAppLogs: filteredAppLogs,
      filteredProxyLogs: filteredProxyLogs,
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

  private filterLogs = (rawLogs: LogLines, showValue: string, hideValue: string): LogLines => {
    let filteredLogs = rawLogs;

    if (!!showValue) {
      if (this.state.useRegex) {
        try {
          const regexp = new RegExp(showValue);
          filteredLogs = filteredLogs.filter(l => regexp.test(l));
        } catch (e) {
          AlertUtils.addError(`Failed log Show: ${e.message}`);
        }
      } else {
        filteredLogs = filteredLogs.filter(l => l.includes(showValue));
      }
    }
    if (!!hideValue) {
      if (this.state.useRegex) {
        try {
          const regexp = new RegExp(hideValue);
          filteredLogs = filteredLogs.filter(l => !regexp.test(l));
        } catch (e) {
          AlertUtils.addError(`Failed log Hide: ${e.message}`);
        }
      } else {
        filteredLogs = filteredLogs.filter(l => !l.includes(hideValue));
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

    const rawAppLogs = this.state.rawAppLogs ? this.state.rawAppLogs : ([] as LogLines);
    const rawProxyLogs = this.state.rawProxyLogs ? this.state.rawProxyLogs : ([] as LogLines);
    this.setState({
      showLogValue: '',
      showClearShowLogButton: false,
      filteredAppLogs: this.filterLogs(rawAppLogs, '', this.state.hideLogValue),
      filteredProxyLogs: this.filterLogs(rawProxyLogs, '', this.state.hideLogValue)
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

    const rawAppLogs = this.state.rawAppLogs ? this.state.rawAppLogs : ([] as LogLines);
    const rawProxyLogs = this.state.rawProxyLogs ? this.state.rawProxyLogs : ([] as LogLines);
    this.setState({
      hideLogValue: '',
      showClearHideLogButton: false,
      filteredAppLogs: this.filterLogs(rawAppLogs, this.state.showLogValue, ''),
      filteredProxyLogs: this.filterLogs(rawProxyLogs, this.state.showLogValue, '')
    });
  };

  private copyAppLogCallback = (_text: string, _result: boolean) => {
    this.appLogsRef.current.select();
  };

  private copyProxyLogCallback = (_text: string, _result: boolean) => {
    this.proxyLogsRef.current.select();
  };

  private getContainerInfo = (pod: Pod): ContainerInfo => {
    const containers = pod.containers ? pod.containers : [];
    containers.push(...(pod.istioContainers ? pod.istioContainers : []));
    const containerNames: string[] = containers.map(c => c.name);
    const options: string[] = [];

    containerNames.forEach(c => {
      // ignore the proxy
      if (c !== 'istio-proxy') {
        if (pod.appLabel && pod.labels) {
          options[c] = c + '-' + pod.labels['version'];
        } else {
          options[c] = c;
        }
      }
    });
    return { container: containerNames[0], containerOptions: options };
  };

  private fetchLogs = (
    namespace: string,
    podName: string,
    container: string,
    tailLines: number,
    duration: DurationInSeconds
  ) => {
    const sinceTime = Math.floor(Date.now() / 1000) - duration;
    const appPromise: Promise<Response<PodLogs>> = getPodLogs(namespace, podName, container, tailLines, sinceTime);
    const proxyPromise: Promise<Response<PodLogs>> = getPodLogs(
      namespace,
      podName,
      'istio-proxy',
      tailLines,
      sinceTime
    );
    this.loadAppLogsPromise = makeCancelablePromise(Promise.all([appPromise]));
    this.loadProxyLogsPromise = makeCancelablePromise(Promise.all([proxyPromise]));

    this.loadAppLogsPromise.promise
      .then(response => {
        const rawAppLogs = WorkloadPodLogs.stringToLines(response[0].data.logs as string, tailLines);
        const filteredAppLogs = this.filterLogs(rawAppLogs, this.state.showLogValue, this.state.hideLogValue);

        this.setState({
          loadingAppLogs: false,
          rawAppLogs: rawAppLogs,
          filteredAppLogs: filteredAppLogs
        });
        this.appLogsRef.current.scrollTop = this.appLogsRef.current.scrollHeight;
        return;
      })
      .catch(error => {
        if (error.isCanceled) {
          console.debug('AppLogs: Ignore fetch error (canceled).');
          this.setState({ loadingAppLogs: false });
          return;
        }
        const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
        this.setState({
          loadingAppLogs: false,
          rawAppLogs: [`Failed to fetch app logs: ${errorMsg}`]
        });
      });

    this.loadProxyLogsPromise.promise
      .then(response => {
        const rawProxyLogs = WorkloadPodLogs.stringToLines(response[0].data.logs as string, tailLines);
        const filteredProxyLogs = this.filterLogs(rawProxyLogs, this.state.showLogValue, this.state.hideLogValue);

        this.setState({
          loadingProxyLogs: false,
          rawProxyLogs: rawProxyLogs,
          filteredProxyLogs: filteredProxyLogs
        });
        this.proxyLogsRef.current.scrollTop = this.proxyLogsRef.current.scrollHeight;
        return;
      })
      .catch(error => {
        if (error.isCanceled) {
          console.debug('ProxyLogs: Ignore fetch error (canceled).');
          this.setState({ loadingProxyLogs: false });
          return;
        }
        const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
        this.setState({
          loadingProxyLogs: false,
          rawProxyLogs: [`Failed to fetch proxy logs: ${errorMsg}`]
        });
      });

    this.setState({
      loadingAppLogs: true,
      loadingProxyLogs: true,
      rawAppLogs: undefined,
      rawProxyLogs: undefined
    });
  };

  private static stringToLines = (logs: string, maxLines: number): LogLines => {
    let logLines = logs.split('\n');
    const rawLines = logLines.length;
    logLines = logLines.filter((_l, i) => rawLines - i <= maxLines);
    return logLines;
  };

  private static linesToString = (logLines?: LogLines): string => {
    return !logLines?.length ? '' : logLines.join('\n');
  };
}
