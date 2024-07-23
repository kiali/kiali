import {
  Radio,
  Checkbox,
  Tooltip,
  TooltipPosition,
  Dropdown,
  DropdownList,
  MenuToggleElement,
  MenuToggle
} from '@patternfly/react-core';
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { HistoryManager, URLParam } from '../../../app/History';
import { GraphToolbarState, KialiAppState } from '../../../store/Store';
import { GraphToolbarActions } from '../../../actions/GraphToolbarActions';
import { GraphType, EdgeLabelMode, isResponseTimeMode, isThroughputMode, RankMode } from '../../../types/Graph';
import { startCase } from 'lodash-es';
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
import { INITIAL_GRAPH_STATE } from 'reducers/GraphDataState';
import { KialiDispatch } from 'types/Redux';
import { KialiCrippledFeatures } from 'types/ServerConfig';
import { getCrippledFeatures } from 'services/Api';
import { serverConfig } from '../../../config';
import { PFColors } from 'components/Pf/PfColors';

type ReduxStateProps = {
  boxByCluster: boolean;
  boxByNamespace: boolean;
  edgeLabels: EdgeLabelMode[];
  rankBy: RankMode[];
  showIdleEdges: boolean;
  showIdleNodes: boolean;
  showOperationNodes: boolean;
  showOutOfMesh: boolean;
  showRank: boolean;
  showSecurity: boolean;
  showServiceNodes: boolean;
  showTrafficAnimation: boolean;
  showVirtualServices: boolean;
  showWaypoints: boolean;
};

type ReduxDispatchProps = {
  setEdgeLabels: (edgeLabels: EdgeLabelMode[]) => void;
  setRankBy: (rankBy: RankMode[]) => void;
  toggleBoxByCluster(): void;
  toggleBoxByNamespace(): void;
  toggleGraphMissingSidecars(): void;
  toggleGraphSecurity(): void;
  toggleGraphVirtualServices(): void;
  toggleIdleEdges(): void;
  toggleIdleNodes(): void;
  toggleOperationNodes(): void;
  toggleRank(): void;
  toggleServiceNodes(): void;
  toggleTrafficAnimation(): void;
  toggleWaypoints(): void;
};

type GraphSettingsProps = ReduxStateProps &
  ReduxDispatchProps &
  Omit<GraphToolbarState, 'findValue' | 'hideValue' | 'showLegend' | 'showFindHelp' | 'trafficRates'> & {
    disabled: boolean;
  };

type GraphSettingsState = { crippledFeatures?: KialiCrippledFeatures; isOpen: boolean };

interface DisplayOptionType {
  iconClassName?: string;
  iconColor?: string;
  id: string;
  isChecked: boolean;
  isDisabled?: boolean;
  labelText: string;
  onChange?: () => void;
  tooltip?: React.ReactNode;
}

const marginBottom = 20;

