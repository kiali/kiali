import * as React from 'react';
import { Button, Icon, Toolbar } from 'patternfly-react';
import { style } from 'typestyle';
import { Pod, PodLogs } from '../../../types/IstioObjects';
import { getPodLogs, Response } from '../../../services/Api';
import { CancelablePromise, makeCancelablePromise } from '../../../utils/CancelablePromises';
import { ToolbarDropdown } from '../../../components/ToolbarDropdown/ToolbarDropdown';
import { DurationInSeconds } from '../../../types/Common';

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
  duration: string; // DurationInSeconds
  loadingPodLogs: boolean;
  loadingPodLogsError?: string;
  podValue?: number;
  podLogs?: PodLogs;
}

const DurationDefault = '300';
const DurationOptions = {
  '60': 'Last 1m',
  '300': 'Last 5m',
  '600': 'Last 10m',
  '1800': 'Last 30m',
  '3600': 'Last 1h',
  '10800': 'Last 3h',
  '21600': 'Last 6h',
  '43200': 'Last 12h',
  '86400': 'Last 1d',
  '604800': 'Last 7d'
};

const logsTextarea = style({
  width: '100%',
  height: '100%',
  overflow: 'auto',
  resize: 'vertical',
  color: '#fff',
  backgroundColor: '#003145'
});

const leftPaddedSpan = style({
  paddingLeft: '0.5em'
});

export default class WorkloadPodLogs extends React.Component<WorkloadPodLogsProps, WorkloadPodLogsState> {
  private loadPodLogsPromise?: CancelablePromise<Response<PodLogs>[]>;
  private podOptions: object = {};

  constructor(props: WorkloadPodLogsProps) {
    super(props);

    if (this.props.pods.length < 1) {
      this.state = {
        duration: DurationDefault,
        loadingPodLogs: false,
        loadingPodLogsError: 'There are no logs to display because no pods are available.'
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
      duration: DurationDefault,
      loadingPodLogs: false,
      podValue: podValue
    };
  }

  componentDidMount() {
    if (this.state.containerInfo) {
      const pod = this.props.pods[this.state.podValue!];
      this.fetchLogs(this.props.namespace, pod.name, this.state.containerInfo.container, Number(this.state.duration));
    }
  }

  componentDidUpdate(prevProps: WorkloadPodLogsProps, prevState: WorkloadPodLogsState) {
    const prevContainer = prevState.containerInfo ? prevState.containerInfo.container : undefined;
    const newContainer = this.state.containerInfo ? this.state.containerInfo.container : undefined;
    const updateContainer = newContainer && newContainer !== prevContainer;
    const updateDuration = this.state.duration && prevState.duration !== this.state.duration;
    if (updateContainer || updateDuration) {
      const pod = this.props.pods[this.state.podValue!];
      this.fetchLogs(this.props.namespace, pod.name, newContainer!, Number(this.state.duration));
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
                  id={'wpl_duration'}
                  handleSelect={key => this.setDuration(key)}
                  value={this.state.duration}
                  label={DurationOptions[this.state.duration]}
                  options={DurationOptions}
                  tooltip={'Time range for graph data'}
                />
                <span className={leftPaddedSpan}>
                  <Button id={'wpl_refresh'} disabled={!this.state.podLogs} onClick={() => this.handleRefresh()}>
                    <Icon name="refresh" />
                  </Button>
                </span>
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

  private setDuration = (duration: string) => {
    this.setState({ duration: duration });
  };

  private handleRefresh = () => {
    const pod = this.props.pods[this.state.podValue!];
    this.fetchLogs(this.props.namespace, pod.name, this.state.containerInfo!.container, Number(this.state.duration));
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

  private fetchLogs = (namespace: string, podName: string, container: string, duration: DurationInSeconds) => {
    const sinceTime = Math.floor(Date.now() / 1000) - duration;
    const promise: Promise<Response<PodLogs>> = getPodLogs(namespace, podName, container, sinceTime);
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
