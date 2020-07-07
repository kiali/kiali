import * as React from 'react';
import { ThunkDispatch } from 'redux-thunk';
import { renderDestServicesLinks, renderBadgedLink, renderHealth, renderBadgedHost } from './SummaryLink';
import { NodeType, SummaryPanelPropType, DecoratedGraphNodeData } from '../../types/Graph';
import {
  shouldRefreshData,
  updateHealth,
  summaryHeader,
  summaryPanel,
  summaryBodyTabs,
  summaryFont
} from './SummaryPanelCommon';
import { Health } from '../../types/Health';
import { decoratedNodeData } from '../../components/CytoscapeGraph/CytoscapeGraphUtils';
import { KialiIcon } from 'config/KialiIcon';
import { getOptions, clickHandler } from 'components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import { Dropdown, DropdownItem, DropdownPosition, KebabToggle, Tab } from '@patternfly/react-core';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { JaegerInfo } from 'types/JaegerInfo';
import { SummaryPanelNodeTraffic } from './SummaryPanelNodeTraffic';
import { SummaryPanelNodeTraces } from './SummaryPanelNodeTraces';
import SimpleTabs from 'components/Tab/SimpleTabs';
import { hasExperimentalFlag } from 'utils/SearchParamUtils';
import { KialiAppAction } from 'actions/KialiAppAction';
import { JaegerThunkActions } from 'actions/JaegerThunkActions';

type SummaryPanelNodeState = {
  healthLoading: boolean;
  health?: Health;
  isActionOpen: boolean;
};

const defaultState: SummaryPanelNodeState = {
  healthLoading: false,
  isActionOpen: false
};

type ReduxProps = {
  jaegerInfo?: JaegerInfo;
  setTraceId: (traceId?: string) => void;
};

type SummaryPanelNodeProps = ReduxProps & SummaryPanelPropType;

export class SummaryPanelNode extends React.Component<SummaryPanelNodeProps, SummaryPanelNodeState> {
  private readonly mainDivRef: React.RefObject<HTMLDivElement>;

  constructor(props: SummaryPanelNodeProps) {
    super(props);

    this.state = { ...defaultState };
    this.mainDivRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
  }

  componentDidUpdate(prevProps: SummaryPanelNodeProps) {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      if (this.mainDivRef.current) {
        this.mainDivRef.current.scrollTop = 0;
      }
    }
    if (shouldRefreshData(prevProps, this.props)) {
      updateHealth(this.props.data.summaryTarget, this.setState.bind(this));
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
      nodeType === NodeType.SERVICE &&
      !nodeData.isInaccessible &&
      this.props.jaegerInfo &&
      this.props.jaegerInfo.enabled &&
      this.props.jaegerInfo.integration &&
      hasExperimentalFlag('igt');

    const actions = getOptions(nodeData, this.props.jaegerInfo).map(o => {
      return (
        <DropdownItem key={o.text} onClick={() => clickHandler(o)}>
          {o.text}
        </DropdownItem>
      );
    });

    return (
      <div ref={this.mainDivRef} className={`panel panel-default ${summaryPanel}`}>
        <div className="panel-heading" style={summaryHeader}>
          <div>
            {renderBadgedLink(nodeData)}
            {!(nodeData.isInaccessible || nodeType === NodeType.AGGREGATE) && (
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
          <div>{renderHealth(this.state.health)}</div>
          <div>
            {this.renderBadgeSummary(nodeData.hasCB, nodeData.hasVS, nodeData.hasMissingSC, nodeData.isDead)}
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
            <SummaryPanelNodeTraces
              namespace={nodeData.namespace}
              service={nodeData.service!}
              jaegerInfo={this.props.jaegerInfo}
              queryTime={this.props.queryTime}
              setTraceId={this.props.setTraceId}
            />
          </Tab>
        </SimpleTabs>
      </div>
    );
  }

  private onToggleActions = isOpen => {
    this.setState({ isActionOpen: isOpen });
  };

  // TODO:(see https://github.com/kiali/kiali-design/issues/63) If we want to show an icon for SE uncomment below
  private renderBadgeSummary = (hasCB?: boolean, hasVS?: boolean, hasMissingSC?: boolean, isDead?: boolean) => {
    return (
      <div style={{ marginTop: '10px', marginBottom: '10px' }}>
        {hasCB && (
          <div>
            <KialiIcon.CircuitBreaker />
            <span style={{ paddingLeft: '4px' }}>Has Circuit Breaker</span>
          </div>
        )}
        {hasVS && (
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
      </div>
    );
  };

  private renderDestServices = (data: DecoratedGraphNodeData) => {
    const destServices = data.destServices;

    const entries: any[] = [];
    if (!destServices) {
      return entries;
    }

    destServices.forEach(ds => {
      const service = ds.name;
      const displayName = service;
      entries.push(renderBadgedHost(displayName));
    });

    return entries;
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  jaegerInfo: state.jaegerState.info
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setTraceId: (traceId?: string) => dispatch(JaegerThunkActions.fetchTrace(traceId))
});

const SummaryPanelNodeContainer = connect(mapStateToProps, mapDispatchToProps)(SummaryPanelNode);
export default SummaryPanelNodeContainer;
