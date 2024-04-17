import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import {
  TargetPanelCommonProps,
  targetPanel,
  targetPanelBody,
  targetPanelBorder,
  targetPanelHR
} from './TargetPanelCommon';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { Card, CardBody, CardHeader, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Paths, serverConfig } from 'config';
import { OutboundTrafficPolicy, ValidationStatus } from 'types/IstioObjects';
import { OverviewNamespaceAction, OverviewNamespaceActions } from 'pages/Overview/OverviewNamespaceActions';
import { NamespaceInfo, NamespaceStatus } from 'types/NamespaceInfo';
import { NamespaceMTLSStatus } from 'components/MTls/NamespaceMTLSStatus';
import { DirectionType, OverviewType } from 'pages/Overview/OverviewToolbar';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { isParentKiosk, kioskOverviewAction } from 'components/Kiosk/KioskActions';
import { Show } from 'pages/Overview/OverviewPage';
import { AmbientBadge } from 'components/Ambient/AmbientBadge';
import { PFColors } from 'components/Pf/PfColors';
import { ValidationSummaryLink } from 'components/Link/ValidationSummaryLink';
import { ValidationSummary } from 'components/Validations/ValidationSummary';
import { OverviewCardSparklineCharts } from 'pages/Overview/OverviewCardSparklineCharts';
import * as API from '../../../services/Api';
import { IstioMetricsOptions } from 'types/MetricsOptions';
import { computePrometheusRateParams } from 'services/Prometheus';
import { ApiError } from 'types/Api';
import { DEGRADED, FAILURE, HEALTHY, Health, NOT_READY } from 'types/Health';
import { history } from '../../../app/History';
import * as AlertUtils from '../../../utils/AlertUtils';
import { OverviewStatus } from 'pages/Overview/OverviewStatus';
import { switchType } from 'pages/Overview/OverviewHelper';
import { IstiodResourceThresholds } from 'types/IstioStatus';
import { TLSStatus } from 'types/TLSStatus';
import * as FilterHelper from '../../../components/FilterList/FilterHelper';
import { classes } from 'typestyle';
import { panelHeadingStyle } from 'pages/Graph/SummaryPanelStyle';
import { Metric } from 'types/Metrics';

type TargetPanelDataPlaneNamespaceProps = Omit<TargetPanelCommonProps, 'target'> & {
  targetCluster: string;
  targetNamespace: string;
};

type TargetPanelDataPlaneNamespaceState = {
  errorMetricsInbound?: Metric[];
  errorMetricsOutbound?: Metric[];
  istiodResourceThresholds?: IstiodResourceThresholds;
  loading: boolean;
  metricsInbound?: Metric[];
  metricsOutbound?: Metric[];
  nsInfo?: NamespaceInfo;
  outboundPolicyMode?: OutboundTrafficPolicy;
  status?: NamespaceStatus;
  tlsStatus?: TLSStatus;
};

const defaultState: TargetPanelDataPlaneNamespaceState = {
  errorMetricsInbound: undefined,
  errorMetricsOutbound: undefined,
  istiodResourceThresholds: undefined,
  loading: false,
  metricsInbound: undefined,
  metricsOutbound: undefined,
  nsInfo: undefined,
  outboundPolicyMode: undefined,
  status: undefined,
  tlsStatus: undefined
};

// TODO: Should these remain fixed values?
const healthType: OverviewType = 'app';

const cardGridStyle = kialiStyle({
  textAlign: 'center',
  marginTop: 0,
  marginBottom: '0.5rem'
});

const namespaceNameStyle = kialiStyle({
  display: 'block',
  textAlign: 'left',
  overflow: 'hidden',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis'
});

const panel = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  margin: 0,
  padding: 0
});

export class TargetPanelDataPlaneNamespace extends React.Component<
  TargetPanelDataPlaneNamespaceProps,
  TargetPanelDataPlaneNamespaceState
