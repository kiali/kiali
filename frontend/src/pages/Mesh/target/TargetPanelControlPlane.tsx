import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import {
  TargetPanelCommonProps,
  nodeStyle,
  renderNodeHeader,
  shouldRefreshData,
  targetPanelHR,
  targetPanelStyle
} from './TargetPanelCommon';
import { Title, TitleSizes } from '@patternfly/react-core';
import { serverConfig } from 'config';
import { CanaryUpgradeStatus } from 'types/IstioObjects';
import { NamespaceInfo, NamespaceStatus } from 'types/NamespaceInfo';
import { isRemoteCluster } from 'pages/Overview/OverviewCardControlPlaneNamespace';
import { DirectionType } from 'pages/Overview/OverviewToolbar';
import { ControlPlaneNamespaceStatus } from 'pages/Overview/ControlPlaneNamespaceStatus';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { TLSInfo } from 'components/Overview/TLSInfo';
import { OverviewCardControlPlaneNamespace } from 'pages/Overview/OverviewCardControlPlaneNamespace';
import * as API from '../../../services/Api';
import { IstioMetricsOptions } from 'types/MetricsOptions';
import { computePrometheusRateParams } from 'services/Prometheus';
import { ApiError } from 'types/Api';
import { DEGRADED, FAILURE, HEALTHY, Health, NOT_READY } from 'types/Health';
import * as AlertUtils from '../../../utils/AlertUtils';
import { MessageType } from 'types/MessageCenter';
import { TLSStatus, nsWideMTLSStatus } from 'types/TLSStatus';
import * as FilterHelper from '../../../components/FilterList/FilterHelper';
import { NodeData } from '../MeshElems';
import { ControlPlaneMetricsMap, Metric } from 'types/Metrics';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { MeshMTLSStatus } from 'components/MTls/MeshMTLSStatus';
import { t } from 'utils/I18nUtils';
import { UNKNOWN } from 'types/Graph';
import { TargetPanelEditor } from './TargetPanelEditor';
import { load, dump } from 'js-yaml';
import { yamlDumpOptions } from '../../../types/IstioConfigDetails';
import { CertsInfo } from 'types/CertsInfo';
import { IstioCertsInfo } from 'components/IstioCertsInfo/IstioCertsInfo';

type TargetPanelControlPlaneProps = TargetPanelCommonProps & {
  meshStatus: string;
  minTLS: string;
};

type TargetPanelControlPlaneState = {
  canaryUpgradeStatus?: CanaryUpgradeStatus;
  certificates?: CertsInfo[];
  controlPlaneMetrics?: ControlPlaneMetricsMap;
  controlPlaneNode?: Node<NodeModel, any>;
  errorMetrics?: Metric[];
  loading: boolean;
  metrics?: Metric[];
  nsInfo?: NamespaceInfo;
  status?: NamespaceStatus;
  tlsStatus?: TLSStatus;
};

