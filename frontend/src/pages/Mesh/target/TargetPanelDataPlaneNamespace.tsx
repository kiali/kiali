import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { targetBodyStyle, TargetPanelCommonProps, targetPanelHR } from './TargetPanelCommon';
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
import { OverviewCardDataPlaneNamespace } from 'pages/Overview/OverviewCardDataPlaneNamespace';
import * as API from '../../../services/Api';
import { IstioMetricsOptions } from 'types/MetricsOptions';
import { computePrometheusRateParams } from 'services/Prometheus';
import { ApiError } from 'types/Api';
import { DEGRADED, FAILURE, HEALTHY, Health, NOT_READY } from 'types/Health';
import { router } from '../../../app/History';
import * as AlertUtils from '../../../utils/AlertUtils';
import { OverviewStatus } from 'pages/Overview/OverviewStatus';
import { switchType } from 'pages/Overview/OverviewHelper';
import { TLSStatus } from 'types/TLSStatus';
import * as FilterHelper from '../../../components/FilterList/FilterHelper';
import { panelHeadingStyle } from 'pages/Graph/SummaryPanelStyle';
import { Metric } from 'types/Metrics';
import { t } from 'utils/I18nUtils';
import { TargetPanelEditor } from './TargetPanelEditor';

type TargetPanelDataPlaneNamespaceProps = Omit<TargetPanelCommonProps, 'target'> & {
  isExpanded: boolean;
  namespaceData: NamespaceInfo;
  targetCluster: string;
  targetNamespace: string;
};

type TargetPanelDataPlaneNamespaceState = {
  errorMetricsInbound?: Metric[];
  errorMetricsOutbound?: Metric[];
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
  marginBottom: '-0.5rem',
  boxShadow: 'none'
});

const namespaceNameStyle = kialiStyle({
  display: 'block',
  textAlign: 'left',
  overflow: 'hidden',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis'
});

const titleStyle = kialiStyle({
  display: 'inline-block',
  textAlign: 'left',
  width: '125px',
  whiteSpace: 'nowrap'
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

  componentDidUpdate(prevProps: TargetPanelDataPlaneNamespaceProps): void {
    const shouldLoad =
      this.props.isExpanded && (!prevProps.isExpanded || prevProps.updateTime !== this.props.updateTime);

    if (shouldLoad) {
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
      <Card isCompact={true} className={cardGridStyle} data-test={`${ns}-mesh-target`}>
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
          <div style={{ textAlign: 'left', paddingBottom: '0.25rem' }}>
            <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} />
            {nsInfo.cluster}
          </div>
        </CardHeader>
        <CardBody className={targetBodyStyle}>
          {this.renderLabels(nsInfo)}

          <div style={{ textAlign: 'left' }}>
            <span className={titleStyle}>{t('Istio config')}</span>

            {nsInfo.tlsStatus && (
              <span>
                <NamespaceMTLSStatus status={nsInfo.tlsStatus.status} />
              </span>
            )}

            {this.props.istioAPIEnabled ? this.renderIstioConfigStatus(nsInfo) : 'N/A'}
          </div>

          {this.renderStatus()}

          {targetPanelHR}

          {this.renderCharts('inbound')}
          {this.renderCharts('outbound')}

          {targetPanelHR}

          <TargetPanelEditor
            configData={this.props.namespaceData}
            targetName={this.props.targetNamespace}
          ></TargetPanelEditor>
        </CardBody>
      </Card>
    );
  }

  private getLoading = (): React.ReactNode => {
    return (
      <Card isCompact={true} className={cardGridStyle}>
        <CardHeader className={panelHeadingStyle}>
          <Title headingLevel="h5" size={TitleSizes.lg}>
            <span className={namespaceNameStyle}>
              <span>{t('Loading...')}</span>
            </span>
          </Title>
        </CardHeader>
      </Card>
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

  private renderNamespaceBadges = (ns: NamespaceInfo, tooltip: boolean): React.ReactNode => {
    return (
      <>
        {serverConfig.ambientEnabled && ns.labels && ns.isAmbient && (
          <AmbientBadge tooltip={tooltip ? 'labeled as part of Ambient Mesh' : undefined}></AmbientBadge>
        )}
      </>
    );
  };

  private renderLabels = (ns: NamespaceInfo): React.ReactNode => {
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
  };

  private renderIstioConfigStatus = (ns: NamespaceInfo): React.ReactNode => {
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
  };

  private load = (): void => {
    this.promises.cancelAll();

    const cluster = this.props.targetCluster;
    const namespace = this.props.targetNamespace;
    API.getNamespaceInfo(namespace, cluster)
      .then(result => {
        const nsInfo = result.data;
        if (!nsInfo) {
          AlertUtils.add(`Failed to find |${cluster}:${namespace}| in GetNamespaceInfo() result`);
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
        console.debug('Ignore missing namespace when loading target panel, likely deleted.', err);
      });

    this.setState({ loading: true });
  };

  private fetchHealthStatus = async (): Promise<void> => {
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
  };

  private fetchMetrics = async (direction: DirectionType): Promise<void> => {
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

    const cluster = this.props.targetCluster;
    const namespace = this.props.targetNamespace;

    return API.getNamespaceMetrics(namespace, options, cluster)
      .then(rs => {
        const metrics: Metric[] = rs.data.request_count as Metric[];
        const errorMetrics: Metric[] = rs.data.request_error_count as Metric[];

        this.setState(
          direction === 'inbound'
            ? { errorMetricsInbound: errorMetrics, metricsInbound: metrics }
            : { errorMetricsOutbound: errorMetrics, metricsOutbound: metrics }
        );
      })
      .catch(err => this.handleApiError(`Could not fetch ${direction} metrics for namespace [${namespace}]`, err));
  };

  private handleApiError = (message: string, error: ApiError): void => {
    FilterHelper.handleError(`${message}: ${API.getErrorString(error)}`);
  };

  private renderCharts = (direction: DirectionType): React.ReactNode => {
    if (this.state.status) {
      const namespace = this.props.targetNamespace;

      return (
        <OverviewCardDataPlaneNamespace
          key={`${namespace}-${direction}`}
          duration={this.props.duration}
          direction={direction}
          metrics={direction === 'inbound' ? this.state.metricsInbound : this.state.metricsOutbound}
          errorMetrics={direction === 'inbound' ? this.state.errorMetricsInbound : this.state.errorMetricsOutbound}
        />
      );
    }

    return <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>Namespace metrics are not available</div>;
  };

  private renderStatus = (): React.ReactNode => {
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
      <div className={titleStyle} data-test={`overview-type-${healthType}`}>
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
  };

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

    router.navigate(destination);
  };
}
