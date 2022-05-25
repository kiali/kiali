import * as React from 'react';
import { connect } from 'react-redux';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import {
  getBadge,
  getLink,
  renderBadgedHost,
  renderBadgedLink,
  renderDestServicesLinks,
  renderHealth
} from './SummaryLink';
import { DecoratedGraphNodeData, DestService, NodeType, RankResult, SummaryPanelPropType } from '../../types/Graph';
import { summaryHeader, summaryPanel, summaryBodyTabs, summaryFont, getTitle } from './SummaryPanelCommon';
import { decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import { getOptions, clickHandler } from 'components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownPosition,
  ExpandableSection,
  KebabToggle,
  Tab
} from '@patternfly/react-core';
import { KialiAppState } from 'store/Store';
import { SummaryPanelNodeTraffic } from './SummaryPanelNodeTraffic';
import SummaryPanelNodeTraces from './SummaryPanelNodeTraces';
import SimpleTabs from 'components/Tab/SimpleTabs';
import { JaegerState } from 'reducers/JaegerState';
import { classes, style } from 'typestyle';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';

type SummaryPanelNodeState = {
  isActionOpen: boolean;
};

const defaultState: SummaryPanelNodeState = {
  isActionOpen: false
};

type ReduxProps = {
  jaegerState: JaegerState;
  rankResult: RankResult;
  showRank: boolean;
};

export type SummaryPanelNodeProps = ReduxProps & SummaryPanelPropType;