class GraphSettingsComponent extends React.PureComponent<GraphSettingsProps, GraphSettingsState> {
  constructor(props: GraphSettingsProps) {
    super(props);

    this.state = {
      isOpen: false
    };

    // Let URL override current redux state at construction time. Update URL as needed.
    this.handleURLBool(
      URLParam.GRAPH_ANIMATION,
      INITIAL_GRAPH_STATE.toolbarState.showTrafficAnimation,
      props.showTrafficAnimation,
      props.toggleTrafficAnimation
    );

    this.handleURLBool(
      URLParam.GRAPH_BADGE_SECURITY,
      INITIAL_GRAPH_STATE.toolbarState.showSecurity,
      props.showSecurity,
      props.toggleGraphSecurity
    );

    this.handleURLBool(
      URLParam.GRAPH_BADGE_SIDECAR,
      INITIAL_GRAPH_STATE.toolbarState.showOutOfMesh,
      props.showOutOfMesh,
      props.toggleGraphMissingSidecars
    );

    this.handleURLBool(
      URLParam.GRAPH_BADGE_VS,
      INITIAL_GRAPH_STATE.toolbarState.showVirtualServices,
      props.showVirtualServices,
      props.toggleGraphVirtualServices
    );

    this.handleURLBool(
      URLParam.GRAPH_BOX_CLUSTER,
      INITIAL_GRAPH_STATE.toolbarState.boxByCluster,
      props.boxByCluster,
      props.toggleBoxByCluster
    );

    this.handleURLBool(
      URLParam.GRAPH_BOX_NAMESPACE,
      INITIAL_GRAPH_STATE.toolbarState.boxByNamespace,
      props.boxByNamespace,
      props.toggleBoxByNamespace
    );

    this.handleURLBool(
      URLParam.GRAPH_IDLE_EDGES,
      INITIAL_GRAPH_STATE.toolbarState.showIdleEdges,
      props.showIdleEdges,
      props.toggleIdleEdges
    );

    this.handleURLBool(
      URLParam.GRAPH_IDLE_NODES,
      INITIAL_GRAPH_STATE.toolbarState.showIdleNodes,
      props.showIdleNodes,
      props.toggleIdleNodes
    );

    this.handleURLBool(
      URLParam.GRAPH_OPERATION_NODES,
      INITIAL_GRAPH_STATE.toolbarState.showOperationNodes,
      props.showOperationNodes,
      props.toggleOperationNodes
    );

    this.handleURLBool(
      URLParam.GRAPH_RANK,
      INITIAL_GRAPH_STATE.toolbarState.showRank,
      props.showRank,
      props.toggleRank
    );

    this.handleURLBool(
      URLParam.GRAPH_SERVICE_NODES,
      INITIAL_GRAPH_STATE.toolbarState.showServiceNodes,
      props.showServiceNodes,
      props.toggleServiceNodes
    );

    this.handleURLBool(
      URLParam.GRAPH_WAYPOINTS,
      INITIAL_GRAPH_STATE.toolbarState.showWaypoints,
      props.showWaypoints,
      props.toggleWaypoints
    );
  }

  componentDidMount(): void {
    getCrippledFeatures().then(response => {
      const crippledFeatures = response.data;
      this.setState({ crippledFeatures: response.data });

      // strip away any invalid edge options from the url
      if (
        (crippledFeatures.responseTime || crippledFeatures.responseTimePercentiles) &&
        this.props.edgeLabels.some(l => isResponseTimeMode(l))
      ) {
        this.props.setEdgeLabels(this.props.edgeLabels.filter(l => !isResponseTimeMode(l)));
      }

      if (
        (crippledFeatures.requestSize && this.props.edgeLabels.includes(EdgeLabelMode.THROUGHPUT_REQUEST)) ||
        (crippledFeatures.responseSize && this.props.edgeLabels.includes(EdgeLabelMode.THROUGHPUT_RESPONSE))
      ) {
        this.props.setEdgeLabels(this.props.edgeLabels.filter(l => !isThroughputMode(l)));
      }
    });
  }

