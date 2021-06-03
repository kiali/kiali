import { Radio, Dropdown, DropdownToggle, Checkbox, Tooltip, TooltipPosition } from '@patternfly/react-core';
import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { HistoryManager, URLParam } from '../../../app/History';
import { GraphToolbarState, KialiAppState } from '../../../store/Store';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { GraphType, EdgeLabelMode } from '../../../types/Graph';
import { KialiAppAction } from 'actions/KialiAppAction';
import * as _ from 'lodash';
import { edgeLabelModeSelector } from 'store/Selectors';
import {
  BoundingClientAwareComponent,
  PropertyType
} from 'components/BoundingClientAwareComponent/BoundingClientAwareComponent';
import { KialiIcon } from 'config/KialiIcon';
import {
  containerStyle,
  infoStyle,
  itemStyleWithInfo,
  itemStyleWithoutInfo,
  menuStyle,
  menuEntryStyle,
  titleStyle
} from 'styles/DropdownStyles';

type ReduxProps = {
  setEdgeLabelMode: (edgeLabelMode: EdgeLabelMode) => void;
  toggleBoxByCluster(): void;
  toggleBoxByNamespace(): void;
  toggleCompressOnHide(): void;
  toggleGraphMissingSidecars(): void;
  toggleGraphSecurity(): void;
  toggleGraphVirtualServices(): void;
  toggleIdleEdges(): void;
  toggleIdleNodes(): void;
  toggleOperationNodes(): void;
  toggleServiceNodes(): void;
  toggleTrafficAnimation(): void;
};

type GraphSettingsProps = ReduxProps &
  Omit<GraphToolbarState, 'findValue' | 'hideValue' | 'showLegend' | 'showFindHelp'>;

type GraphSettingsState = { isOpen: boolean };

interface DisplayOptionType {
  id: string;
  disabled?: boolean;
  labelText: string;
  isChecked: boolean;
  onChange?: () => void;
  tooltip?: React.ReactNode;
}

const marginBottom = 20;

class GraphSettings extends React.PureComponent<GraphSettingsProps, GraphSettingsState> {
  constructor(props: GraphSettingsProps) {
    super(props);
    this.state = {
      isOpen: false
    };

    // Let URL override current redux state at construction time. Update URL with unset params.
    const urlShowOperationNodes = HistoryManager.getBooleanParam(URLParam.OPERATION_NODES);
    if (urlShowOperationNodes !== undefined) {
      if (urlShowOperationNodes !== props.showOperationNodes) {
        props.toggleOperationNodes();
      }
    } else {
      HistoryManager.setParam(URLParam.OPERATION_NODES, String(this.props.showOperationNodes));
    }
    const urlIncludeIdleEdges = HistoryManager.getBooleanParam(URLParam.GRAPH_IDLE_EDGES);
    if (urlIncludeIdleEdges !== undefined) {
      if (urlIncludeIdleEdges !== props.showIdleEdges) {
        props.toggleIdleEdges();
      }
    } else {
      HistoryManager.setParam(URLParam.GRAPH_IDLE_EDGES, String(this.props.showIdleEdges));
    }
    const urlInjectServiceNodes = HistoryManager.getBooleanParam(URLParam.GRAPH_SERVICE_NODES);
    if (urlInjectServiceNodes !== undefined) {
      if (urlInjectServiceNodes !== props.showServiceNodes) {
        props.toggleServiceNodes();
      }
    } else {
      HistoryManager.setParam(URLParam.GRAPH_SERVICE_NODES, String(this.props.showServiceNodes));
    }
  }

  private onToggle = isOpen => {
    this.setState({
      isOpen
    });
  };

  componentDidUpdate(_prevProps: GraphSettingsProps) {
    // ensure redux state and URL are aligned
    HistoryManager.setParam(URLParam.GRAPH_IDLE_EDGES, String(this.props.showIdleEdges));
    HistoryManager.setParam(URLParam.OPERATION_NODES, String(this.props.showOperationNodes));
    HistoryManager.setParam(URLParam.GRAPH_SERVICE_NODES, String(this.props.showServiceNodes));
  }

