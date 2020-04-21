import * as React from 'react';
import { Card, CardBody, Grid, GridItem, Title, Toolbar, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { style } from 'typestyle';
import { Pod, PodLogs } from '../../../types/IstioObjects';
import { getPodLogs, Response } from '../../../services/Api';
import { CancelablePromise, makeCancelablePromise } from '../../../utils/CancelablePromises';
import { ToolbarDropdown } from '../../../components/ToolbarDropdown/ToolbarDropdown';
import { DurationInSeconds, TimeRange } from '../../../types/Common';
import RefreshButtonContainer from '../../../components/Refresh/RefreshButton';
import { RenderComponentScroll } from '../../../components/Nav/Page';
import { retrieveDuration } from 'components/Time/TimeRangeHelper';
import TimeRangeComponent from 'components/Time/TimeRangeComponent';
import Splitter from 'm-react-splitters';

export interface WorkloadPodLogsProps {
  namespace: string;
  pods: Pod[];
}

interface ContainerInfo {
  container: string;
}

interface WorkloadPodLogsState {
  containerInfo?: ContainerInfo;
  duration: DurationInSeconds;
  loadingPodLogs: boolean;
  loadingContainerLogs: boolean;
  loadingPodLogsError?: string;
  loadingContainerLogsError?: string;
  podValue?: number;
  podLogs?: PodLogs;
  containerLogs?: PodLogs;
  tailLines: number;
}

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

const appLogsDiv = style({
  height: 'calc(100% + 30px)'
});

const proxyLogsDiv = style({
  height: '100%'
});

const logsTextarea = style({
  width: '100%',
  height: 'calc(100% - 70px)',
  overflow: 'auto',
  resize: 'none',
  color: '#fff',
  backgroundColor: '#003145',
  fontFamily: 'monospace',
  fontSize: '11pt',
  padding: '10px'
});

const toolbarRight = style({
  right: '50px',
  position: 'absolute'
});

const displayFlex = style({
  display: 'flex'
});

const toolbarMargin = style({
  margin: '10px'
});

const tailToolbarMargin = style({
  marginTop: '2px'
});

export default class WorkloadPodLogs extends React.Component<WorkloadPodLogsProps, WorkloadPodLogsState> {
  private loadPodLogsPromise?: CancelablePromise<Response<PodLogs>[]>;
  private loadContainerLogsPromise?: CancelablePromise<Response<PodLogs>[]>;
  private podOptions: object = {};

  constructor(props: WorkloadPodLogsProps) {
    super(props);

    if (this.props.pods.length < 1) {
      this.state = {
        duration: retrieveDuration() || 600,
        loadingPodLogs: false,
        loadingContainerLogs: false,
        loadingPodLogsError: 'There are no logs to display because no pods are available.',
        loadingContainerLogsError: 'There are no logs to display because no container logs are available.',
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
      duration: retrieveDuration() || 600,
      loadingPodLogs: false,
      loadingContainerLogs: false,
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

  renderItem = object => {
    return <ToolbarItem className={displayFlex}>{object}</ToolbarItem>;
  };

  render() {
    return (
      <RenderComponentScroll>
        {this.state.containerInfo && (
          <Grid style={{ padding: '20px', height: '100%' }}>
            <GridItem span={12}>
              <Card style={{ height: '100%' }}>
                <CardBody>
                  <Toolbar className={toolbarMargin}>
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
                          classNameSelect={tailToolbarMargin}
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
                        <RefreshButtonContainer disabled={!this.state.podLogs} handleRefresh={this.handleRefresh} />
                      </ToolbarItem>
                    </ToolbarGroup>
                  </Toolbar>
                  <Splitter
                    position="horizontal"
                    primaryPaneMaxHeight="100%"
                    primaryPaneMinHeight={0}
                    primaryPaneHeight="50%"
                    dispatchResize={true}
                    postPoned={true}
                  >
                    <div className={appLogsDiv}>
                      <Title size="lg" headingLevel="h5">
                        {this.formatAppLogLabel(this.props.pods[this.state.podValue!])} Logs
                      </Title>
                      <textarea
                        className={logsTextarea}
                        readOnly={true}
                        value={this.state.podLogs ? this.state.podLogs.logs : 'Loading logs...'}
                        aria-label="Pod logs text"
                      />
                    </div>
                    <div className={proxyLogsDiv}>
                      <Title size="lg" headingLevel="h5">
                        Proxy Logs
                      </Title>
                      <textarea
                        className={logsTextarea}
                        readOnly={true}
                        value={this.state.containerLogs ? this.state.containerLogs.logs : 'Loading container logs...'}
                        aria-label="Container logs text"
                      />
                    </div>
                  </Splitter>
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        )}
        {this.state.loadingPodLogsError && <div>{this.state.loadingPodLogsError}</div>}
      </RenderComponentScroll>
    );
  }

  private setPod = (podValue: string) => {
    const pod = this.props.pods[Number(podValue)];
    const containerInfo = this.getContainerInfo(pod);
    this.setState({ containerInfo: containerInfo, podValue: Number(podValue) });
  };

  private setTimeRange = (range: TimeRange) => {
    this.setState({ duration: range as DurationInSeconds });
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
    return { container: containerNames[0] };
  };

  private formatAppLogLabel = (pod: Pod): string => {
    const labels = pod.labels;
    let label = 'N/A';

    if (labels) {
      const app = pod.appLabel ? labels['app'] : 'No App';
      const version = pod.versionLabel ? labels['version'] : '';
      label = app + '-' + version;
    }
    return label;
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
    const containerPromise: Promise<Response<PodLogs>> = getPodLogs(
      namespace,
      podName,
      'istio-proxy',
      tailLines,
      sinceTime
    );
    this.loadContainerLogsPromise = makeCancelablePromise(Promise.all([containerPromise]));
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

    this.loadContainerLogsPromise.promise
      .then(response => {
        const containerLogs = response[0].data;
        this.setState({
          loadingContainerLogs: false,
          containerLogs: containerLogs.logs ? containerLogs : { logs: 'No container logs found for the time period.' }
        });
        return;
      })
      .catch(error => {
        if (error.isCanceled) {
          console.debug('ContainerLogs: Ignore fetch error (canceled).');
          this.setState({ loadingContainerLogs: false });
          return;
        }
        const errorMsg = error.response && error.response.data.error ? error.response.data.error : error.message;
        this.setState({
          loadingContainerLogs: false,
          containerLogs: { logs: `Failed to fetch container logs: ${errorMsg}` }
        });
      });

    this.setState({
      loadingPodLogs: true,
      loadingContainerLogs: true,
      podLogs: undefined,
      containerLogs: undefined
    });
  };
}