  componentDidUpdate(prev: GraphSettingsProps): void {
    // ensure redux state and URL are aligned
    this.alignURLBool(
      URLParam.GRAPH_ANIMATION,
      INITIAL_GRAPH_STATE.toolbarState.showTrafficAnimation,
      prev.showTrafficAnimation,
      this.props.showTrafficAnimation
    );

    this.alignURLBool(
      URLParam.GRAPH_BADGE_SECURITY,
      INITIAL_GRAPH_STATE.toolbarState.showSecurity,
      prev.showSecurity,
      this.props.showSecurity
    );

    this.alignURLBool(
      URLParam.GRAPH_BADGE_SIDECAR,
      INITIAL_GRAPH_STATE.toolbarState.showOutOfMesh,
      prev.showOutOfMesh,
      this.props.showOutOfMesh
    );

    this.alignURLBool(
      URLParam.GRAPH_BADGE_VS,
      INITIAL_GRAPH_STATE.toolbarState.showVirtualServices,
      prev.showVirtualServices,
      this.props.showVirtualServices
    );

    this.alignURLBool(
      URLParam.GRAPH_BOX_CLUSTER,
      INITIAL_GRAPH_STATE.toolbarState.boxByCluster,
      prev.boxByCluster,
      this.props.boxByCluster
    );

    this.alignURLBool(
      URLParam.GRAPH_BOX_NAMESPACE,
      INITIAL_GRAPH_STATE.toolbarState.boxByNamespace,
      prev.boxByNamespace,
      this.props.boxByNamespace
    );

    this.alignURLBool(
      URLParam.GRAPH_IDLE_EDGES,
      INITIAL_GRAPH_STATE.toolbarState.showIdleEdges,
      prev.showIdleEdges,
      this.props.showIdleEdges
    );

    this.alignURLBool(
      URLParam.GRAPH_IDLE_NODES,
      INITIAL_GRAPH_STATE.toolbarState.showIdleNodes,
      prev.showIdleNodes,
      this.props.showIdleNodes
    );

    this.alignURLBool(
      URLParam.GRAPH_OPERATION_NODES,
      INITIAL_GRAPH_STATE.toolbarState.showOperationNodes,
      prev.showOperationNodes,
      this.props.showOperationNodes
    );

    this.alignURLBool(
      URLParam.GRAPH_RANK,
      INITIAL_GRAPH_STATE.toolbarState.showRank,
      prev.showRank,
      this.props.showRank
    );

    this.alignURLBool(
      URLParam.GRAPH_SERVICE_NODES,
      INITIAL_GRAPH_STATE.toolbarState.showServiceNodes,
      prev.showServiceNodes,
      this.props.showServiceNodes
    );

    this.alignURLBool(
      URLParam.GRAPH_WAYPOINTS,
      INITIAL_GRAPH_STATE.toolbarState.showWaypoints,
      prev.showWaypoints,
      this.props.showWaypoints
    );
  }

  private handleURLBool = (
    param: URLParam,
    paramDefault: boolean,
    reduxValue: boolean,
    reduxToggle: () => void
  ): void => {
    const urlValue = HistoryManager.getBooleanParam(param);

    if (urlValue !== undefined) {
      if (urlValue !== reduxValue) {
        reduxToggle();
      }
    } else if (reduxValue !== paramDefault) {
      HistoryManager.setParam(param, String(reduxValue));
    }
  };

  private alignURLBool = (param: URLParam, paramDefault: boolean, prev: boolean, curr: boolean): void => {
    if (prev === curr) {
      return;
    }

    if (curr === paramDefault) {
      HistoryManager.deleteParam(param);
    } else {
      HistoryManager.setParam(param, String(curr));
    }
  };