  render() {
    return (
      <Dropdown
        toggle={
          <DropdownToggle id="display-settings" onToggle={this.onToggle}>
            Display
          </DropdownToggle>
        }
        isOpen={this.state.isOpen}
      >
        {this.getPopoverContent()}
      </Dropdown>
    );
  }

  private getPopoverContent() {
    // map our attributes from redux
    const {
      boxByCluster,
      boxByNamespace,
      compressOnHide,
      edgeLabelMode,
      showIdleEdges,
      showIdleNodes,
      showMissingSidecars,
      showOperationNodes,
      showSecurity,
      showServiceNodes,
      showTrafficAnimation,
      showVirtualServices
    } = this.props;

    // map our dispatchers for redux
    const {
      toggleBoxByCluster,
      toggleBoxByNamespace,
      toggleCompressOnHide,
      toggleGraphMissingSidecars,
      toggleGraphSecurity,
      toggleGraphVirtualServices,
      toggleIdleEdges,
      toggleIdleNodes,
      toggleOperationNodes,
      toggleServiceNodes,
      toggleTrafficAnimation
    } = this.props;

    const edgeLabelOptions: DisplayOptionType[] = [
      {
        id: EdgeLabelMode.NONE,
        labelText: _.startCase(EdgeLabelMode.NONE),
        isChecked: edgeLabelMode === EdgeLabelMode.NONE
      },
      {
        id: EdgeLabelMode.REQUEST_RATE,
        labelText: _.startCase(EdgeLabelMode.REQUEST_RATE),
        isChecked: edgeLabelMode === EdgeLabelMode.REQUEST_RATE,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            HTTP and GRPC rates are in requests-per-second. The percentage of error responses is shown below the rate,
            when non-zero. TCP rates are in bytes-sent-per-second. Rates are rounded to 2 significant digits.
          </div>
        )
      },
      {
        id: EdgeLabelMode.REQUEST_DISTRIBUTION,
        labelText: _.startCase(EdgeLabelMode.REQUEST_DISTRIBUTION),
        isChecked: edgeLabelMode === EdgeLabelMode.REQUEST_DISTRIBUTION,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            HTTP and GRPC Edges display the percentage of outbound requests for that edge. For a source node, the sum
            for outbound edges should be equal to or near 100%, given rounding. TCP edges are not included in the
            distribution because their rates reflect bytes sent, not requests sent.
          </div>
        )
      },
      {
        id: EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE,
        labelText: _.startCase(EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE),
        isChecked: edgeLabelMode === EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>Displays the 95th Percentile.</div>
            <div>
              To see other response time percentiles select the desired edge and see the side panel. The following edges
              do not offer a response time label but the information is availabe in the side panel:
            </div>
            <div>- edges into service nodes</div>
            <div>- edges into or out of operation nodes.</div>
          </div>
        )
      }
    ];

    const visibilityOptions: DisplayOptionType[] = [
      {
        id: 'boxByCluster',
        labelText: 'Cluster Boxes',
        isChecked: boxByCluster,
        onChange: toggleBoxByCluster,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <strong>Experimental:</strong> When enabled the graph will box nodes in the same cluster.
          </div>
        )
      },
      {
        id: 'boxByNamespace',
        labelText: 'Namespace Boxes',
        isChecked: boxByNamespace,
        onChange: toggleBoxByNamespace,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            When enabled the graph will box nodes in the same namespace, within the same cluster.
          </div>
        )
      },
      {
        id: 'filterHide',
        labelText: 'Compressed Hide',
        isChecked: compressOnHide,
        onChange: toggleCompressOnHide,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Compress the graph after graph-hide removes matching elements. Otherwise the graph maintains the space
            consumed by the hidden elements.
          </div>
        )
      },
      {
        id: 'filterIdleEdges',
        labelText: 'Idle Edges',
        isChecked: showIdleEdges,
        onChange: toggleIdleEdges,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Idle edges have no request traffic for the time period. Disabled by default to provide cleaner graphs.
            Enable to help detect unexpected traffic omissions, or to confirm expected edges with no traffic (due to
            routing, mirroring, etc).
          </div>
        )
      },
      {
        id: 'filterIdleNodes',
        labelText: 'Idle Nodes',
        isChecked: showIdleNodes,
        onChange: toggleIdleNodes,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            With "Idle Edges" enabled this displays nodes for defined services that have *never* received traffic. With
            "Idle Edges" disabled this displays nodes for defined services that have not received traffic during the
            current time period. Disabled by default to provide cleaner graphs. Enable to help locate unused,
            misconfigured or obsolete services.
          </div>
        )
      },
      {
        id: 'filterOperationNodes',
        disabled: this.props.graphType === GraphType.SERVICE,
        labelText: 'Operation Nodes',
        isChecked: showOperationNodes,
        onChange: toggleOperationNodes,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>
              When both operation and service nodes are enabled then the operation is displayed specific to each service
              to which it applies, and therefore may be duplicated for different services. When enabled independently
              each operation will have a single node representing the total traffic for that operation.
            </div>
            <div>- Operations with no traffic are ignored.</div>
            <div>- This is not applicable to Service graphs.</div>
            <div>
              - Operation nodes require additional "Request Classification" Istio configuration for workloads in the
              selected namespaces.
            </div>
          </div>
        )
      },
      {
        id: 'filterServiceNodes',
        disabled: this.props.graphType === GraphType.SERVICE,
        labelText: 'Service Nodes',
        isChecked: showServiceNodes,
        onChange: toggleServiceNodes,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Reflect service routing by injecting the destination service nodes into the graph. This can be useful for
            grouping requests for the same service, but routed to different workloads. Edges leading into service nodes
            are logical aggregations and will not show response time labels, but if selected the side panel will provide
            a response time chart.
          </div>
        )
      },
      {
        id: 'filterTrafficAnimation',
        labelText: 'Traffic Animation',
        isChecked: showTrafficAnimation,
        onChange: toggleTrafficAnimation,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Animate the graph to reflect traffic flow. The particle density and speed roughly reflects an edge's request
            load relevant to the other edges. Animation can be CPU intensive.
          </div>
        )
      }
    ];

    const badgeOptions: DisplayOptionType[] = [
      {
        id: 'filterSidecars',
        labelText: 'Missing Sidecars',
        isChecked: showMissingSidecars,
        onChange: toggleGraphMissingSidecars
      },
      {
        id: 'filterVS',
        labelText: 'Virtual Services',
        isChecked: showVirtualServices,
        onChange: toggleGraphVirtualServices,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>
              Show virtual service related icons. Additional icons are displayed if a circuit breaker is present on the
              virtual service or if the virtual service was created through one of the Kiali service wizards.
            </div>
          </div>
        )
      },
      {
        id: 'filterSecurity',
        labelText: 'Security',
        isChecked: showSecurity,
        onChange: toggleGraphSecurity,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>
              Show closed or open lock icons on edges with traffic that differs from the global mTLS policy. The
              percentage of mTLS traffic can be seen in the side-panel when selecting the edge. Note that the global
              masthead will show a lock icon when global mTLS is enabled. The side-panel will also display source and
              destination principals, if available.
            </div>
          </div>
        )
      }
    ];

    return (
      <BoundingClientAwareComponent
        className={containerStyle}
        maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: marginBottom }}
      >
        <div id="graph-display-menu" className={menuStyle}>
          <div className={titleStyle}>Show Edge Labels</div>
          {edgeLabelOptions.map((item: DisplayOptionType) => (
            <div key={item.id} className={menuEntryStyle}>
              <label key={item.id} className={!!item.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}>
                <Radio
                  id={item.id}
                  name="edgeLabels"
                  isChecked={item.isChecked}
                  label={item.labelText}
                  onChange={this.setEdgeLabelMode}
                  value={item.id}
                />
              </label>
              {!!item.tooltip && (
                <Tooltip key={`tooltip_${item.id}`} position={TooltipPosition.top} content={item.tooltip}>
                  <KialiIcon.Info className={infoStyle} />
                </Tooltip>
              )}
            </div>
          ))}
          <div className={titleStyle}>Show</div>
          {visibilityOptions.map((item: DisplayOptionType) => (
            <div key={item.id} style={{ display: 'inline-block' }}>
              <label key={item.id} className={!!item.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}>
                <Checkbox
                  id={item.id}
                  isChecked={item.isChecked}
                  label={item.labelText}
                  onChange={item.onChange}
                  isDisabled={item.disabled}
                />
              </label>
              {!!item.tooltip && (
                <Tooltip key={`tooltip_${item.id}`} position={TooltipPosition.top} content={item.tooltip}>
                  <KialiIcon.Info className={infoStyle} />
                </Tooltip>
              )}
            </div>
          ))}
          <div className={titleStyle}>Show Badges</div>
          {badgeOptions.map((item: DisplayOptionType) => (
            <div key={item.id} style={{ display: 'inline-block' }}>
              <label key={item.id} className={!!item.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}>
                <Checkbox id={item.id} isChecked={item.isChecked} label={item.labelText} onChange={item.onChange} />
              </label>
              {!!item.tooltip && (
                <Tooltip key={`tooltip_${item.id}`} position={TooltipPosition.top} content={item.tooltip}>
                  <KialiIcon.Info className={infoStyle} />
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      </BoundingClientAwareComponent>
    );
  }

  private setEdgeLabelMode = (_, event) => {
    const mode = event.target.value as EdgeLabelMode;
    if (this.props.edgeLabelMode !== mode) {
      this.props.setEdgeLabelMode(mode);
    }
  };
}

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  boxByCluster: state.graph.toolbarState.boxByCluster,
  boxByNamespace: state.graph.toolbarState.boxByNamespace,
  compressOnHide: state.graph.toolbarState.compressOnHide,
  edgeLabelMode: edgeLabelModeSelector(state),
  showIdleEdges: state.graph.toolbarState.showIdleEdges,
  showIdleNodes: state.graph.toolbarState.showIdleNodes,
  showMissingSidecars: state.graph.toolbarState.showMissingSidecars,
  showOperationNodes: state.graph.toolbarState.showOperationNodes,
  showSecurity: state.graph.toolbarState.showSecurity,
  showServiceNodes: state.graph.toolbarState.showServiceNodes,
  showTrafficAnimation: state.graph.toolbarState.showTrafficAnimation,
  showVirtualServices: state.graph.toolbarState.showVirtualServices
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setEdgeLabelMode: bindActionCreators(GraphToolbarActions.setEdgelLabelMode, dispatch),
    toggleBoxByCluster: bindActionCreators(GraphToolbarActions.toggleBoxByCluster, dispatch),
    toggleBoxByNamespace: bindActionCreators(GraphToolbarActions.toggleBoxByNamespace, dispatch),
    toggleCompressOnHide: bindActionCreators(GraphToolbarActions.toggleCompressOnHide, dispatch),
    toggleGraphMissingSidecars: bindActionCreators(GraphToolbarActions.toggleGraphMissingSidecars, dispatch),
    toggleGraphSecurity: bindActionCreators(GraphToolbarActions.toggleGraphSecurity, dispatch),
    toggleGraphVirtualServices: bindActionCreators(GraphToolbarActions.toggleGraphVirtualServices, dispatch),
    toggleIdleEdges: bindActionCreators(GraphToolbarActions.toggleIdleEdges, dispatch),
    toggleIdleNodes: bindActionCreators(GraphToolbarActions.toggleIdleNodes, dispatch),
    toggleOperationNodes: bindActionCreators(GraphToolbarActions.toggleOperationNodes, dispatch),
    toggleServiceNodes: bindActionCreators(GraphToolbarActions.toggleServiceNodes, dispatch),
    toggleTrafficAnimation: bindActionCreators(GraphToolbarActions.toggleTrafficAnimation, dispatch)
  };
};

// hook up to Redux for our State to be mapped to props
const GraphSettingsContainer = connect(mapStateToProps, mapDispatchToProps)(GraphSettings);
export default GraphSettingsContainer;
