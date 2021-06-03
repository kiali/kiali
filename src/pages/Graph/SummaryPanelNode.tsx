import * as React from 'react';
import { connect } from 'react-redux';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { renderDestServicesLinks, renderBadgedLink, renderHealth, renderBadgedHost } from './SummaryLink';
import { NodeType, SummaryPanelPropType, DecoratedGraphNodeData, DestService } from '../../types/Graph';
import { summaryHeader, summaryPanel, summaryBodyTabs, summaryFont } from './SummaryPanelCommon';
import { decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import { getOptions, clickHandler } from 'components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import { Dropdown, DropdownGroup, DropdownItem, DropdownPosition, KebabToggle, Tab } from '@patternfly/react-core';
import { KialiAppState } from 'store/Store';
import { SummaryPanelNodeTraffic } from './SummaryPanelNodeTraffic';
import SummaryPanelNodeTraces from './SummaryPanelNodeTraces';
import SimpleTabs from 'components/Tab/SimpleTabs';
import { JaegerState } from 'reducers/JaegerState';

type SummaryPanelNodeState = {
  isActionOpen: boolean;
};

const defaultState: SummaryPanelNodeState = {
  isActionOpen: false
};

type ReduxProps = {
  jaegerState: JaegerState;
};

type SummaryPanelNodeProps = ReduxProps & SummaryPanelPropType;

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
          <div>
            {renderBadgedLink(nodeData)}
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
          </div>
          <div>{renderHealth(nodeData.health)}</div>
          <div>
            {this.renderBadgeSummary(nodeData)}
            {shouldRenderDestsList && <div>{destsList}</div>}
            {shouldRenderSvcList && <div>{servicesList}</div>}
            {shouldRenderService && <div>{renderBadgedLink(nodeData, NodeType.SERVICE)}</div>}
            {shouldRenderApp && <div>{renderBadgedLink(nodeData, NodeType.APP)}</div>}
            {shouldRenderWorkload && <div>{renderBadgedLink(nodeData, NodeType.WORKLOAD)}</div>}
          </div>
        </div>
        {shouldRenderTraces ? this.renderWithTabs(nodeData) : this.renderTrafficOnly()}
      </div>
    );
  }

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
      hasMissingSC,
      hasRequestRouting,
      hasRequestTimeout,
      hasTCPTrafficShifting,
      hasTrafficShifting,
      hasVS,
      isDead
    } = nodeData;
    const hasTrafficScenario =
      hasRequestRouting || hasFaultInjection || hasTrafficShifting || hasTCPTrafficShifting || hasRequestTimeout;
    return (
      <div style={{ marginTop: '10px', marginBottom: '10px' }}>
        {hasCB && (
          <div>
            <KialiIcon.CircuitBreaker />
            <span style={{ paddingLeft: '4px' }}>Has Circuit Breaker</span>
          </div>
        )}
        {hasVS && !hasTrafficScenario && (
          <div>
            <KialiIcon.VirtualService />
            <span style={{ paddingLeft: '4px' }}>Has Virtual Service</span>
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
          <div>
            <KialiIcon.RequestRouting />
            <span style={{ paddingLeft: '4px' }}>Has Request Routing</span>
          </div>
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
  jaegerState: state.jaegerState
});

const SummaryPanelNodeContainer = connect(mapStateToProps)(SummaryPanelNode);
export default SummaryPanelNodeContainer;