> {
  private promises = new PromisesRegistry();

  constructor(props: TargetPanelDataPlaneNamespaceProps) {
    super(props);

    this.state = defaultState;
  }

  componentDidMount(): void {
    this.load();
  }

  componentDidUpdate(prevProps: TargetPanelDataPlaneNamespaceProps): void {
    if (prevProps.updateTime !== this.props.updateTime) {
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
    const ns = nsInfo.name;
    const actions = this.getNamespaceActions();
    const namespaceActions = (
      <OverviewNamespaceActions key={`namespaceAction_${ns}`} namespace={ns} actions={actions} />
    );

    return (
      <div className={classes(targetPanelBorder, panel)}>
        <Card isCompact={true} className={cardGridStyle} data-test={`${ns}-mesh-target`} style={{ height: '96%' }}>
          <CardHeader
            className={panelHeadingStyle}
            actions={{ actions: <>{namespaceActions}</>, hasNoOffset: false, className: undefined }}
          >
            <Title headingLevel="h5" size={TitleSizes.lg}>
              <span className={namespaceNameStyle}>
                <span>
                  <PFBadge badge={PFBadges.Namespace} />
                  {ns}
                </span>
                {this.renderNamespaceBadges(nsInfo, true)}
              </span>
            </Title>
            <div style={{ textAlign: 'left', paddingBottom: 3 }}>
              <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} />
              {nsInfo.cluster}
            </div>
          </CardHeader>
          <CardBody>
            <div className={targetPanelBody}>
              {this.renderLabels(nsInfo)}

              <div style={{ textAlign: 'left' }}>
                <div style={{ display: 'inline-block', width: '125px' }}>Istio config</div>

                {nsInfo.tlsStatus && (
                  <span>
                    <NamespaceMTLSStatus status={nsInfo.tlsStatus.status} />
                  </span>
                )}
                {this.props.istioAPIEnabled ? this.renderIstioConfigStatus(nsInfo) : 'N/A'}
              </div>

              {this.renderStatus()}

              {targetPanelHR()}
              {this.renderCharts('inbound')}
              {this.renderCharts('outbound')}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  private getLoading = (): React.ReactNode => {
    return (
      <div className={classes(targetPanelBorder, targetPanel)}>
        <Card isCompact={true} className={cardGridStyle} style={{ height: '96%' }}>
          <CardHeader className={panelHeadingStyle}>
            <Title headingLevel="h5" size={TitleSizes.lg}>
              <span className={namespaceNameStyle}>
                <span>Loading...</span>
              </span>
            </Title>
          </CardHeader>
        </Card>
      </div>
    );
  };

  // Limits to just "Show" options, management should probably be done in Overview (for now at least),
  // not just buried in the side panel of the mesh page.
  private getNamespaceActions = (): OverviewNamespaceAction[] => {
    // Today actions are fixed, but soon actions may depend of the state of a namespace
    // So we keep this wrapped in a showActions function.
    const namespaceActions: OverviewNamespaceAction[] = isParentKiosk(this.props.kiosk)
      ? [
          {
            isGroup: true,
            isSeparator: false,
            isDisabled: false,
            title: 'Show',
            children: [
              {
                isGroup: true,
                isSeparator: false,
                title: 'Graph',
                action: (ns: string) =>
                  kioskOverviewAction(Show.GRAPH, ns, this.props.duration, this.props.refreshInterval)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Istio Config',
                action: (ns: string) =>
                  kioskOverviewAction(Show.ISTIO_CONFIG, ns, this.props.duration, this.props.refreshInterval)
              }
            ]
          }
        ]
      : [
          {
            isGroup: true,
            isSeparator: false,
            isDisabled: false,
            title: 'Show',
            children: [
              {
                isGroup: true,
                isSeparator: false,
                title: 'Graph',
                action: (ns: string) => this.show(Show.GRAPH, ns, healthType)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Applications',
                action: (ns: string) => this.show(Show.APPLICATIONS, ns, healthType)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Workloads',
                action: (ns: string) => this.show(Show.WORKLOADS, ns, healthType)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Services',
                action: (ns: string) => this.show(Show.SERVICES, ns, healthType)
              },
              {
                isGroup: true,
                isSeparator: false,
                title: 'Istio Config',
                action: (ns: string) => this.show(Show.ISTIO_CONFIG, ns, healthType)
              }
            ]
          }
        ];

    return namespaceActions;
  };

  private renderNamespaceBadges(ns: NamespaceInfo, tooltip: boolean): JSX.Element {
    return (
      <>
        {serverConfig.ambientEnabled && ns.labels && ns.isAmbient && (
          <AmbientBadge tooltip={tooltip ? 'labeled as part of Ambient Mesh' : undefined}></AmbientBadge>
        )}
      </>
    );
  }

  private renderLabels(ns: NamespaceInfo): JSX.Element {
    const labelsLength = ns.labels ? `${Object.entries(ns.labels).length}` : 'No';

    const labelContent = ns.labels ? (
      <div style={{ color: PFColors.Link, textAlign: 'left', cursor: 'pointer' }}>
        <Tooltip
          aria-label="Labels list"
          position={TooltipPosition.right}
          enableFlip={true}
          distance={5}
          content={
            <ul>
              {Object.entries(ns.labels ?? []).map(([key, value]) => (
                <li key={key}>
                  {key}={value}
                </li>
              ))}
            </ul>
          }
        >
          <div id="labels_info" style={{ display: 'inline' }}>
            {labelsLength} label{labelsLength !== '1' ? 's' : ''}
          </div>
        </Tooltip>
      </div>
    ) : (
      <div style={{ textAlign: 'left' }}>No labels</div>
    );

    return labelContent;
  }

  private renderIstioConfigStatus(ns: NamespaceInfo): JSX.Element {
    let validations: ValidationStatus = { errors: 0, namespace: ns.name, objectCount: 0, warnings: 0 };

    if (!!ns.validations) {
      validations = ns.validations;
    }

    return (
      <ValidationSummaryLink
        namespace={validations.namespace}
        objectCount={validations.objectCount}
        errors={validations.errors}
        warnings={validations.warnings}
      >
        <ValidationSummary
          id={`ns-val-${validations.namespace}`}
          errors={validations.errors}
          warnings={validations.warnings}
          objectCount={validations.objectCount}
          type="istio"
        />
      </ValidationSummaryLink>
    );
  }

  private load = (): void => {
    this.promises.cancelAll();

    API.getNamespaces()
      .then(result => {
        const cluster = this.props.targetCluster;
        const namespace = this.props.targetNamespace;
        const nsInfo = result.data.find(ns => ns.cluster === cluster && ns.name === namespace);
        if (!nsInfo) {
          AlertUtils.add(`Failed to find |${cluster}:${namespace}| in GetNamespaces() result`);
          this.setState({ ...defaultState, loading: false });
          return;
        }

        this.promises
          .registerAll(`promises-${cluster}:${namespace}`, [
            this.fetchHealthStatus(),
            this.fetchMetrics('inbound'),
            this.fetchMetrics('outbound')
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

  private fetchHealthStatus(): Promise<void> {
    const cluster = this.props.targetCluster;
    const namespace = this.props.targetNamespace;
    return API.getClustersAppHealth(namespace, this.props.duration, cluster!)
      .then(results => {
        const nsStatus: NamespaceStatus = {
          inNotReady: [],
          inError: [],
          inWarning: [],
          inSuccess: [],
          notAvailable: []
        };

        const rs = results[namespace];
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
  }

  private fetchMetrics(direction: DirectionType): Promise<void> {
    const rateParams = computePrometheusRateParams(this.props.duration, 10);
    const options: IstioMetricsOptions = {
      filters: ['request_count', 'request_error_count'],
      duration: this.props.duration,
      step: rateParams.step,
      rateInterval: rateParams.rateInterval,
      direction: direction,
      reporter: direction === 'inbound' ? 'destination' : 'source'
    };
    const cluster = this.props.targetCluster;
    const namespace = this.props.targetNamespace;

    return API.getNamespaceMetrics(namespace, options, cluster)
      .then(rs => {
        const metrics: Metric[] = rs.data.request_count as Metric[];
        const errorMetrics: Metric[] = rs.data.request_error_count as Metric[];

        this.setState(
          direction === 'inbound'
            ? {
                errorMetricsInbound: errorMetrics,
                metricsInbound: metrics
              }
            : { errorMetricsOutbound: errorMetrics, metricsOutbound: metrics }
        );
      })
      .catch(err => this.handleApiError(`Could not fetch ${direction} metrics for namespace [${namespace}]`, err));
  }

  private handleApiError(message: string, error: ApiError): void {
    FilterHelper.handleError(`${message}: ${API.getErrorString(error)}`);
  }

  private renderCharts(direction: DirectionType): JSX.Element {
    if (this.state.status) {
      const namespace = this.props.targetNamespace;
      return (
        <OverviewCardSparklineCharts
          key={`${namespace}-${direction}`}
          name={namespace}
          annotations={this.state.nsInfo!.annotations}
          duration={this.props.duration}
          direction={direction}
          metrics={direction === 'inbound' ? this.state.metricsInbound : this.state.metricsOutbound}
          errorMetrics={direction === 'inbound' ? this.state.errorMetricsInbound : this.state.errorMetricsOutbound}
          istiodResourceThresholds={this.state.istiodResourceThresholds}
        />
      );
    }

    return <div style={{ height: '70px' }} />;
  }

  private renderStatus(): JSX.Element {
    const targetPage = switchType(healthType, Paths.APPLICATIONS, Paths.SERVICES, Paths.WORKLOADS);
    const namespace = this.props.targetNamespace;
    const status = this.state.status;
    let nbItems = 0;

    if (status) {
      nbItems =
        status.inError.length +
        status.inWarning.length +
        status.inSuccess.length +
        status.notAvailable.length +
        status.inNotReady.length;
    }

    let text: string;

    if (nbItems === 1) {
      text = switchType(healthType, '1 application', '1 service', '1 workload');
    } else {
      text = `${nbItems}${switchType(healthType, ' applications', ' services', ' workloads')}`;
    }

    const mainLink = (
      <div
        style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}
        data-test={`overview-type-${healthType}`}
      >
        {text}
      </div>
    );

    if (nbItems === status?.notAvailable.length) {
      return (
        <div style={{ textAlign: 'left' }}>
          <span>
            {mainLink}

            <div style={{ display: 'inline-block' }}>N/A</div>
          </span>
        </div>
      );
    }

    return (
      <div style={{ textAlign: 'left' }}>
        <span>
          {mainLink}

          <div style={{ display: 'inline-block' }} data-test="overview-app-health">
            {status && status.inNotReady.length > 0 && (
              <OverviewStatus
                id={`${namespace}-not-ready`}
                namespace={namespace}
                status={NOT_READY}
                items={status.inNotReady}
                targetPage={targetPage}
              />
            )}

            {status && status.inError.length > 0 && (
              <OverviewStatus
                id={`${namespace}-failure`}
                namespace={namespace}
                status={FAILURE}
                items={status.inError}
                targetPage={targetPage}
              />
            )}

            {status && status.inWarning.length > 0 && (
              <OverviewStatus
                id={`${namespace}-degraded`}
                namespace={namespace}
                status={DEGRADED}
                items={status.inWarning}
                targetPage={targetPage}
              />
            )}

            {status && status.inSuccess.length > 0 && (
              <OverviewStatus
                id={`${namespace}-healthy`}
                namespace={namespace}
                status={HEALTHY}
                items={status.inSuccess}
                targetPage={targetPage}
              />
            )}
          </div>
        </span>
      </div>
    );
  }

  private show = (showType: Show, namespace: string, graphType: string): void => {
    let destination = '';

    switch (showType) {
      case Show.GRAPH:
        destination = `/graph/namespaces?namespaces=${namespace}&graphType=${graphType}`;
        break;
      case Show.APPLICATIONS:
        destination = `/${Paths.APPLICATIONS}?namespaces=${namespace}`;
        break;
      case Show.WORKLOADS:
        destination = `/${Paths.WORKLOADS}?namespaces=${namespace}`;
        break;
      case Show.SERVICES:
        destination = `/${Paths.SERVICES}?namespaces=${namespace}`;
        break;
      case Show.ISTIO_CONFIG:
        destination = `/${Paths.ISTIO}?namespaces=${namespace}`;
        break;
      default:
      // Nothing to do on default case
    }
    history.push(destination);
  };
}