  render(): React.ReactNode {
    return (
      <Dropdown
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            id="display-settings"
            onClick={() => this.onToggle(!this.state.isOpen)}
            isExpanded={this.state.isOpen}
            isDisabled={this.props.disabled}
          >
            Display
          </MenuToggle>
        )}
        isOpen={this.state.isOpen}
        onOpenChange={(isOpen: boolean) => this.onToggle(isOpen)}
      >
        <DropdownList>{this.getMenuOptions()}</DropdownList>
      </Dropdown>
    );
  }

  private onToggle = (isOpen: boolean): void => {
    this.setState({
      isOpen
    });
  };

  private getMenuOptions = (): React.ReactNode => {
    // map our attributes from redux
    const {
      boxByCluster,
      boxByNamespace,
      edgeLabels,
      showRank: rank,
      rankBy: rankLabels,
      showIdleEdges,
      showIdleNodes,
      showOutOfMesh,
      showOperationNodes,
      showSecurity,
      showServiceNodes,
      showTrafficAnimation,
      showVirtualServices,
      showWaypoints
    } = this.props;

    // map our dispatchers for redux
    const {
      toggleBoxByCluster,
      toggleBoxByNamespace,
      toggleGraphMissingSidecars,
      toggleGraphSecurity,
      toggleGraphVirtualServices,
      toggleIdleEdges,
      toggleIdleNodes,
      toggleOperationNodes,
      toggleRank,
      toggleServiceNodes,
      toggleTrafficAnimation,
      toggleWaypoints
    } = this.props;

    const edgeLabelOptions: DisplayOptionType[] = [
      {
        id: EdgeLabelMode.RESPONSE_TIME_GROUP,
        isChecked: edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_GROUP),
        isDisabled:
          this.state.crippledFeatures?.responseTime ||
          (this.state.crippledFeatures?.responseTimeAverage && this.state.crippledFeatures?.responseTimePercentiles),
        labelText: startCase(EdgeLabelMode.RESPONSE_TIME_GROUP),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>
              Displays the requested response time. The unit is milliseconds (ms) when less than 1000, otherwise seconds
              (s). Default: 95th Percentile.
            </div>
            <div>
              Response times only apply to request-based traffic (not TCP or gRPC messaging). Additionally, the
              following edges do not offer a response time label but the information is available in the side panel when
              selecting the edge:
            </div>
            <div>- edges into service nodes</div>
            <div>- edges into or out of operation nodes.</div>
            <div>
              This option will be disabled if response time telemetry is unavailable. Some options may be disabled for
              the same reason.
            </div>
          </div>
        )
      },
      {
        id: EdgeLabelMode.THROUGHPUT_GROUP,
        isChecked: edgeLabels.includes(EdgeLabelMode.THROUGHPUT_GROUP),
        isDisabled: this.state.crippledFeatures?.requestSize && this.state.crippledFeatures?.responseSize,
        labelText: startCase(EdgeLabelMode.THROUGHPUT_GROUP),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>
              Displays the requested HTTP Throughput. The unit is bytes-per-second (bps) when less than 1024, otherwise
              kilobytes-per-second (kps). Default: Request Throughput
            </div>
            <div>
              Throughput applies only to request-based, HTTP traffic. Additionally, the following edges do not offer a
              throughput label:
            </div>
            <div>- edges into service nodes</div>
            <div>- edges into or out of operation nodes.</div>
            <div>
              This option will be disabled if throughput telemetry is unavailable. Some options may be disabled for the
              same reason.
            </div>
          </div>
        )
      },
      {
        id: EdgeLabelMode.TRAFFIC_DISTRIBUTION,
        isChecked: edgeLabels.includes(EdgeLabelMode.TRAFFIC_DISTRIBUTION),
        labelText: startCase(EdgeLabelMode.TRAFFIC_DISTRIBUTION),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            HTTP and gRPC Edges display the percentage of traffic for that edge, when less than 100%. For a source node,
            the sum for outbound edges (per protocol) should be equal to or near 100%, given rounding. TCP edges are not
            included in the distribution because their rates reflect bytes.
          </div>
        )
      },
      {
        id: EdgeLabelMode.TRAFFIC_RATE,
        isChecked: edgeLabels.includes(EdgeLabelMode.TRAFFIC_RATE),
        labelText: startCase(EdgeLabelMode.TRAFFIC_RATE),
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            HTTP rates are in requests-per-second (rps). gRPC rates may be in requests-per-second (rps) or
            messages-per-second (mps). For request rates, the percentage of error responses is shown below the rate,
            when non-zero. TCP rates are in bytes. The unit is bytes-per-second (bps) when less than 1024, otherwise
            kilobytes-per-second (kps). Rates are rounded to 2 significant digits.
          </div>
        )
      }
    ];

    const throughputOptions: DisplayOptionType[] = [
      {
        id: EdgeLabelMode.THROUGHPUT_REQUEST,
        isChecked: edgeLabels.includes(EdgeLabelMode.THROUGHPUT_REQUEST) && !this.state.crippledFeatures?.requestSize,
        isDisabled: this.state.crippledFeatures?.requestSize,
        labelText: 'Request',
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            HTTP request data in bytes-per-second (bps) or kilobytes-per-second (kps)
          </div>
        )
      },
      {
        id: EdgeLabelMode.THROUGHPUT_RESPONSE,
        isChecked: edgeLabels.includes(EdgeLabelMode.THROUGHPUT_RESPONSE) && !this.state.crippledFeatures?.responseSize,
        isDisabled: this.state.crippledFeatures?.responseSize,
        labelText: 'Response',
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
        isDisabled: this.state.crippledFeatures?.responseTimeAverage,
        tooltip: <div style={{ textAlign: 'left' }}>Average request response time</div>
      },
      {
        id: EdgeLabelMode.RESPONSE_TIME_P50,
        labelText: 'Median',
        isChecked: edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_P50),
        isDisabled: this.state.crippledFeatures?.responseTimePercentiles,
        tooltip: <div style={{ textAlign: 'left' }}>Median request response time (50th Percentile)</div>
      },
      {
        id: EdgeLabelMode.RESPONSE_TIME_P95,
        labelText: '95th Percentile',
        isChecked: edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_P95),
        isDisabled: this.state.crippledFeatures?.responseTimePercentiles,
        tooltip: <div style={{ textAlign: 'left' }}>Max response time for 95% of requests (95th Percentile)</div>
      },
      {
        id: EdgeLabelMode.RESPONSE_TIME_P99,
        labelText: '99th Percentile',
        isChecked: edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_P99),
        isDisabled: this.state.crippledFeatures?.responseTimePercentiles,
        tooltip: <div style={{ textAlign: 'left' }}>Max response time for 99% of requests (99th Percentile)</div>
      }
    ];

    const visibilityOptions: DisplayOptionType[] = [
      {
        id: 'boxByCluster',
        isChecked: boxByCluster,
        labelText: 'Cluster Boxes',
        onChange: toggleBoxByCluster,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            When enabled and there are multiple clusters, the graph will box nodes in the same cluster. The "unknown"
            cluster is never boxed.
          </div>
        )
      },
      {
        id: 'boxByNamespace',
        isChecked: boxByNamespace,
        labelText: 'Namespace Boxes',
        onChange: toggleBoxByNamespace,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            When enabled and there are multiple namespaces, the graph will box nodes in the same namespace, within the
            same cluster. The "unknown" namespace is never boxed.
          </div>
        )
      },
      {
        id: 'filterIdleEdges',
        isChecked: showIdleEdges,
        labelText: 'Idle Edges',
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
        isChecked: showIdleNodes,
        labelText: 'Idle Nodes',
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
        isChecked: showOperationNodes,
        isDisabled: this.props.graphType === GraphType.SERVICE,
        labelText: 'Operation Nodes',
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
        id: 'rank',
        isChecked: rank,
        labelText: 'Rank',
        onChange: toggleRank,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Rank graph nodes based on configurable criteria such as 'number of inbound edges'. These rankings can be
            used in the graph find/hide feature to help highlight the most important workloads, services, and
            applications. Rankings are normalized to fit between 1..100 and nodes may tie with each other in rank.
            Ranking starts at 1 for the top ranked nodes so when ranking nodes based on 'number of inbound edges', the
            node(s) with the most inbound edges would have rank 1. Node(s) with the second most inbound edges would have
            rank 2. Each selected criteria contributes equally to a node's ranking. Although 100 rankings are possible,
            only the required number of rankings are assigned, starting at 1.
          </div>
        )
      },
      {
        id: 'filterServiceNodes',
        isChecked: showServiceNodes,
        isDisabled: this.props.graphType === GraphType.SERVICE,
        labelText: 'Service Nodes',
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
        isChecked: showTrafficAnimation,
        labelText: 'Traffic Animation',
        onChange: toggleTrafficAnimation,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            Animate the graph to reflect traffic flow. The particle density and speed roughly reflects an edge's request
            load relevant to the other edges. Animation can be CPU intensive.
          </div>
        )
      }
    ];

    if (serverConfig.ambientEnabled) {
      visibilityOptions.push({
        iconColor: PFColors.Warning,
        id: 'filterWaypoints',
        isChecked: showWaypoints,
        labelText: 'Waypoint Proxies',
        onChange: toggleWaypoints,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>[Feature under development]</div>
            <div>Show waypoint proxies workloads.</div>
            <div>
              When enabled in an Ambient environment, include waypoint proxy telemetry in the graph. Waypoint nodes will
              show up only if the underlying telemetry is being reported.
            </div>
          </div>
        )
      });
    }

    const badgeOptions: DisplayOptionType[] = [
      {
        id: 'filterSidecars',
        isChecked: showOutOfMesh,
        labelText: 'Missing Sidecars',
        onChange: toggleGraphMissingSidecars
      },
      {
        id: 'filterSecurity',
        isChecked: showSecurity,
        labelText: 'Security',
        onChange: toggleGraphSecurity,
        tooltip: (
          <div style={{ textAlign: 'left' }}>
            <div>
              Show lock icons on edges with mTLS traffic. The percentage of mTLS traffic can be seen in the side-panel
              when selecting the edge. Note that the global masthead will show a lock icon when global mTLS is enabled.
              The side-panel will also display source and destination principals, if available. mTLS status is not
              offered for gRPC-message traffic.
            </div>
          </div>
        )
      },
      {
        id: 'filterVS',
        isChecked: showVirtualServices,
        labelText: 'Virtual Services',
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

    const scoringOptions: DisplayOptionType[] = [
      {
        id: RankMode.RANK_BY_INBOUND_EDGES,
        labelText: 'Inbound Edges',
        isChecked: rankLabels.includes(RankMode.RANK_BY_INBOUND_EDGES),
        onChange: () => {
          this.toggleRankByMode(RankMode.RANK_BY_INBOUND_EDGES);
        }
      },
      {
        id: RankMode.RANK_BY_OUTBOUND_EDGES,
        labelText: 'Outbound Edges',
        isChecked: rankLabels.includes(RankMode.RANK_BY_OUTBOUND_EDGES),
        onChange: () => {
          this.toggleRankByMode(RankMode.RANK_BY_OUTBOUND_EDGES);
        }
      }
    ];

    return (
      <BoundingClientAwareComponent
        className={containerStyle}
        maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: marginBottom }}
      >
        <div id="graph-display-menu" className={menuStyle} style={{ width: '15em' }}>
          <div style={{ marginTop: '0.5rem' }}>
            <span className={titleStyle} style={{ paddingRight: 0 }}>
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
                className={edgeLabelOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
              >
                <Checkbox
                  id={edgeLabelOption.id}
                  isChecked={edgeLabelOption.isChecked}
                  isDisabled={this.props.disabled || edgeLabelOption.isDisabled}
                  key={edgeLabelOption.id}
                  label={edgeLabelOption.labelText}
                  name="edgeLabelOptions"
                  onChange={(event: React.FormEvent, _checked: boolean) => this.toggleEdgeLabelMode(event)}
                  value={edgeLabelOption.id}
                />
              </label>

              {edgeLabelOption.tooltip && (
                <Tooltip
                  key={`tooltip_${edgeLabelOption.id}`}
                  position={TooltipPosition.right}
                  content={edgeLabelOption.tooltip}
                >
                  <KialiIcon.Info
                    className={edgeLabelOption.iconClassName ?? infoStyle}
                    color={edgeLabelOption.iconColor}
                  />
                </Tooltip>
              )}

              {edgeLabelOption.id === EdgeLabelMode.RESPONSE_TIME_GROUP && responseTimeOptions.some(o => o.isChecked) && (
                <div>
                  {responseTimeOptions.map((rtOption: DisplayOptionType) => (
                    <div key={rtOption.id} className={menuEntryStyle}>
                      <label
                        key={rtOption.id}
                        className={rtOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
                        style={{ paddingLeft: '2rem' }}
                      >
                        <Radio
                          id={rtOption.id}
                          isChecked={rtOption.isChecked}
                          isDisabled={this.props.disabled || edgeLabelOption.isDisabled || rtOption.isDisabled}
                          label={rtOption.labelText}
                          name="rtOptions"
                          onChange={(event: React.FormEvent, _checked: boolean) =>
                            this.toggleEdgeLabelResponseTimeMode(event)
                          }
                          style={{ paddingLeft: '0.25rem' }}
                          value={rtOption.id}
                        />
                      </label>

                      {rtOption.tooltip && (
                        <Tooltip
                          key={`tooltip_${rtOption.id}`}
                          position={TooltipPosition.right}
                          content={rtOption.tooltip}
                        >
                          <KialiIcon.Info
                            className={edgeLabelOption.iconClassName ?? infoStyle}
                            color={edgeLabelOption.iconColor}
                          />
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
                        className={throughputOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
                        style={{ paddingLeft: '2rem' }}
                      >
                        <Radio
                          id={throughputOption.id}
                          isChecked={throughputOption.isChecked}
                          isDisabled={this.props.disabled || edgeLabelOption.isDisabled || throughputOption.isDisabled}
                          label={throughputOption.labelText}
                          name="throughputOptions"
                          onChange={(event: React.FormEvent, _checked: boolean) =>
                            this.toggleEdgeLabelThroughputMode(event)
                          }
                          style={{ paddingLeft: '0.5rem' }}
                          value={throughputOption.id}
                        />
                      </label>

                      {throughputOption.tooltip && (
                        <Tooltip
                          key={`tooltip_${throughputOption.id}`}
                          position={TooltipPosition.right}
                          content={throughputOption.tooltip}
                        >
                          <KialiIcon.Info
                            className={throughputOption.iconClassName ?? infoStyle}
                            color={throughputOption.iconColor}
                          />
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
            <div key={item.id} className={menuEntryStyle}>
              <label key={item.id} className={item.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}>
                <Checkbox
                  id={item.id}
                  isChecked={item.isChecked}
                  isDisabled={this.props.disabled || item.isDisabled}
                  label={item.labelText}
                  onChange={item.onChange}
                />
              </label>

              {item.tooltip && (
                <Tooltip key={`tooltip_${item.id}`} position={TooltipPosition.right} content={item.tooltip}>
                  <KialiIcon.Info className={item.iconClassName ?? infoStyle} color={item.iconColor} />
                </Tooltip>
              )}

              {item.id === 'rank' && rank && (
                <div>
                  {scoringOptions.map((scoringOption: DisplayOptionType) => (
                    <div key={scoringOption.id} className={menuEntryStyle}>
                      <label
                        key={scoringOption.id}
                        className={scoringOption.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}
                        style={{ paddingLeft: '2rem' }}
                      >
                        <Checkbox
                          id={scoringOption.id}
                          isChecked={scoringOption.isChecked}
                          isDisabled={this.props.disabled || item.isDisabled}
                          label={scoringOption.labelText}
                          name="scoringOptions"
                          onChange={scoringOption.onChange}
                          style={{ paddingLeft: '0.25rem' }}
                          value={scoringOption.id}
                        />
                      </label>

                      {scoringOption.tooltip && (
                        <Tooltip
                          key={`tooltip_${scoringOption.id}`}
                          position={TooltipPosition.right}
                          content={scoringOption.tooltip}
                        >
                          <KialiIcon.Info
                            className={scoringOption.iconClassName ?? infoStyle}
                            color={scoringOption.iconColor}
                          />
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className={titleStyle}>Show Badges</div>

          {badgeOptions.map((item: DisplayOptionType) => (
            <div key={item.id} className={menuEntryStyle}>
              <label key={item.id} className={item.tooltip ? itemStyleWithInfo : itemStyleWithoutInfo}>
                <Checkbox
                  id={item.id}
                  isChecked={item.isChecked}
                  isDisabled={this.props.disabled || item.isDisabled}
                  label={item.labelText}
                  onChange={item.onChange}
                />
              </label>

              {item.tooltip && (
                <Tooltip key={`tooltip_${item.id}`} position={TooltipPosition.right} content={item.tooltip}>
                  <KialiIcon.Info className={item.iconClassName ?? infoStyle} color={item.iconColor} />
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      </BoundingClientAwareComponent>
    );
  };

  private toggleEdgeLabelMode = (event: React.FormEvent): void => {
    const mode = (event.target as HTMLInputElement).value as EdgeLabelMode;

    if (this.props.edgeLabels.includes(mode)) {
      let newEdgeLabels: EdgeLabelMode[];

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
          this.props.setEdgeLabels([
            ...this.props.edgeLabels,
            mode,
            this.state.crippledFeatures?.responseSizePercentiles
              ? EdgeLabelMode.RESPONSE_TIME_AVERAGE
              : EdgeLabelMode.RESPONSE_TIME_P95
          ]);
          break;
        case EdgeLabelMode.THROUGHPUT_GROUP:
          this.props.setEdgeLabels([
            ...this.props.edgeLabels,
            mode,
            this.state.crippledFeatures?.requestSize
              ? EdgeLabelMode.THROUGHPUT_RESPONSE
              : EdgeLabelMode.THROUGHPUT_REQUEST
          ]);
          break;
        default:
          this.props.setEdgeLabels([...this.props.edgeLabels, mode]);
      }
    }
  };

  private toggleEdgeLabelResponseTimeMode = (event: React.FormEvent): void => {
    const mode = (event.target as HTMLInputElement).value as EdgeLabelMode;
    const newEdgeLabels = this.props.edgeLabels.filter(l => !isResponseTimeMode(l));
    this.props.setEdgeLabels([...newEdgeLabels, EdgeLabelMode.RESPONSE_TIME_GROUP, mode]);
  };

  private toggleEdgeLabelThroughputMode = (event: React.FormEvent): void => {
    const mode = (event.target as HTMLInputElement).value as EdgeLabelMode;
    const newEdgeLabels = this.props.edgeLabels.filter(l => !isThroughputMode(l));
    this.props.setEdgeLabels([...newEdgeLabels, EdgeLabelMode.THROUGHPUT_GROUP, mode]);
  };

  private toggleRankByMode = (mode: RankMode): void => {
    if (this.props.rankBy.includes(mode)) {
      this.props.setRankBy(this.props.rankBy.filter(r => r !== mode));
    } else {
      this.props.setRankBy([...this.props.rankBy, mode]);
    }
  };
}

// Allow Redux to map sections of our global app state to our props
const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  boxByCluster: state.graph.toolbarState.boxByCluster,
  boxByNamespace: state.graph.toolbarState.boxByNamespace,
  edgeLabels: edgeLabelsSelector(state),
  showIdleEdges: state.graph.toolbarState.showIdleEdges,
  showIdleNodes: state.graph.toolbarState.showIdleNodes,
  showOutOfMesh: state.graph.toolbarState.showOutOfMesh,
  showOperationNodes: state.graph.toolbarState.showOperationNodes,
  rankBy: state.graph.toolbarState.rankBy,
  showRank: state.graph.toolbarState.showRank,
  showSecurity: state.graph.toolbarState.showSecurity,
  showServiceNodes: state.graph.toolbarState.showServiceNodes,
  showTrafficAnimation: state.graph.toolbarState.showTrafficAnimation,
  showVirtualServices: state.graph.toolbarState.showVirtualServices,
  showWaypoints: state.graph.toolbarState.showWaypoints
});

// Map our actions to Redux
const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    setEdgeLabels: bindActionCreators(GraphToolbarActions.setEdgeLabels, dispatch),
    setRankBy: bindActionCreators(GraphToolbarActions.setRankBy, dispatch),
    toggleBoxByCluster: bindActionCreators(GraphToolbarActions.toggleBoxByCluster, dispatch),
    toggleBoxByNamespace: bindActionCreators(GraphToolbarActions.toggleBoxByNamespace, dispatch),
    toggleGraphMissingSidecars: bindActionCreators(GraphToolbarActions.toggleGraphMissingSidecars, dispatch),
    toggleGraphSecurity: bindActionCreators(GraphToolbarActions.toggleGraphSecurity, dispatch),
    toggleGraphVirtualServices: bindActionCreators(GraphToolbarActions.toggleGraphVirtualServices, dispatch),
    toggleIdleEdges: bindActionCreators(GraphToolbarActions.toggleIdleEdges, dispatch),
    toggleIdleNodes: bindActionCreators(GraphToolbarActions.toggleIdleNodes, dispatch),
    toggleOperationNodes: bindActionCreators(GraphToolbarActions.toggleOperationNodes, dispatch),
    toggleRank: bindActionCreators(GraphToolbarActions.toggleRank, dispatch),
    toggleServiceNodes: bindActionCreators(GraphToolbarActions.toggleServiceNodes, dispatch),
    toggleTrafficAnimation: bindActionCreators(GraphToolbarActions.toggleTrafficAnimation, dispatch),
    toggleWaypoints: bindActionCreators(GraphToolbarActions.toggleWaypoints, dispatch)
  };
};

// hook up to Redux for our State to be mapped to props
export const GraphSettings = connect(mapStateToProps, mapDispatchToProps)(GraphSettingsComponent);
