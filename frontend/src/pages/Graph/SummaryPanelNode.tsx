import * as React from 'react';
import {
  getBadge,
  getLink,
  renderBadgedHost,
  renderBadgedLink,
  renderDestServicesLinks,
  renderHealth
} from './SummaryLink';
import { DecoratedGraphNodeData, DestService, NodeType, RankResult, SummaryPanelPropType } from '../../types/Graph';
import { getTitle, summaryBodyTabs, summaryFont, summaryPanel } from './SummaryPanelCommon';
import { decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import { clickHandler, getOptions } from 'components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  ExpandableSection,
  MenuToggle,
  MenuToggleElement,
  Tab
} from '@patternfly/react-core';
import { SummaryPanelNodeTraffic } from './SummaryPanelNodeTraffic';
import { SummaryPanelNodeTraces } from './SummaryPanelNodeTraces';
import { SimpleTabs } from 'components/Tab/SimpleTabs';
import { TracingState } from 'reducers/TracingState';
import { classes } from 'typestyle';
import { kialiStyle } from 'styles/StyleUtils';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { ServiceDetailsInfo } from 'types/ServiceInfo';
import { LoadingWizardActionsDropdownGroup } from 'components/IstioWizards/LoadingWizardActionsDropdownGroup';
import { WizardAction, WizardMode } from 'components/IstioWizards/WizardActions';
import { ServiceWizardActionsDropdownGroup } from 'components/IstioWizards/ServiceWizardActionsDropdownGroup';
import { PeerAuthentication } from '../../types/IstioObjects';
import { useServiceDetailForGraphNode } from '../../hooks/services';
import { useKialiSelector } from '../../hooks/redux';
import { groupMenuStyle, kebabToggleStyle } from 'styles/DropdownStyles';
import { isMultiCluster, serverConfig } from '../../config';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from './SummaryPanelStyle';

type SummaryPanelNodeState = {
  isActionOpen: boolean;
};

const defaultState: SummaryPanelNodeState = {
  isActionOpen: false
};

type ReduxProps = {
  kiosk: string;
  rankResult: RankResult;
  showRank: boolean;
  tracingState: TracingState;
};

export type SummaryPanelNodeProps = Omit<SummaryPanelPropType, 'kiosk'> & {
  onDeleteTrafficRouting?: (key: string, serviceDetails: ServiceDetailsInfo) => void;
  onLaunchWizard?: (
    key: WizardAction,
    mode: WizardMode,
    namespace: string,
    serviceDetails: ServiceDetailsInfo,
    gateways: string[],
    peerAuths: PeerAuthentication[]
  ) => void;
};

export type SummaryPanelNodeComponentProps = ReduxProps &
  SummaryPanelNodeProps & {
    gateways: string[] | null;
    onKebabToggled?: (isOpen: boolean) => void;
    peerAuthentications: PeerAuthentication[] | null;
    serviceDetails: ServiceDetailsInfo | null | undefined;
  };

const expandableSectionStyle = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  paddingLeft: '1rem',
  $nest: {
    '& > div': {
      marginLeft: '2rem',
      marginTop: '0 !important',
      $nest: {
        '& div': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }
      }
    }
  }
});

const nodeInfoStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  marginTop: '0.25rem'
});

const workloadExpandableSectionStyle = classes(expandableSectionStyle, kialiStyle({ display: 'inline' }));

export class SummaryPanelNodeComponent extends React.Component<SummaryPanelNodeComponentProps, SummaryPanelNodeState> {
  private readonly mainDivRef: React.RefObject<HTMLDivElement>;

  constructor(props: SummaryPanelNodeComponentProps) {
    super(props);

    this.state = { ...defaultState };
    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  componentDidUpdate(prevProps: SummaryPanelNodeComponentProps): void {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      if (this.mainDivRef.current) {
        this.mainDivRef.current.scrollTop = 0;
      }
    }
  }

