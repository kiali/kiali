import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import {
  TargetPanelCommonProps,
  nodeStyle,
  renderNodeHeader,
  shouldRefreshData,
  targetBodyStyle,
  targetPanelHR,
  targetPanelStyle
} from './TargetPanelCommon';
import { Title, TitleSizes } from '@patternfly/react-core';
import { serverConfig } from 'config';
import { NamespaceInfo, NamespaceStatus } from 'types/NamespaceInfo';
import { DirectionType } from 'pages/Overview/OverviewToolbar';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { TLSInfo } from 'components/Overview/TLSInfo';
import * as API from '../../../services/Api';
import { IstioMetricsOptions } from 'types/MetricsOptions';
import { computePrometheusRateParams } from 'services/Prometheus';
import { ApiError } from 'types/Api';
import { DEGRADED, FAILURE, HEALTHY, Health, NOT_READY } from 'types/Health';
import { TLSStatus, nsWideMTLSStatus } from 'types/TLSStatus';
import * as FilterHelper from '../../../components/FilterList/FilterHelper';
import { ControlPlaneMetricsMap } from 'types/Metrics';
import { classes } from 'typestyle';
import { panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { MeshMTLSStatus } from 'components/MTls/MeshMTLSStatus';
import { t } from 'utils/I18nUtils';
import { UNKNOWN } from 'types/Graph';
import { TargetPanelEditor } from './TargetPanelEditor';
import { load } from 'js-yaml';
import { CertsInfo } from 'types/CertsInfo';
import { IstioCertsInfo } from 'components/IstioCertsInfo/IstioCertsInfo';
import { TargetPanelControlPlaneMetrics } from './TargetPanelControlPlaneMetrics';
import { TargetPanelControlPlaneStatus } from './TargetPanelControlPlaneStatus';
import { ControlPlane, IstiodNodeData, NodeTarget } from 'types/Mesh';

type TargetPanelControlPlaneProps = TargetPanelCommonProps & {
  meshStatus: string;
  minTLS: string;
  target: NodeTarget<IstiodNodeData>;
};

type TargetPanelControlPlaneState = {
  certificates?: CertsInfo[];
  controlPlaneMetrics?: ControlPlaneMetricsMap;
  controlPlaneNode?: Node<NodeModel, IstiodNodeData>;
  loading: boolean;
  nsInfo?: NamespaceInfo;
  status?: NamespaceStatus;
  tlsStatus?: TLSStatus;
};

const defaultState: TargetPanelControlPlaneState = {
  certificates: undefined,
  controlPlaneMetrics: undefined,
  controlPlaneNode: undefined,
  loading: false,
  nsInfo: undefined,
  status: undefined,
  tlsStatus: undefined
};

const controlPlaneAnnotation = 'topology.istio.io/controlPlaneClusters';

export const isRemoteCluster = (annotations?: { [key: string]: string }): boolean => {
  if (annotations && annotations[controlPlaneAnnotation]) {
    return true;
  }
  return false;
};

// TODO: Should these remain fixed values?
const direction: DirectionType = 'outbound';

export class TargetPanelControlPlane extends React.Component<
  TargetPanelControlPlaneProps,
  TargetPanelControlPlaneState
> {
  private promises = new PromisesRegistry();

  constructor(props: TargetPanelControlPlaneProps) {
    super(props);

    const namespaceNode = this.props.target.elem;
    this.state = {
      ...defaultState,
      controlPlaneNode: namespaceNode
    };
  }

  static getDerivedStateFromProps: React.GetDerivedStateFromProps<
    TargetPanelControlPlaneProps,
    TargetPanelControlPlaneState
  > = (props, state) => {
    // if the target (e.g. namespaceBox) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.target.elem !== state.controlPlaneNode ? { controlPlaneNode: props.target.elem, loading: true } : null;
  };

  componentDidMount(): void {
    this.load();
  }

  componentDidUpdate(prevProps: TargetPanelCommonProps): void {
    if (shouldRefreshData(prevProps, this.props)) {
      this.load();
    }
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  configMapToJson(configMap: Map<string, string>): unknown {
    let cm = {};

    if (configMap) {
      for (const [key, value] of Object.entries(configMap)) {
        cm[key] = load(value);
      }
    }

    return cm;
  }

  render(): React.ReactNode {
    if (this.state.loading || !this.state.nsInfo) {
      return this.getLoading();
    }

    const nsInfo = this.state.nsInfo;
    const data = this.state.controlPlaneNode?.getData()!;

    const controlPlane: ControlPlane = data.infraData;
    const configMapJson = controlPlane.config.configMap ? this.configMapToJson(controlPlane.config.configMap) : '';

    return (
      <div
        id="target-panel-control-plane"
        data-test={`${data.infraName}-mesh-target`}
        className={classes(panelStyle, targetPanelStyle)}
      >
        <div className={panelHeadingStyle}>{renderNodeHeader(data, {})}</div>

        <div className={targetBodyStyle}>
          {controlPlane.tag && <div>{t('Tag: {{tag}}', { tag: controlPlane.tag.name })}</div>}

          <div>{t('Version: {{version}}', { version: data.version || t(UNKNOWN) })}</div>

          <MeshMTLSStatus cluster={data.cluster} revision={controlPlane.revision} />

          <TargetPanelControlPlaneStatus
            controlPlaneMetrics={this.state.controlPlaneMetrics}
            outboundTrafficPolicy={controlPlane.config.outboundTrafficPolicy}
          />

          <TLSInfo version={this.props.minTLS} />

          {!isRemoteCluster(nsInfo.annotations) && (
            <>
              {this.props.istioAPIEnabled && (
                <>
                  {targetPanelHR}
                  {this.renderCharts()}
                </>
              )}
            </>
          )}

          {targetPanelHR}
          <TargetPanelEditor configData={configMapJson} targetName={data.infraName}></TargetPanelEditor>

          {data.infraData.config.certificates && targetPanelHR}
          {data.infraData.config.certificates && (
            <IstioCertsInfo certificates={data.infraData.config.certificates}></IstioCertsInfo>
          )}
        </div>
      </div>
    );
  }

  private getLoading = (): React.ReactNode => {
    return (
      <div className={classes(panelStyle, targetPanelStyle)}>
        <div className={panelHeadingStyle}>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            <span className={nodeStyle}>
              <span>{t('Loading...')}</span>
            </span>
          </Title>
        </div>
      </div>
    );
  };

  private load = (): void => {
    this.promises.cancelAll();

    const data = this.state.controlPlaneNode!.getData()!;

    this.promises
      .registerAll(`promises-${data.cluster}:${data.namespace}`, [
        this.fetchHealthStatus(),
        this.fetchMetrics(),
        this.fetchTLS(),
        this.fetchNamespaceInfo()
      ])
      .then(_ => {
        this.setState({ loading: false });
      })
      .catch(err => {
        if (err.isCanceled) {
          console.debug('TargetPanelNamespace: Ignore fetch error (canceled).');
          return;
        }

        this.setState({ ...defaultState, loading: false });
        this.handleApiError('Could not loading target namespace panel', err);
      });

    this.setState({ loading: true });
  };

  private fetchNamespaceInfo = async (): Promise<void> => {
    const data = this.state.controlPlaneNode!.getData()!;

    return API.getNamespaceInfo(data.namespace, data.cluster)
      .then(response => {
        this.setState({
          nsInfo: response.data
        });
      })
      .catch(err => this.handleApiError('Could not fetch namespace info', err));
  };

  private fetchHealthStatus = async (): Promise<void> => {
    const data = this.state.controlPlaneNode!.getData()!;

    return API.getClustersAppHealth(data.namespace, this.props.duration, data.cluster)
      .then(results => {
        const nsStatus: NamespaceStatus = {
          inNotReady: [],
          inError: [],
          inWarning: [],
          inSuccess: [],
          notAvailable: []
        };

        const rs = results[data.namespace];

        Object.keys(rs).forEach(item => {
          const health: Health = rs[item];
          const status = health.getGlobalStatus();

          if (status === FAILURE) {
            nsStatus.inError.push(item);
          } else if (status === DEGRADED) {
            nsStatus.inWarning.push(item);
          } else if (status === HEALTHY) {
            nsStatus.inSuccess.push(item);
          } else if (status === NOT_READY) {
            nsStatus.inNotReady.push(item);
          } else {
            nsStatus.notAvailable.push(item);
          }
        });
        this.setState({ status: nsStatus });
      })
      .catch(err => this.handleApiError('Could not fetch namespace health', err));
  };

  private fetchMetrics = async (): Promise<void> => {
    const rateParams = computePrometheusRateParams(this.props.duration, 10);
    const options: IstioMetricsOptions = {
      direction: direction,
      duration: this.props.duration,
      filters: ['request_count', 'request_error_count'],
      includeAmbient: serverConfig.ambientEnabled,
      rateInterval: rateParams.rateInterval,
      reporter: direction === 'inbound' ? 'destination' : 'source',
      step: rateParams.step
    };

    const data = this.state.controlPlaneNode!.getData()!;

    return API.getControlPlaneMetrics(data.namespace, data.infraName, options, data.cluster)
      .then(rs => {
        const controlPlaneMetrics: ControlPlaneMetricsMap = {
          istiod_proxy_time: rs.data.pilot_proxy_convergence_time,
          istiod_container_cpu: rs.data.container_cpu_usage_seconds_total,
          istiod_container_mem: rs.data.container_memory_working_set_bytes,
          istiod_process_cpu: rs.data.process_cpu_seconds_total,
          istiod_process_mem: rs.data.process_resident_memory_bytes
        };

        this.setState({
          controlPlaneMetrics: controlPlaneMetrics
        });
      })
      .catch(err => this.handleApiError('Could not fetch control plane metrics', err));
  };

  private fetchTLS = async (): Promise<void> => {
    if (!this.isControlPlane()) {
      return Promise.resolve();
    }

    const data = this.state.controlPlaneNode!.getData()!;

    return API.getNamespaceTls(data.namespace, data.cluster)
      .then(rs => {
        this.setState({
          tlsStatus: {
            status: nsWideMTLSStatus(rs.data.status, this.props.meshStatus),
            autoMTLSEnabled: rs.data.autoMTLSEnabled,
            minTLS: rs.data.minTLS
          }
        });
      })
      .catch(err => this.handleApiError('Could not fetch namespace TLS status', err));
  };

  private isControlPlane = (): boolean => {
    const data = this.state.controlPlaneNode!.getData()!;
    return data.namespace === serverConfig.istioNamespace;
  };

  private handleApiError = (message: string, error: ApiError): void => {
    FilterHelper.handleError(`${message}: ${API.getErrorString(error)}`);
  };

  private renderCharts = (): React.ReactNode => {
    if (this.state.status) {
      const data = this.state.controlPlaneNode!.getData()!;
      const { thresholds } = data.infraData;

      return (
        <TargetPanelControlPlaneMetrics
          key={data.namespace}
          pilotLatency={this.state.controlPlaneMetrics?.istiod_proxy_time}
          istiodContainerMemory={this.state.controlPlaneMetrics?.istiod_container_mem}
          istiodContainerCpu={this.state.controlPlaneMetrics?.istiod_container_cpu}
          istiodProcessMemory={this.state.controlPlaneMetrics?.istiod_process_mem}
          istiodProcessCpu={this.state.controlPlaneMetrics?.istiod_process_cpu}
          istiodResourceThresholds={thresholds}
        />
      );
    }

    return <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>Control plane metrics are not available</div>;
  };
}
