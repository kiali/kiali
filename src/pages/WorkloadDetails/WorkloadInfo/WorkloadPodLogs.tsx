import * as React from 'react';
import { Toolbar } from 'patternfly-react';
import { style } from 'typestyle';
import { Pod, PodLogs } from '../../../types/IstioObjects';
import { getPodLogs, Response } from '../../../services/Api';
import { CancelablePromise, makeCancelablePromise } from '../../../utils/CancelablePromises';
import { ToolbarDropdown } from '../../../components/ToolbarDropdown/ToolbarDropdown';
import { DurationInSeconds } from '../../../types/Common';
import MetricsDurationContainer from '../../../components/MetricsOptions/MetricsDuration';
import MetricsDuration from '../../../components/MetricsOptions/MetricsDuration';
import RefreshButtonContainer from '../../../components/Refresh/RefreshButton';

export interface WorkloadPodLogsProps {
  namespace: string;
  pods: Pod[];
}

interface ContainerInfo {
  container: string;
  containerOptions: object;
}

interface WorkloadPodLogsState {
  containerInfo?: ContainerInfo;
  duration: DurationInSeconds;
  loadingPodLogs: boolean;
  loadingPodLogsError?: string;
  podValue?: number;
  podLogs?: PodLogs;
  tailLines: number;
}

const TailLinesDefault = 500;
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

const logsTextarea = style({
  width: '100%',
  // 75px is the height of the toolbar inside "Logs" tab
  height: 'calc(var(--kiali-details-pages-tab-content-height) - 75px)',
  overflow: 'auto',
  resize: 'vertical',
  color: '#fff',
  backgroundColor: '#003145',
  fontFamily: 'monospace',
  fontSize: '11pt'
});

export default class WorkloadPodLogs extends React.Component<WorkloadPodLogsProps, WorkloadPodLogsState> {
  private loadPodLogsPromise?: CancelablePromise<Response<PodLogs>[]>;
  private podOptions: object = {};

  constructor(props: WorkloadPodLogsProps) {
    super(props);

    if (this.props.pods.length < 1) {
      this.state = {
        duration: MetricsDuration.initialDuration(),
        loadingPodLogs: false,
        loadingPodLogsError: 'There are no logs to display because no pods are available.',
        tailLines: TailLinesDefault
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
      duration: MetricsDuration.initialDuration(),
      loadingPodLogs: false,
      podValue: podValue,
      tailLines: TailLinesDefault
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
  }

  render() {
    return (
      <>
        {this.state.containerInfo && (
          <>
            <Toolbar>
              <ToolbarDropdown
                id={'wpl_pods'}
                nameDropdown="Pod"
                tooltip="Display logs for the selected pod"
                handleSelect={key => this.setPod(key)}
                value={this.state.podValue}
                label={this.props.pods[this.state.podValue!].name}
                options={this.podOptions!}
              />
              <ToolbarDropdown
                id={'wpl_containers'}
                nameDropdown="&nbsp;&nbsp;&nbsp;Container"
                tooltip="Display logs for the selected pod container"
                handleSelect={key => this.setContainer(key)}
                value={this.state.containerInfo.container}
                label={this.state.containerInfo.container}
                options={this.state.containerInfo.containerOptions!}
              />
              <Toolbar.RightContent>
                <ToolbarDropdown
                  id={'wpl_tailLines'}
                  nameDropdown="Tail"
                  handleSelect={key => this.setTailLines(Number(key))}
                  value={this.state.tailLines}
                  label={TailLinesOptions[this.state.tailLines]}
                  options={TailLinesOptions}
                  tooltip={'Show up to last N log lines'}
                />
                {'   '}
                <MetricsDurationContainer tooltip="Time range for log messages" onChanged={this.setDuration} />
                {'  '}
                <RefreshButtonContainer
                  id={'wpl_refresh'}
                  disabled={!this.state.podLogs}
                  handleRefresh={this.handleRefresh}
                />
              </Toolbar.RightContent>
            </Toolbar>
            <textarea
              className={logsTextarea}
              readOnly={true}
              value={this.state.podLogs ? this.state.podLogs.logs : 'Loading logs...'}
            />
          </>
        )}
        {this.state.loadingPodLogsError && <div>{this.state.loadingPodLogsError}</div>}
      </>
    );
  }

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

  private setDuration = (duration: DurationInSeconds) => {
    this.setState({ duration: duration });
  };

  private setTailLines = (tailLines: number) => {
    this.setState({ tailLines: tailLines });
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

  private getContainerInfo = (pod: Pod): ContainerInfo => {
    const containers = pod.containers ? pod.containers : [];
    containers.push(...(pod.istioContainers ? pod.istioContainers : []));
    const containerNames: string[] = containers.map(c => c.name);
    const options: object = {};
    containerNames.forEach(c => {
      options[c] = c;
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
    const promise: Promise<Response<PodLogs>> = getPodLogs(namespace, podName, container, tailLines, sinceTime);
    this.loadPodLogsPromise = makeCancelablePromise(Promise.all([promise]));
    this.loadPodLogsPromise.promise
      .then(response => {
        const podLogs = response[0].data;
        this.setState({
          loadingPodLogs: false,
          podLogs: podLogs.logs ? podLogs : { logs: 'No logs found for the time period.' }
        });
        return;
      })
      .catch(error => {
        if (error.isCanceled) {
          console.debug('PodLogs: Ignore fetch error (canceled).');
          this.setState({ loadingPodLogs: false });
          return;
        }
        const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
        this.setState({
          loadingPodLogs: false,
          podLogs: { logs: `Failed to fetch pod logs: ${errorMsg}` }
        });
      });

    this.setState({
      loadingPodLogs: true,
      podLogs: undefined
    });
  };
}