  render(): React.ReactNode {
    const node = this.props.data.summaryTarget;
    const nodeData = this.props.data.isPF ? node.getData() : decoratedNodeData(node);
    const { nodeType, app, service, workload, isServiceEntry } = nodeData;
    const servicesList = nodeType !== NodeType.SERVICE && renderDestServicesLinks(nodeData);
    const destsList = nodeType === NodeType.SERVICE && isServiceEntry && this.renderDestServices(nodeData);

    const shouldRenderDestsList = destsList && destsList.length > 0;
    const shouldRenderSvcList = servicesList && servicesList.length > 0;
    const shouldRenderService = service && ![NodeType.SERVICE, NodeType.UNKNOWN].includes(nodeType);
    const shouldRenderApp = app && ![NodeType.APP, NodeType.UNKNOWN].includes(nodeType);
    const shouldRenderWorkload = workload && ![NodeType.WORKLOAD, NodeType.UNKNOWN].includes(nodeType);
    const shouldRenderTraces =
      !isServiceEntry &&
      !nodeData.isInaccessible &&
      this.props.tracingState.info &&
      this.props.tracingState.info.enabled &&
      this.props.tracingState.info.integration;

    const options = getOptions(nodeData);
    const items = [
      <DropdownGroup key="show" label="Show" className={groupMenuStyle}>
        {options.map((o, i) => {
          return (
            <DropdownItem key={`option-${i}`} onClick={() => clickHandler(o, this.props.kiosk)}>
              {o.text} {o.target === '_blank' && <KialiIcon.ExternalLink />}
            </DropdownItem>
          );
        })}
      </DropdownGroup>
    ];

    if (nodeType === NodeType.SERVICE) {
      if (this.props.serviceDetails === undefined) {
        items.push(<LoadingWizardActionsDropdownGroup />);
      } else if (this.props.serviceDetails !== null) {
        items.push(
          <ServiceWizardActionsDropdownGroup
            virtualServices={this.props.serviceDetails.virtualServices ?? []}
            destinationRules={this.props.serviceDetails.destinationRules ?? []}
            k8sHTTPRoutes={this.props.serviceDetails.k8sHTTPRoutes ?? []}
            istioPermissions={this.props.serviceDetails.istioPermissions}
            onAction={this.handleLaunchWizard}
            onDelete={this.handleDeleteTrafficRouting}
          />
        );
      }
    }

    const firstBadge = isMultiCluster ? (
      <>
        <PFBadge badge={PFBadges.Cluster} size="sm" />
        {nodeData.cluster}
      </>
    ) : (
      <>
        <PFBadge badge={PFBadges.Namespace} size="sm" />
        {nodeData.namespace}
      </>
    );

    const secondBadge = isMultiCluster ? (
      <div>
        <PFBadge badge={PFBadges.Namespace} size="sm" />
        {nodeData.namespace}
      </div>
    ) : (
      <></>
    );

    return (
      <div ref={this.mainDivRef} className={classes(panelStyle, summaryPanel)}>
        <div className={panelHeadingStyle}>
          {getTitle(nodeType)}

          <div>
            <span>
              {firstBadge}

              {options.length > 0 && (
                <Dropdown
                  id="summary-node-actions"
                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      id="summary-node-kebab"
                      className={kebabToggleStyle}
                      aria-label="Actions"
                      variant="plain"
                      onClick={() => this.onToggleActions(!this.state.isActionOpen)}
                      isExpanded={this.state.isActionOpen}
                      style={{ float: 'right' }}
                    >
                      <KialiIcon.KebabToggle />
                    </MenuToggle>
                  )}
                  isOpen={this.state.isActionOpen}
                  onOpenChange={(isOpen: boolean) => this.onToggleActions(isOpen)}
                  popperProps={{ position: 'right', enableFlip: true }}
                >
                  <DropdownList>{items}</DropdownList>
                </Dropdown>
              )}

              {secondBadge}

              <div className={nodeInfoStyle}>
                {renderBadgedLink(nodeData)}
                {renderHealth(nodeData.health)}
              </div>
            </span>
          </div>

          <div>
            {this.renderBadgeSummary(nodeData)}
            {shouldRenderDestsList && <div>{destsList}</div>}
            {shouldRenderSvcList && <div>{servicesList}</div>}
            {shouldRenderService && <div>{renderBadgedLink(nodeData, NodeType.SERVICE)}</div>}
            {shouldRenderApp && <div>{renderBadgedLink(nodeData, NodeType.APP)}</div>}
            {shouldRenderWorkload && this.renderWorkloadSection(nodeData)}
          </div>
        </div>

