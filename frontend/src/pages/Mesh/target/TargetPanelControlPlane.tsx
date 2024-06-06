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
import { CanaryUpgradeStatus, OutboundTrafficPolicy } from 'types/IstioObjects';
import { NamespaceInfo, NamespaceStatus } from 'types/NamespaceInfo';
import { isRemoteCluster } from 'pages/Overview/OverviewCardControlPlaneNamespace';
import { DirectionType } from 'pages/Overview/OverviewToolbar';
import { ControlPlaneNamespaceStatus } from 'pages/Overview/ControlPlaneNamespaceStatus';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { TLSInfo } from 'components/Overview/TLSInfo';
import { CanaryUpgradeProgress } from 'pages/Overview/CanaryUpgradeProgress';
import { OverviewCardSparklineCharts } from 'pages/Overview/OverviewCardSparklineCharts';
import * as API from '../../../services/Api';
import { IstioMetricsOptions } from 'types/MetricsOptions';
import { computePrometheusRateParams } from 'services/Prometheus';
import { ApiError } from 'types/Api';
import { DEGRADED, FAILURE, HEALTHY, Health, NOT_READY } from 'types/Health';
import * as AlertUtils from '../../../utils/AlertUtils';
import { MessageType } from 'types/MessageCenter';
import { IstiodResourceThresholds } from 'types/IstioStatus';
import { TLSStatus, nsWideMTLSStatus } from 'types/TLSStatus';
import * as FilterHelper from '../../../components/FilterList/FilterHelper';
import { NodeData } from '../MeshElems';
import { ControlPlaneMetricsMap, Metric } from 'types/Metrics';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { MeshMTLSStatus } from 'components/MTls/MeshMTLSStatus';
import { t } from 'utils/I18nUtils';
import { UNKNOWN } from 'types/Graph';
import { TargetPanelConfigTable } from './TargetPanelConfigTable';

type TargetPanelControlPlaneProps = TargetPanelCommonProps & {
  meshStatus: string;
  minTLS: string;
};

type TargetPanelControlPlaneState = {
  canaryUpgradeStatus?: CanaryUpgradeStatus;
  controlPlaneMetrics?: ControlPlaneMetricsMap;
  controlPlaneNode?: Node<NodeModel, any>;
  errorMetrics?: Metric[];
  istiodResourceThresholds?: IstiodResourceThresholds;
  loading: boolean;
  metrics?: Metric[];
  nsInfo?: NamespaceInfo;
  outboundPolicyMode?: OutboundTrafficPolicy;
  status?: NamespaceStatus;
  tlsStatus?: TLSStatus;
};

const defaultState: TargetPanelControlPlaneState = {
  canaryUpgradeStatus: undefined,
  controlPlaneMetrics: undefined,
  controlPlaneNode: undefined,
  errorMetrics: undefined,
  istiodResourceThresholds: undefined,
  loading: false,
  nsInfo: undefined,
  outboundPolicyMode: undefined,
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

  render(): React.ReactNode {
    if (this.state.loading || !this.state.nsInfo) {
      return this.getLoading();
    }

    const nsInfo = this.state.nsInfo;
    const data = this.state.controlPlaneNode?.getData() as NodeData;

    return (
      <div
        id="target-panel-control-plane"
        data-test={`${data.infraName}-mesh-target`}
        className={classes(panelStyle, targetPanelStyle)}
      >
        <div className={panelHeadingStyle}>{renderNodeHeader(data, {})}</div>

        <div className={panelBodyStyle}>
          <div>{t('Version: {{version}}', { version: data.version || t(UNKNOWN) })}</div>

          <MeshMTLSStatus />

          <ControlPlaneNamespaceStatus
            outboundTrafficPolicy={this.state.outboundPolicyMode}
            namespace={nsInfo}
          ></ControlPlaneNamespaceStatus>

          <TLSInfo
            certificatesInformationIndicators={serverConfig.kialiFeatureFlags.certificatesInformationIndicators.enabled}
            version={this.props.minTLS}
          ></TLSInfo>

          {!isRemoteCluster(nsInfo.annotations) && (
            <>
              {this.state.canaryUpgradeStatus && this.hasCanaryUpgradeConfigured() && (
                <>
                  {targetPanelHR}
                  <CanaryUpgradeProgress canaryUpgradeStatus={this.state.canaryUpgradeStatus} />
                </>
              )}

              {this.props.istioAPIEnabled && (
                <>
                  {targetPanelHR}
                  {this.renderCharts()}
                </>
              )}
            </>
          )}

          {targetPanelHR}

          <TargetPanelConfigTable configData={data.infraData} targetName={data.infraName} width="40%" />
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

  private hasCanaryUpgradeConfigured = (): boolean => {
    if (this.state.canaryUpgradeStatus) {
      if (
        this.state.canaryUpgradeStatus.pendingNamespaces.length > 0 ||
        this.state.canaryUpgradeStatus.migratedNamespaces.length > 0
      ) {
        return true;
      }
    }

    return false;
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
            this.fetchHealthStatus(),
            this.fetchIstiodResourceThresholds(),
            this.fetchMetrics(),
            this.fetchOutboundTrafficPolicyMode(),
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
            currentVersion: response.data.currentVersion,
            upgradeVersion: response.data.upgradeVersion,
            migratedNamespaces: response.data.migratedNamespaces,
            pendingNamespaces: response.data.pendingNamespaces
          }
        });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching namespace canary upgrade status.', error, 'default', MessageType.ERROR);
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

  private fetchIstiodResourceThresholds = async (): Promise<void> => {
    if (!this.isControlPlane()) {
      return Promise.resolve();
    }

    return API.getIstiodResourceThresholds()
      .then(response => {
        this.setState({ istiodResourceThresholds: response.data });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching Istiod resource thresholds.', error, 'default', MessageType.ERROR);
      });
  };

  private fetchMetrics = async (): Promise<void> => {
    const rateParams = computePrometheusRateParams(this.props.duration, 10);
    const options: IstioMetricsOptions = {
      filters: ['request_count', 'request_error_count'],
      duration: this.props.duration,
      step: rateParams.step,
      rateInterval: rateParams.rateInterval,
      direction: direction,
      reporter: direction === 'inbound' ? 'destination' : 'source'
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

  private fetchOutboundTrafficPolicyMode = async (): Promise<void> => {
    if (!this.isControlPlane()) {
      return Promise.resolve();
    }

    return API.getOutboundTrafficPolicyMode()
      .then(response => {
        this.setState({ outboundPolicyMode: { mode: response.data.mode } });
      })
      .catch(error => {
        AlertUtils.addError('Error fetching Mesh OutboundTrafficPolicy.Mode.', error, 'default', MessageType.ERROR);
      });
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

      return (
        <OverviewCardSparklineCharts
          key={data.namespace}
          name={data.namespace}
          annotations={this.state.nsInfo!.annotations}
          duration={this.props.duration}
          direction={direction}
          metrics={this.state.metrics}
          errorMetrics={this.state.errorMetrics}
          controlPlaneMetrics={this.state.controlPlaneMetrics}
          istiodResourceThresholds={this.state.istiodResourceThresholds}
        />
      );
    }

    return <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>Control plane metrics are not available</div>;
  };
}