const defaultState: TargetPanelControlPlaneState = {
  canaryUpgradeStatus: undefined,
  certificates: undefined,
  controlPlaneMetrics: undefined,
  controlPlaneNode: undefined,
  errorMetrics: undefined,
  loading: false,
  nsInfo: undefined,
  status: undefined,
  tlsStatus: undefined
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

    const namespaceNode = this.props.target.elem as Node<NodeModel, any>;
    this.state = {
      ...defaultState,
      controlPlaneNode: namespaceNode
    };
  }

  static getDerivedStateFromProps: React.GetDerivedStateFromProps<
    TargetPanelCommonProps,
    TargetPanelControlPlaneState
  > = (props, state) => {
    // if the target (e.g. namespaceBox) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.target.elem !== state.controlPlaneNode
      ? { controlPlaneNode: props.target.elem as Node<NodeModel, any>, loading: true }
      : null;
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

  convertYamlToJson(yamlString: string): unknown {
    return load(yamlString);
  }

  getParsedYaml(configMap: Map<string, string>): string {
    let cm = {};
    if (configMap) {
      for (const [key, value] of Object.entries(configMap)) {
        cm[key] = this.convertYamlToJson(value);
      }

      return dump(cm, yamlDumpOptions);
    }
    return '';
  }

  render(): React.ReactNode {
    if (this.state.loading || !this.state.nsInfo) {
      return this.getLoading();
    }

    const nsInfo = this.state.nsInfo;
    const data = this.state.controlPlaneNode?.getData() as NodeData;

    // Controlplane infradata is structured: {config: configuration, revision: string}
    const { config, revision } = data.infraData;
    const parsedCm = config.ConfigMap ? this.getParsedYaml(config.ConfigMap) : '';
    console.log(data.infraData);
    return (
      <div
        id="target-panel-control-plane"
        data-test={`${data.infraName}-mesh-target`}
        className={classes(panelStyle, targetPanelStyle)}
      >
        <div className={panelHeadingStyle}>{renderNodeHeader(data, {})}</div>

        <div className={panelBodyStyle}>
          <div>{t('Version: {{version}}', { version: data.version || t(UNKNOWN) })}</div>

          <MeshMTLSStatus cluster={data.cluster} revision={revision} />

          <ControlPlaneNamespaceStatus
            outboundTrafficPolicy={config.OutboundTrafficPolicy}
            namespace={nsInfo}
          ></ControlPlaneNamespaceStatus>

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
          {parsedCm !== '' && <TargetPanelEditor configMap={parsedCm} targetName={data.infraName}></TargetPanelEditor>}
          {targetPanelHR}
          <IstioCertsInfo certificates={data.infraData.config.certificates}></IstioCertsInfo>
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

    API.getNamespaces()
      .then(result => {
        const data = this.state.controlPlaneNode!.getData() as NodeData;
        const cluster = data.cluster;
        const namespace = data.namespace;
        const nsInfo = result.data.find(ns => ns.cluster === cluster && ns.name === namespace);

        if (!nsInfo) {
          AlertUtils.add(`Failed to find |${cluster}:${namespace}| in GetNamespaces() result`);
          this.setState({ ...defaultState, loading: false });
          return;
        }

        this.promises
          .registerAll(`promises-${data.cluster}:${data.namespace}`, [
            this.fetchCanariesStatus(),
            this.fetchCertificates(),
            this.fetchHealthStatus(),
            this.fetchMetrics(),
            this.fetchTLS()
          ])
          .then(_ => {
            this.setState({ loading: false, nsInfo: nsInfo });
          })
          .catch(err => {
            if (err.isCanceled) {
              console.debug('TargetPanelNamespace: Ignore fetch error (canceled).');
              return;
            }

            this.setState({ ...defaultState, loading: false });
            this.handleApiError('Could not loading target namespace panel', err);
          });
      })
      .catch(err => {
        if (err.isCanceled) {
          console.debug('TargetPanelNamespace: Ignore fetch error (canceled).');
          return;
        }

        this.setState({ ...defaultState, loading: false });
        this.handleApiError('Could not fetch namespaces when loading target panel', err);
      });

    this.setState({ loading: true });
  };

  private fetchCanariesStatus = async (): Promise<void> => {
    if (!this.isControlPlane()) {
      return Promise.resolve();
    }

    return API.getCanaryUpgradeStatus()
      .then(response => {
        this.setState({
          canaryUpgradeStatus: {
            namespacesPerRevision: response.data.namespacesPerRevision
          }
        });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching namespace canary upgrade status.', error, 'default', MessageType.ERROR);
      });
  };

  private fetchCertificates = async (): Promise<void> => {
    const data = this.state.controlPlaneNode!.getData() as NodeData;
    console.log(data);
    return API.getIstioCertsInfo()
      .then(response => {
        this.setState({
          certificates: response.data
        });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching namespace certificates.', error, 'default', MessageType.ERROR);
      });
  };

  private fetchHealthStatus = async (): Promise<void> => {
    const data = this.state.controlPlaneNode!.getData() as NodeData;

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

    const data = this.state.controlPlaneNode!.getData() as NodeData;

    return API.getNamespaceMetrics(data.namespace, options, data.cluster)
      .then(rs => {
        const metrics: Metric[] = rs.data.request_count as Metric[];
        const errorMetrics: Metric[] = rs.data.request_error_count as Metric[];

        if (this.isControlPlane()) {
          const controlPlaneMetrics: ControlPlaneMetricsMap = {
            istiod_proxy_time: rs.data.pilot_proxy_convergence_time,
            istiod_container_cpu: rs.data.container_cpu_usage_seconds_total,
            istiod_container_mem: rs.data.container_memory_working_set_bytes,
            istiod_process_cpu: rs.data.process_cpu_seconds_total,
            istiod_process_mem: rs.data.process_resident_memory_bytes
          };

          this.setState({
            controlPlaneMetrics: controlPlaneMetrics,
            errorMetrics: errorMetrics,
            metrics: metrics
          });
        } else {
          this.setState({
            errorMetrics: errorMetrics,
            metrics: metrics
          });
        }
      })
      .catch(err => this.handleApiError('Could not fetch namespace metrics', err));
  };

  private fetchTLS = async (): Promise<void> => {
    if (!this.isControlPlane()) {
      return Promise.resolve();
    }

    const data = this.state.controlPlaneNode!.getData() as NodeData;

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
    const data = this.state.controlPlaneNode!.getData() as NodeData;
    return data.namespace === serverConfig.istioNamespace;
  };

  private handleApiError = (message: string, error: ApiError): void => {
    FilterHelper.handleError(`${message}: ${API.getErrorString(error)}`);
  };

  private renderCharts = (): React.ReactNode => {
    if (this.state.status) {
      const data = this.state.controlPlaneNode!.getData() as NodeData;
      const { thresholds } = data.infraData;

      return (
        <OverviewCardControlPlaneNamespace
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