        {shouldRenderTraces ? this.renderWithTabs(nodeData) : this.renderTrafficOnly()}
      </div>
    );
  }

  private renderWorkloadSection = (nodeData: DecoratedGraphNodeData): React.ReactNode => {
    if (!nodeData.hasWorkloadEntry) {
      return <div>{renderBadgedLink(nodeData, NodeType.WORKLOAD)}</div>;
    }

    const workloadEntryLinks = nodeData.hasWorkloadEntry.map(we => (
      <div>
        {getLink(nodeData, NodeType.WORKLOAD, () => ({
          link: `/namespaces/${encodeURIComponent(nodeData.namespace)}/istio/workloadentries/${encodeURIComponent(
            we.name
          )}`,
          displayName: we.name,
          key: `${nodeData.namespace}.wle.${we.name}`
        }))}
      </div>
    ));

    return (
      <>
        {getBadge(nodeData, NodeType.WORKLOAD)}

        <ExpandableSection
          toggleText={
            nodeData.hasWorkloadEntry.length === 1
              ? '1 workload entry'
              : `${nodeData.hasWorkloadEntry.length} workload entries`
          }
          className={workloadExpandableSectionStyle}
        >
          <div style={{ marginLeft: '3.5em' }}>{workloadEntryLinks}</div>
        </ExpandableSection>
      </>
    );
  };

  private renderGatewayHostnames = (nodeData: DecoratedGraphNodeData): React.ReactNode => {
    if (nodeData.isGateway?.ingressInfo?.hostnames && nodeData.isGateway?.ingressInfo?.hostnames.length > 0) {
      return this.renderHostnamesSection(nodeData.isGateway?.ingressInfo?.hostnames);
    }

    if (nodeData.isGateway?.egressInfo?.hostnames && nodeData.isGateway?.egressInfo?.hostnames.length > 0) {
      return this.renderHostnamesSection(nodeData.isGateway?.egressInfo?.hostnames);
    }

    if (nodeData.isGateway?.gatewayAPIInfo?.hostnames && nodeData.isGateway?.gatewayAPIInfo?.hostnames.length > 0) {
      return this.renderHostnamesSection(nodeData.isGateway?.gatewayAPIInfo?.hostnames);
    }

    return null;
  };

  private renderVsHostnames = (nodeData: DecoratedGraphNodeData): React.ReactNode => {
    return this.renderHostnamesSection(nodeData.hasVS?.hostnames!);
  };

  private renderHostnamesSection = (hostnames: string[]): React.ReactNode => {
    const numberOfHostnames = hostnames.length;
    let toggleText = `${numberOfHostnames} hosts`;

    if (numberOfHostnames === 1) {
      toggleText = '1 host';
    }

    return (
      <ExpandableSection toggleText={toggleText} className={expandableSectionStyle}>
        {hostnames.map(hostname => (
          <div key={hostname} title={hostname}>
            {hostname === '*' ? '* (all hosts)' : hostname}
          </div>
        ))}
      </ExpandableSection>
    );
  };

  private renderTrafficOnly(): React.ReactNode {
    return (
      <div className={panelBodyStyle}>
        <SummaryPanelNodeTraffic {...this.props} />
      </div>
    );
  }

  private renderWithTabs(nodeData: DecoratedGraphNodeData): React.ReactNode {
    return (
      <div className={summaryBodyTabs}>
        <SimpleTabs id="graph_summary_tabs" defaultTab={0} style={{ paddingBottom: '0.5rem' }}>
          <Tab style={summaryFont} title="Traffic" eventKey={0}>
            <div style={summaryFont}>
              <SummaryPanelNodeTraffic {...this.props} />
            </div>
          </Tab>

          <Tab style={summaryFont} title="Traces" eventKey={1}>
            <SummaryPanelNodeTraces nodeData={nodeData} queryTime={this.props.queryTime - this.props.duration} />
          </Tab>
        </SimpleTabs>
      </div>
    );
  }

  private onToggleActions = (isOpen: boolean): void => {
    this.setState({ isActionOpen: isOpen });

    if (this.props.onKebabToggled) {
      this.props.onKebabToggled(isOpen);
    }
  };

  private renderK8sGatewayAPI(isK8sGatewayAPI?: boolean): React.ReactNode {
    return isK8sGatewayAPI ? ' (K8s GW API)' : '';
  }

  // TODO:(see https://github.com/kiali/kiali-design/issues/63) If we want to show an icon for SE uncomment below
  private renderBadgeSummary = (nodeData: DecoratedGraphNodeData): React.ReactNode => {
    const {
      hasCB,
      hasFaultInjection,
      hasMirroring,
      hasRequestRouting,
      hasRequestTimeout,
      hasTCPTrafficShifting,
      hasTrafficShifting,
      hasVS,
      isDead,
      isGateway,
      isK8sGatewayAPI,
      isOutOfMesh
    } = nodeData;

    const hasTrafficScenario =
      hasRequestRouting ||
      hasFaultInjection ||
      hasMirroring ||
      hasTrafficShifting ||
      hasTCPTrafficShifting ||
      hasRequestTimeout;

    const shouldRenderGatewayHostnames =
      (nodeData.isGateway?.ingressInfo?.hostnames !== undefined &&
        nodeData.isGateway.ingressInfo.hostnames.length !== 0) ||
      (nodeData.isGateway?.egressInfo?.hostnames !== undefined &&
        nodeData.isGateway.egressInfo.hostnames.length !== 0) ||
      (nodeData.isGateway?.gatewayAPIInfo?.hostnames !== undefined &&
        nodeData.isGateway.gatewayAPIInfo.hostnames.length !== 0);

    const shouldRenderVsHostnames = nodeData.hasVS?.hostnames !== undefined && nodeData.hasVS?.hostnames.length !== 0;

    const shouldRenderRank = this.props.showRank;

    return (
      <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
        {hasCB && (
          <div>
            <KialiIcon.CircuitBreaker />
            <span style={{ paddingLeft: '0.25rem' }}>
              Has Circuit Breaker{this.renderK8sGatewayAPI(isK8sGatewayAPI)}
            </span>
          </div>
        )}

        {hasVS && !hasTrafficScenario && (
          <>
            <div>
              <KialiIcon.VirtualService />
              <span style={{ paddingLeft: '0.25rem' }}>
                Has Virtual Service{this.renderK8sGatewayAPI(isK8sGatewayAPI)}
              </span>
            </div>
            {shouldRenderVsHostnames && this.renderVsHostnames(nodeData)}
          </>
        )}

        {hasMirroring && (
          <div>
            <KialiIcon.Mirroring />
            <span style={{ paddingLeft: '0.25rem' }}>Has Mirroring{this.renderK8sGatewayAPI(isK8sGatewayAPI)}</span>
          </div>
        )}

        {isOutOfMesh && !serverConfig.ambientEnabled && (
          <div>
            <KialiIcon.OutOfMesh />
            <span style={{ paddingLeft: '0.25rem' }}>Has Missing Sidecar</span>
          </div>
        )}

        {isOutOfMesh && serverConfig.ambientEnabled && (
          <div>
            <KialiIcon.OutOfMesh />
            <span style={{ paddingLeft: '0.25rem' }}>Out of Mesh</span>
          </div>
        )}

        {isDead && (
          <div>
            <span style={{ marginRight: '0.25rem' }}>
              <KialiIcon.Info />
            </span>
            <span style={{ paddingLeft: '0.25rem' }}>Has No Running Pods</span>
          </div>
        )}

        {hasRequestRouting && (
          <>
            <div>
              <KialiIcon.RequestRouting />
              <span style={{ paddingLeft: '0.25rem' }}>
                Has Request Routing{this.renderK8sGatewayAPI(isK8sGatewayAPI)}
              </span>
            </div>
            {shouldRenderVsHostnames && this.renderVsHostnames(nodeData)}
          </>
        )}

        {hasFaultInjection && (
          <div>
            <KialiIcon.FaultInjection />
            <span style={{ paddingLeft: '0.25rem' }}>
              Has Fault Injection{this.renderK8sGatewayAPI(isK8sGatewayAPI)}
            </span>
          </div>
        )}

        {hasTrafficShifting && (
          <div>
            <KialiIcon.TrafficShifting />
            <span style={{ paddingLeft: '0.25rem' }}>
              Has Traffic Shifting{this.renderK8sGatewayAPI(isK8sGatewayAPI)}
            </span>
          </div>
        )}

        {hasTCPTrafficShifting && (
          <div>
            <KialiIcon.TrafficShifting />
            <span style={{ paddingLeft: '0.25rem' }}>
              Has TCP Traffic Shifting{this.renderK8sGatewayAPI(isK8sGatewayAPI)}
            </span>
          </div>
        )}

        {hasRequestTimeout && (
          <div>
            <KialiIcon.RequestTimeout />
            <span style={{ paddingLeft: '0.25rem' }}>
              Has Request Timeout{this.renderK8sGatewayAPI(isK8sGatewayAPI)}
            </span>
          </div>
        )}

        {isGateway && (
          <>
            <div>
              <KialiIcon.Gateway />
              <span style={{ paddingLeft: '0.25rem' }}>Is Gateway{this.renderK8sGatewayAPI(isK8sGatewayAPI)}</span>
            </div>
            {shouldRenderGatewayHostnames && this.renderGatewayHostnames(nodeData)}
          </>
        )}

        {shouldRenderRank && (
          <div>
            <KialiIcon.Rank />
            <span style={{ paddingLeft: '0.25rem' }}>
              Rank: {nodeData.rank !== undefined ? `${nodeData.rank} / ${this.props.rankResult.upperBound}` : 'N/A'}
            </span>
          </div>
        )}
      </div>
    );
  };

  private renderDestServices = (data: DecoratedGraphNodeData): React.ReactNode => {
    const destServices: DestService[] | undefined = data.destServices;

    const entries: React.ReactNode[] = [];

    if (!destServices) {
      return entries;
    }

    destServices.forEach(ds => {
      entries.push(renderBadgedHost(ds.name));
    });

    return entries;
  };

  private handleLaunchWizard = (key: WizardAction, mode: WizardMode): void => {
    this.onToggleActions(false);

    if (this.props.onLaunchWizard) {
      const node = this.props.data.summaryTarget;
      const nodeData = this.props.data.isPF ? node.getData() : decoratedNodeData(node);

      this.props.onLaunchWizard(
        key,
        mode,
        nodeData.namespace,
        this.props.serviceDetails!,
        this.props.gateways!,
        this.props.peerAuthentications!
      );
    }
  };

  private handleDeleteTrafficRouting = (key: string): void => {
    this.onToggleActions(false);

    if (this.props.onDeleteTrafficRouting) {
      this.props.onDeleteTrafficRouting(key, this.props.serviceDetails!);
    }
  };
}