const expandableSectionStyle = style({
  fontSize: 'var(--graph-side-panel--font-size)',
  paddingLeft: '1em',
  $nest: {
    '& > div': {
      marginLeft: '2em',
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

const workloadExpandableSectionStyle = classes(expandableSectionStyle, style({ display: 'inline' }));

export class SummaryPanelNode extends React.Component<SummaryPanelNodeProps, SummaryPanelNodeState> {
  private readonly mainDivRef: React.RefObject<HTMLDivElement>;

  constructor(props: SummaryPanelNodeProps) {
    super(props);

    this.state = { ...defaultState };
    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  componentDidUpdate(prevProps: SummaryPanelNodeProps) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      if (this.mainDivRef.current) {
        this.mainDivRef.current.scrollTop = 0;
      }
    }
  }

  render() {
    const node = this.props.data.summaryTarget;
    const nodeData = decoratedNodeData(node);
    const { nodeType, app, service, workload, isServiceEntry } = nodeData;
    const servicesList = nodeType !== NodeType.SERVICE && renderDestServicesLinks(node);
    const destsList = nodeType === NodeType.SERVICE && isServiceEntry && this.renderDestServices(nodeData);

    const shouldRenderDestsList = destsList && destsList.length > 0;
    const shouldRenderSvcList = servicesList && servicesList.length > 0;
    const shouldRenderService = service && ![NodeType.SERVICE, NodeType.UNKNOWN].includes(nodeType);
    const shouldRenderApp = app && ![NodeType.APP, NodeType.UNKNOWN].includes(nodeType);
    const shouldRenderWorkload = workload && ![NodeType.WORKLOAD, NodeType.UNKNOWN].includes(nodeType);
    const shouldRenderTraces =
      !isServiceEntry &&
      !nodeData.isInaccessible &&
      this.props.jaegerState.info &&
      this.props.jaegerState.info.enabled &&
      this.props.jaegerState.info.integration;

    const options = getOptions(nodeData, this.props.jaegerState.info).map(o => {
      return (
        <DropdownItem key={o.text} onClick={() => clickHandler(o)}>
          {o.text} {o.target === '_blank' && <ExternalLinkAltIcon />}
        </DropdownItem>
      );
    });
    const actions =
      options.length > 0 ? [<DropdownGroup label="Show" className="kiali-group-menu" children={options} />] : undefined;

    return (
      <div ref={this.mainDivRef} className={`panel panel-default ${summaryPanel}`}>
        <div className="panel-heading" style={summaryHeader}>
          {getTitle(nodeType)}
          <div>
            <span>
              <PFBadge badge={PFBadges.Namespace} size="sm" style={{ marginBottom: '2px' }} />
              {nodeData.namespace}
              {actions && (
                <Dropdown
                  id="summary-node-actions"
                  style={{ float: 'right' }}
                  isPlain={true}
                  dropdownItems={actions}
                  isOpen={this.state.isActionOpen}
                  position={DropdownPosition.right}
                  toggle={<KebabToggle id="summary-node-kebab" onToggle={this.onToggleActions} />}
                />
              )}
              {renderBadgedLink(nodeData)}
              {renderHealth(nodeData.health)}
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

  private renderWorkloadSection = (nodeData: DecoratedGraphNodeData) => {
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

  private renderGatewayHostnames = (nodeData: DecoratedGraphNodeData) => {
    if (nodeData.isGateway?.ingressInfo?.hostnames && nodeData.isGateway?.ingressInfo?.hostnames.length > 0) {
      return this.renderHostnamesSection(nodeData.isGateway?.ingressInfo?.hostnames);
    }

    if (nodeData.isGateway?.egressInfo?.hostnames && nodeData.isGateway?.egressInfo?.hostnames.length > 0) {
      return this.renderHostnamesSection(nodeData.isGateway?.egressInfo?.hostnames);
    }

    return null;
  };

  private renderVsHostnames = (nodeData: DecoratedGraphNodeData) => {
    return this.renderHostnamesSection(nodeData.hasVS?.hostnames!);
  };

  private renderHostnamesSection = (hostnames: string[]) => {
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

  private renderTrafficOnly() {
    return (
      <div className="panel-body">
        <SummaryPanelNodeTraffic {...this.props} />
      </div>
    );
  }

  private renderWithTabs(nodeData: DecoratedGraphNodeData) {
    return (
      <div className={summaryBodyTabs}>
        <SimpleTabs id="graph_summary_tabs" defaultTab={0} style={{ paddingBottom: '10px' }}>
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

  private onToggleActions = isOpen => {
    this.setState({ isActionOpen: isOpen });
  };

  // TODO:(see https://github.com/kiali/kiali-design/issues/63) If we want to show an icon for SE uncomment below
  private renderBadgeSummary = (nodeData: DecoratedGraphNodeData) => {
    const {
      hasCB,
      hasFaultInjection,
      hasMirroring,
      hasMissingSC,
      hasRequestRouting,
      hasRequestTimeout,
      hasTCPTrafficShifting,
      hasTrafficShifting,
      hasVS,
      isDead,
      isGateway
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
      (nodeData.isGateway?.egressInfo?.hostnames !== undefined && nodeData.isGateway.egressInfo.hostnames.length !== 0);
    const shouldRenderVsHostnames = nodeData.hasVS?.hostnames !== undefined && nodeData.hasVS?.hostnames.length !== 0;
    const shouldRenderRank = this.props.showRank;
    return (
      <div style={{ marginTop: '10px', marginBottom: '10px' }}>
        {hasCB && (
          <div>
            <KialiIcon.CircuitBreaker />
            <span style={{ paddingLeft: '4px' }}>Has Circuit Breaker</span>
          </div>
        )}
        {hasVS && !hasTrafficScenario && (
          <>
            <div>
              <KialiIcon.VirtualService />
              <span style={{ paddingLeft: '4px' }}>Has Virtual Service</span>
            </div>
            {shouldRenderVsHostnames && this.renderVsHostnames(nodeData)}
          </>
        )}
        {hasMirroring && (
          <div>
            <KialiIcon.Mirroring />
            <span style={{ paddingLeft: '4px' }}>Has Mirroring</span>
          </div>
        )}
        {hasMissingSC && (
          <div>
            <KialiIcon.MissingSidecar />
            <span style={{ paddingLeft: '4px' }}>Has Missing Sidecar</span>
          </div>
        )}
        {isDead && (
          <div>
            <span style={{ marginRight: '5px' }}>
              <KialiIcon.Info />
            </span>
            <span style={{ paddingLeft: '4px' }}>Has No Running Pods</span>
          </div>
        )}
        {hasRequestRouting && (
          <>
            <div>
              <KialiIcon.RequestRouting />
              <span style={{ paddingLeft: '4px' }}>Has Request Routing</span>
            </div>
            {shouldRenderVsHostnames && this.renderVsHostnames(nodeData)}
          </>
        )}
        {hasFaultInjection && (
          <div>
            <KialiIcon.FaultInjection />
            <span style={{ paddingLeft: '4px' }}>Has Fault Injection</span>
          </div>
        )}
        {hasTrafficShifting && (
          <div>
            <KialiIcon.TrafficShifting />
            <span style={{ paddingLeft: '4px' }}>Has Traffic Shifting</span>
          </div>
        )}
        {hasTCPTrafficShifting && (
          <div>
            <KialiIcon.TrafficShifting />
            <span style={{ paddingLeft: '4px' }}>Has TCP Traffic Shifting</span>
          </div>
        )}
        {hasRequestTimeout && (
          <div>
            <KialiIcon.RequestTimeout />
            <span style={{ paddingLeft: '4px' }}>Has Request Timeout</span>
          </div>
        )}
        {isGateway && (
          <>
            <div>
              <KialiIcon.Gateway />
              <span style={{ paddingLeft: '4px' }}>Is Gateway</span>
            </div>
            {shouldRenderGatewayHostnames && this.renderGatewayHostnames(nodeData)}
          </>
        )}
        {shouldRenderRank && (
          <div>
            <KialiIcon.Rank />
            <span style={{ paddingLeft: '4px' }}>
              Rank: {nodeData.rank !== undefined ? `${nodeData.rank} / ${this.props.rankResult.upperBound}` : 'N/A'}
            </span>
          </div>
        )}
      </div>
    );
  };

  private renderDestServices = (data: DecoratedGraphNodeData) => {
    const destServices: DestService[] | undefined = data.destServices;

    const entries: any[] = [];
    if (!destServices) {
      return entries;
    }

    destServices.forEach(ds => {
      entries.push(renderBadgedHost(ds.name));
    });

    return entries;
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  jaegerState: state.jaegerState,
  rankResult: state.graph.rankResult,
  showRank: state.graph.toolbarState.showRank
});

const SummaryPanelNodeContainer = connect(mapStateToProps)(SummaryPanelNode);
export default SummaryPanelNodeContainer;
