import { Radio, Dropdown, DropdownToggle, Checkbox, Tooltip, TooltipPosition } from '@patternfly/react-core';
import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { HistoryManager, URLParam } from '../../../app/History';
import { GraphToolbarState, KialiAppState } from '../../../store/Store';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { GraphType, EdgeLabelMode, isResponseTimeMode, isThroughputMode } from '../../../types/Graph';
import { KialiAppAction } from 'actions/KialiAppAction';
import * as _ from 'lodash';
import { edgeLabelsSelector } from 'store/Selectors';
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
  edgeLabels: EdgeLabelMode[];
  setEdgeLabels: (edgeLabels: EdgeLabelMode[]) => void;
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

type GraphSettingsState = { edgeLabelThroughputChecked: boolean; isOpen: boolean };

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
      edgeLabelThroughputChecked: false,
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
      edgeLabels,
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
        id: EdgeLabelMode.REQUEST_RATE,
        labelText: _.startCase(EdgeLabelMode.REQUEST_RATE),
        isChecked: edgeLabels.includes(EdgeLabelMode.REQUEST_RATE),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            HTTP and gRPC rates are in requests-per-second (rps). When non-zero, the percentage of error responses is
            shown below the rate. TCP rates are sent-bytes. The unit is bytes-per-second (bps) when less than 1024,
            otherwise kilobytes-per-second (kps). Rates are rounded to 2 significant digits.
          </div>
        )
      },
      {
        id: EdgeLabelMode.RESPONSE_TIME_GROUP,
        labelText: _.startCase(EdgeLabelMode.RESPONSE_TIME_GROUP),
        isChecked: edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_GROUP),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>
              Displays the requested response time. The unit is milliseconds (ms) when less than 1000, otherwise seconds
              (s). Default: 95th Percentile.
            </div>
            <div>
              The following edges do not offer a response time label but the information is available in the side panel
              when selecting the edge:
            </div>
            <div>- edges into service nodes</div>
            <div>- edges into or out of operation nodes.</div>
          </div>
        )
      },
      {
        id: EdgeLabelMode.THROUGHPUT_GROUP,
        labelText: _.startCase(EdgeLabelMode.THROUGHPUT_GROUP),
        isChecked: edgeLabels.includes(EdgeLabelMode.THROUGHPUT_GROUP),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>
              Displays the requested HTTP Throughput. The unit is bytes-per-second (bps) when less than 1024, otherwise
              kilobytes-per-second (kps). Default: Request Throughput
            </div>
            <div>The following edges do not offer a throughput label:</div>
            <div>- edges into service nodes</div>
            <div>- edges into or out of operation nodes.</div>
          </div>
        )
      },
      {
        id: EdgeLabelMode.REQUEST_DISTRIBUTION,
        labelText: _.startCase(EdgeLabelMode.REQUEST_DISTRIBUTION),
        isChecked: edgeLabels.includes(EdgeLabelMode.REQUEST_DISTRIBUTION),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            HTTP and gRPC Edges display the percentage of outbound requests for that edge, when less than 100%. For a
            source node, the sum for outbound edges (per protocol) should be equal to or near 100%, given rounding. TCP
            edges are not included in the distribution because their rates reflect bytes sent, not requests sent.
          </div>
        )
      }
    ];

    const throughputOptions: DisplayOptionType[] = [
      {
        id: EdgeLabelMode.THROUGHPUT_REQUEST,
        labelText: 'Request',
        isChecked: edgeLabels.includes(EdgeLabelMode.THROUGHPUT_REQUEST),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            HTTP request data in bytes-per-second (bps) or kilobytes-per-second (kps)
          </div>
        )
      },
      {
        id: EdgeLabelMode.THROUGHPUT_RESPONSE,
        labelText: 'Response',
        isChecked: edgeLabels.includes(EdgeLabelMode.THROUGHPUT_RESPONSE),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            HTTP response data in bytes per second (bps) or kilobytes-per-second (kps)
          </div>
        )
      }
    ];

    const responseTimeOptions: DisplayOptionType[] = [
      {
        id: EdgeLabelMode.RESPONSE_TIME_AVERAGE,
        labelText: 'Average',
        isChecked: edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_AVERAGE),
        tooltip: <div style={{ textAlign: 'left' }}>Average request response time</div>
      },
      {
        id: EdgeLabelMode.RESPONSE_TIME_P50,
        labelText: 'Median',
        isChecked: edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_P50),
        tooltip: <div style={{ textAlign: 'left' }}>Median request response time (50th Percentile)</div>
      },
      {
        id: EdgeLabelMode.RESPONSE_TIME_P95,
        labelText: '95th Percentile',
        isChecked: edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_P95),
        tooltip: <div style={{ textAlign: 'left' }}>Max response time for 95% of requests (95th Percentile)</div>
      },
      {
        id: EdgeLabelMode.RESPONSE_TIME_P99,
        labelText: '99th Percentile',
        isChecked: edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_P99),
        tooltip: <div style={{ textAlign: 'left' }}>Max response time for 99% of requests (99th Percentile)</div>
      }
    ];

    const visibilityOptions: DisplayOptionType[] = [
      {
        id: 'boxByCluster',
        labelText: 'Cluster Boxes',
        isChecked: boxByCluster,
        onChange: toggleBoxByCluster,
        tooltip: <div style={{ textAlign: 'left' }}>When enabled the graph will box nodes in the same cluster.</div>
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
      }
    ];

    return (
      <BoundingClientAwareComponent
        className={containerStyle}
        maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: marginBottom }}
      >
        <div id="graph-display-menu" className={menuStyle}>
          <div style={{ marginTop: '10px' }}>
            <span className={titleStyle} style={{ position: 'relative', bottom: '3px', paddingRight: 0 }}>
              Show Edge Labels
            </span>
            <Tooltip
              key="tooltip_show_edge_labels"
              position={TooltipPosition.right}
              content={
                <div style={{ textAlign: 'left' }}>
                  <div>
                    Values for multiple label selections are stacked in the same order as the options below. Hover or
                    selection will always show units, an additionally show protocol.
                  </div>
                </div>
              }
            >
              <KialiIcon.Info className={infoStyle} />
            </Tooltip>
          </div>
          {edgeLabelOptions.map((edgeLabelOption: DisplayOptionType) => (
            <div key={edgeLabelOption.id} className={menuEntryStyle}>
              <label
                key={edgeLabelOption.id}
                className={!!edgeLabelOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
              >
                <Checkbox
                  id={edgeLabelOption.id}
                  name="edgeLabelOptions"
                  isChecked={edgeLabelOption.isChecked}
                  label={edgeLabelOption.labelText}
                  onChange={this.toggleEdgeLabelMode}
                  value={edgeLabelOption.id}
                />
              </label>
              {!!edgeLabelOption.tooltip && (
                <Tooltip
                  key={`tooltip_${edgeLabelOption.id}`}
                  position={TooltipPosition.right}
                  content={edgeLabelOption.tooltip}
                >
                  <KialiIcon.Info className={infoStyle} />
                </Tooltip>
              )}
              {edgeLabelOption.id === EdgeLabelMode.RESPONSE_TIME_GROUP && responseTimeOptions.some(o => o.isChecked) && (
                <div>
                  {responseTimeOptions.map((rtOption: DisplayOptionType) => (
                    <div key={rtOption.id} className={menuEntryStyle}>
                      <label
                        key={rtOption.id}
                        className={!!rtOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
                        style={{ paddingLeft: '35px' }}
                      >
                        <Radio
                          id={rtOption.id}
                          style={{ paddingLeft: '5px' }}
                          name="rtOptions"
                          isChecked={rtOption.isChecked}
                          label={rtOption.labelText}
                          onChange={this.toggleEdgeLabelResponseTimeMode}
                          value={rtOption.id}
                        />
                      </label>
                      {!!rtOption.tooltip && (
                        <Tooltip
                          key={`tooltip_${rtOption.id}`}
                          position={TooltipPosition.right}
                          content={rtOption.tooltip}
                        >
                          <KialiIcon.Info className={infoStyle} />
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {edgeLabelOption.id === EdgeLabelMode.THROUGHPUT_GROUP && throughputOptions.some(o => o.isChecked) && (
                <div>
                  {throughputOptions.map((throughputOption: DisplayOptionType) => (
                    <div key={throughputOption.id} className={menuEntryStyle}>
                      <label
                        key={throughputOption.id}
                        className={!!throughputOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
                        style={{ paddingLeft: '35px' }}
                      >
                        <Radio
                          id={throughputOption.id}
                          style={{ paddingLeft: '5px' }}
                          name="throughputOptions"
                          isChecked={throughputOption.isChecked}
                          label={throughputOption.labelText}
                          onChange={this.toggleEdgeLabelThroughputMode}
                          value={throughputOption.id}
                        />
                      </label>
                      {!!throughputOption.tooltip && (
                        <Tooltip
                          key={`tooltip_${throughputOption.id}`}
                          position={TooltipPosition.right}
                          content={throughputOption.tooltip}
                        >
                          <KialiIcon.Info className={infoStyle} />
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </div>
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
                <Tooltip key={`tooltip_${item.id}`} position={TooltipPosition.right} content={item.tooltip}>
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
                <Tooltip key={`tooltip_${item.id}`} position={TooltipPosition.right} content={item.tooltip}>
                  <KialiIcon.Info className={infoStyle} />
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      </BoundingClientAwareComponent>
    );
  }

  private toggleEdgeLabelMode = (_, event) => {
    const mode = event.target.value as EdgeLabelMode;
    if (this.props.edgeLabels.includes(mode)) {
      let newEdgeLabels;
      switch (mode) {
        case EdgeLabelMode.RESPONSE_TIME_GROUP:
          newEdgeLabels = this.props.edgeLabels.filter(l => !isResponseTimeMode(l));
          break;
        case EdgeLabelMode.THROUGHPUT_GROUP:
          newEdgeLabels = this.props.edgeLabels.filter(l => !isThroughputMode(l));
          break;
        default:
          newEdgeLabels = this.props.edgeLabels.filter(l => l !== mode);
      }
      this.props.setEdgeLabels(newEdgeLabels);
    } else {
      switch (mode) {
        case EdgeLabelMode.RESPONSE_TIME_GROUP:
          this.props.setEdgeLabels([...this.props.edgeLabels, mode, EdgeLabelMode.RESPONSE_TIME_P95]);
          break;
        case EdgeLabelMode.THROUGHPUT_GROUP:
          this.props.setEdgeLabels([...this.props.edgeLabels, mode, EdgeLabelMode.THROUGHPUT_REQUEST]);
          break;
        default:
          this.props.setEdgeLabels([...this.props.edgeLabels, mode]);
      }
    }
  };

  private toggleEdgeLabelResponseTimeMode = (_, event) => {
    const mode = event.target.value as EdgeLabelMode;
    const newEdgeLabels = this.props.edgeLabels.filter(l => !isResponseTimeMode(l));
    this.props.setEdgeLabels([...newEdgeLabels, EdgeLabelMode.RESPONSE_TIME_GROUP, mode]);
  };

  private toggleEdgeLabelThroughputMode = (_, event) => {
    const mode = event.target.value as EdgeLabelMode;
    const newEdgeLabels = this.props.edgeLabels.filter(l => !isThroughputMode(l));
    this.props.setEdgeLabels([...newEdgeLabels, EdgeLabelMode.THROUGHPUT_GROUP, mode]);
  };
}

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState) => ({
  boxByCluster: state.graph.toolbarState.boxByCluster,
  boxByNamespace: state.graph.toolbarState.boxByNamespace,
  compressOnHide: state.graph.toolbarState.compressOnHide,
  edgeLabels: edgeLabelsSelector(state),
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
    setEdgeLabels: bindActionCreators(GraphToolbarActions.setEdgeLabels, dispatch),
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