export const SummaryPanelNode: React.FC<SummaryPanelNodeProps> = (props: SummaryPanelNodeProps) => {
  const tracingState = useKialiSelector(state => state.tracingState);
  const kiosk = useKialiSelector(state => state.globalState.kiosk);
  const rankResult = useKialiSelector(state => state.graph.rankResult);
  const showRank = useKialiSelector(state => state.graph.toolbarState.showRank);
  const updateTime = useKialiSelector(state => state.graph.updateTime);

  const [isKebabOpen, setIsKebabOpen] = React.useState<boolean>(false);

  const node = props.data.summaryTarget;
  const nodeData = props.data.isPF ? node.getData() : decoratedNodeData(node);

  const [serviceDetails, gateways, peerAuthentications, isServiceDetailsLoading] = useServiceDetailForGraphNode(
    nodeData,
    isKebabOpen,
    props.duration,
    updateTime
  );

  const handleKebabToggled = (isOpen: boolean): void => {
    setIsKebabOpen(isOpen);
  };

  return (
    <SummaryPanelNodeComponent
      tracingState={tracingState}
      kiosk={kiosk}
      rankResult={rankResult}
      showRank={showRank}
      serviceDetails={isServiceDetailsLoading ? undefined : serviceDetails}
      gateways={gateways}
      peerAuthentications={peerAuthentications}
      onKebabToggled={handleKebabToggled}
      {...props}
    />
  );
};
