import * as React from 'react';
import { Bullseye, Spinner } from '@patternfly/react-core';
import ReactResizeDetector from 'react-resize-detector';
import {
  Controller,
  createTopologyControlButtons,
  defaultControlButtonsOptions,
  EdgeAnimationSpeed,
  EdgeModel,
  EdgeStyle,
  GraphElement,
  GraphModel,
  GRAPH_LAYOUT_END_EVENT,
  Model,
  ModelKind,
  Node,
  NodeModel,
  SELECTION_STATE,
  TopologyControlBar,
  TopologyView,
  useEventListener,
  useVisualizationState,
  Visualization,
  VisualizationProvider,
  VisualizationSurface,
  Edge,
  GraphAreaSelectedEventListener,
  GRAPH_AREA_SELECTED_EVENT,
  GraphLayoutEndEventListener
} from '@patternfly/react-topology';
import { GraphData } from 'pages/Graph/GraphPage';
import {
  BoxByType,
  EdgeLabelMode,
  EdgeMode,
  GraphEvent,
  Layout,
  NodeAttr,
  NodeType,
  RankMode,
  RankResult,
  UNKNOWN
} from 'types/Graph';
import { JaegerTrace } from 'types/TracingInfo';
import { stylesComponentFactory } from './components/stylesComponentFactory';
import { elementFactory } from './elements/elementFactory';
import {
  assignEdgeHealth,
  EdgeData,
  getNodeShape,
  getNodeStatus,
  GraphPFSettings,
  NodeData,
  setEdgeOptions,
  setNodeAttachments,
  setNodeLabel
} from './GraphPFElems';
import { elems, selectAnd, SelectAnd, setObserved } from 'helpers/GraphHelpers';
import { layoutFactory } from './layouts/layoutFactory';
import { hideTrace, showTrace } from './TracePF';
import { GraphHighlighterPF } from './GraphHighlighterPF';
import { TimeInMilliseconds } from 'types/Common';
import { KialiConcentricGraph } from 'components/CytoscapeGraph/graphs/KialiConcentricGraph';
import { KialiDagreGraph } from 'components/CytoscapeGraph/graphs/KialiDagreGraph';
import { KialiGridGraph } from 'components/CytoscapeGraph/graphs/KialiGridGraph';
import { KialiBreadthFirstGraph } from 'components/CytoscapeGraph/graphs/KialiBreadthFirstGraph';
import { HistoryManager, URLParam } from 'app/History';
import { TourStop } from 'components/Tour/TourStop';
import { GraphTourStops } from 'pages/Graph/GraphHelpTour';
import { supportsGroups } from 'utils/GraphUtils';
import { GraphRefs } from './GraphPagePF';
import { WizardAction, WizardMode } from 'components/IstioWizards/WizardActions';
import { ServiceDetailsInfo } from 'types/ServiceInfo';
import { PeerAuthentication } from 'types/IstioObjects';
import { KialiIcon } from 'config/KialiIcon';
import { toolbarActiveStyle } from 'styles/GraphStyle';
import { scoreNodes, ScoringCriteria } from 'components/CytoscapeGraph/GraphScore';
import { TrafficAnimation } from './TrafficAnimation/TrafficRendererPF';

const DEFAULT_NODE_SIZE = 40;
const ZOOM_IN = 4 / 3;
const ZOOM_OUT = 3 / 4;

export const FIT_PADDING = 90;

export enum LayoutName {
  BreadthFirst = 'BreadthFirst',
  Concentric = 'Concentric',
  Dagre = 'Dagre',
  Grid = 'Grid'
}

export enum LayoutType {
  Layout = 'layout',
  LayoutNoFit = 'layoutNoFit',
  Resize = 'resize'
}

let initialLayout = false;
let layoutInProgress: LayoutType | undefined;

export function getLayoutByName(layoutName: string): Layout {
  switch (layoutName) {
    case LayoutName.BreadthFirst:
      return KialiBreadthFirstGraph.getLayout();
    case LayoutName.Concentric:
      return KialiConcentricGraph.getLayout();
    case LayoutName.Grid:
      return KialiGridGraph.getLayout();
    default:
      return KialiDagreGraph.getLayout();
  }
}

export function graphLayout(controller: Controller, layoutType: LayoutType, reset = true): void {
  if (!controller?.hasGraph()) {
    console.debug('TG: Skip graphLayout, no graph');
    return;
  }
  if (initialLayout) {
    console.debug('TG: Skip graphLayout, initial layout not yet performed');
    return;
  }
  if (layoutInProgress) {
    console.debug('TG: Skip graphLayout, layout already in progress');
    return;
  }
  console.debug(`TG: layout in progress (layoutType=${layoutType} reset=${reset}`);
  layoutInProgress = layoutType;
  if (reset) {
    controller.getGraph().reset();
  }
  controller.getGraph().layout();
}

export interface FocusNode {
  id: string;
  isSelected?: boolean;
}

// The is the main graph rendering component
const TopologyContent: React.FC<{
  controller: Controller;
  edgeLabels: EdgeLabelMode[];
  edgeMode: EdgeMode;
  focusNode?: FocusNode;
  graphData: GraphData;
  highlighter: GraphHighlighterPF;
  isMiniGraph: boolean;
  layoutName: LayoutName;
  onDeleteTrafficRouting: (key: string, serviceDetails: ServiceDetailsInfo) => void;
  onEdgeTap?: (edge: Edge<EdgeModel>) => void;
  onLaunchWizard: (
    key: WizardAction,
    mode: WizardMode,
    namespace: string,
    serviceDetails: ServiceDetailsInfo,
    gateways: string[],
    peerAuths: PeerAuthentication[]
  ) => void;
  onNodeTap?: (node: Node<NodeModel>) => void;
  onReady: (refs: GraphRefs) => void;
  rankBy: RankMode[];
  setEdgeMode: (edgeMode: EdgeMode) => void;
  setLayout: (val: LayoutName) => void;
  setRankResult: (rankResult: RankResult) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  showLegend: boolean;
  showOutOfMesh: boolean;
  showRank: boolean;
  showSecurity: boolean;
  showTrafficAnimation: boolean;
  showVirtualServices: boolean;
  toggleLegend?: () => void;
  trace?: JaegerTrace;
  trafficAnimation: TrafficAnimation;
  updateSummary: (graphEvent: GraphEvent) => void;
}> = ({
  controller,
  edgeLabels,
  edgeMode,
  focusNode,
  graphData,
  highlighter,
  isMiniGraph,
  layoutName,
  onDeleteTrafficRouting,
  onEdgeTap,
  onNodeTap,
  onReady,
  onLaunchWizard,
  rankBy,
  setEdgeMode,
  setLayout: setLayoutName,
  setRankResult,
  setUpdateTime,
  showLegend,
  showOutOfMesh,
  showRank,
  showSecurity,
  showTrafficAnimation,
  showVirtualServices,
  toggleLegend,
  trace,
  trafficAnimation,
  updateSummary
}) => {
  const [updateModelTime, setUpdateModelTime] = React.useState(0);

  const graphSettings: GraphPFSettings = React.useMemo(() => {
    return {
      activeNamespaces: graphData.fetchParams.namespaces,
      edgeLabels: edgeLabels,
      graphType: graphData.fetchParams.graphType,
      showOutOfMesh: showOutOfMesh,
      showSecurity: showSecurity,
      showVirtualServices: showVirtualServices,
      trafficRates: graphData.fetchParams.trafficRates
    } as GraphPFSettings;
  }, [graphData.fetchParams, edgeLabels, showOutOfMesh, showSecurity, showVirtualServices]);

  //
  // SelectedIds State
  //
  const [selectedIds, setSelectedIds] = useVisualizationState<string[]>(SELECTION_STATE, []);

  // selectedRef holds the current selectedId to protect againt selecting the same element, and duplicating the
  // work below. We could also have created a separate callback to update the selectedId, first comparing against
  // "selectedIds", but 1) our code would have to remember to call it, and 2) I have seen situations where the
  // node loses its selected styling and it only comes back on a repeat selection.
  const selectedRef = React.useRef<string>();
  React.useEffect(() => {
    if (selectedIds.length > 0) {
      if (selectedRef.current === selectedIds[0]) {
        return;
      }
      selectedRef.current = selectedIds[0];
    } else {
      selectedRef.current = undefined;
    }

    if (isMiniGraph) {
      if (selectedIds.length > 0) {
        const elem = controller.getElementById(selectedIds[0]);
        switch (elem?.getKind()) {
          case ModelKind.edge: {
            if (onEdgeTap) {
              onEdgeTap(elem as Edge<EdgeModel>);
            }
            return;
          }
          case ModelKind.node: {
            if (onNodeTap) {
              onNodeTap(elem as Node<NodeModel>);
            }
            return;
          }
          default:
            updateSummary({ isPF: true, summaryType: 'graph', summaryTarget: controller } as GraphEvent);
        }
      }
      return;
    }

    if (selectedIds.length > 0) {
      const elem = controller.getElementById(selectedIds[0]);
      switch (elem?.getKind()) {
        case ModelKind.edge: {
          highlighter.setSelectedId(selectedIds[0]);
          updateSummary({ isPF: true, summaryType: 'edge', summaryTarget: elem } as GraphEvent);
          return;
        }
        case ModelKind.node: {
          highlighter.setSelectedId(selectedIds[0]);
          const isBox = (elem.getData() as NodeData).isBox;
          updateSummary({ isPF: true, summaryType: isBox ? 'box' : 'node', summaryTarget: elem } as GraphEvent);
          return;
        }
        case ModelKind.graph:
        default:
          highlighter.setSelectedId(undefined);
          setSelectedIds([]);
          updateSummary({ isPF: true, summaryType: 'graph', summaryTarget: controller } as GraphEvent);
          return;
      }
    } else {
      highlighter.setSelectedId(undefined);
      updateSummary({ isPF: true, summaryType: 'graph', summaryTarget: controller } as GraphEvent);
    }
  }, [controller, highlighter, isMiniGraph, onEdgeTap, onNodeTap, selectedIds, setSelectedIds, updateSummary]);

  //
  // TraceOverlay State
  //
  React.useEffect(() => {
    if (!controller || !controller.hasGraph()) {
      return undefined;
    }

    if (!!trace) {
      const ambient = graphData.fetchParams.trafficRates.some(rate => rate === 'ambient');
      showTrace(controller, graphData.fetchParams.graphType, ambient, trace);
    }

    return () => {
      hideTrace(controller);
    };
  }, [controller, graphData.fetchParams.graphType, graphData.fetchParams.trafficRates, trace]);

  //
  // Layout and resize handling
  //

  const handleResize = React.useCallback(() => {
    graphLayout(controller, LayoutType.Resize);
  }, [controller]);

  const onLayoutEnd = React.useCallback(() => {
    console.debug(`TG: onLayoutEnd layoutInProgress=${layoutInProgress}`);

    // If a layout was called outside of our standard mechanism, don't perform our layoutEnd actions
    if (!initialLayout && !layoutInProgress) {
      return;
    }

    if (layoutInProgress !== LayoutType.LayoutNoFit) {
      controller.getGraph().fit(FIT_PADDING);

      // On a resize, perform a delayed second fit, this one is performed [hopefully] after
      // the canvas size is updated (which needs to happen in the underlying PFT code)
      if (layoutInProgress === LayoutType.Resize) {
        setTimeout(() => {
          controller.getGraph().fit(FIT_PADDING);
        }, 500);
      }
    }

    // we need to finish the initial layout before we advertise to the outside
    // world that the graph is ready for external processing (like find/hide)
    if (initialLayout) {
      initialLayout = false;

      if (showTrafficAnimation) {
        trafficAnimation.start();
      }

      onReady({ getController: () => controller, setSelectedIds: setSelectedIds });
    }

    layoutInProgress = undefined;
  }, [controller, onReady, setSelectedIds, showTrafficAnimation, trafficAnimation]);

  //
  // Set detail levels for graph (control zoom-sensitive labels)
  //
  const setDetailsLevel = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      controller.getGraph().setDetailsLevelThresholds({
        low: 0.3,
        medium: 0.5
      });
    }
  }, [controller]);

  //
  // update model on graphData change
  //
  React.useEffect(() => {
    //
    // Reset [new] graph with initial model
    //
    const resetGraph = (): void => {
      if (controller) {
        const defaultModel: Model = {
          graph: {
            id: 'graphPF',
            layout: layoutName,
            type: 'graph'
          }
        };
        controller.fromModel(defaultModel, false);
        setDetailsLevel();
      }
    };

    //
    // Manage the GraphData / DataModel
    //
    const generateDataModel = (): { edges: EdgeModel[]; nodes: NodeModel[] } => {
      let nodeMap: Map<string, NodeModel> = new Map<string, NodeModel>();
      const edges: EdgeModel[] = [];

      const onHover = (element: GraphElement, isMouseIn: boolean): void => {
        if (isMouseIn) {
          highlighter.onMouseIn(element);
        } else {
          highlighter.onMouseOut(element);
        }
      };

      function addGroup(data: NodeData): NodeModel {
        data.onHover = onHover;
        const group: NodeModel = {
          children: [],
          collapsed: false,
          data: data,
          group: true,
          id: data.id,
          status: getNodeStatus(data),
          style: { padding: [35, 35, 35, 35] },
          type: 'group'
        };
        setNodeLabel(group, nodeMap, graphSettings, layoutName);
        nodeMap.set(data.id, group);

        return group;
      }

      function addNode(data: NodeData): NodeModel {
        data.onHover = onHover;
        const node: NodeModel = {
          data: data,
          height: DEFAULT_NODE_SIZE,
          id: data.id,
          shape: getNodeShape(data),
          status: getNodeStatus(data),
          type: 'node',
          width: DEFAULT_NODE_SIZE
        };
        setNodeLabel(node, nodeMap, graphSettings, layoutName);
        nodeMap.set(data.id, node);

        return node;
      }

      function addEdge(data: EdgeData): EdgeModel {
        data.onHover = onHover;
        const edge: EdgeModel = {
          animationSpeed: EdgeAnimationSpeed.none,
          data: data,
          edgeStyle: EdgeStyle.solid,
          id: data.id,
          source: data.source,
          target: data.target,
          type: 'edge'
        };
        setEdgeOptions(edge, nodeMap, graphSettings);
        edges.push(edge);

        return edge;
      }

      function addChild(node: NodeModel): void {
        const parentId = (node.data as NodeData).parent!;
        const parent = nodeMap.get(parentId);
        if (parent) {
          parent.children?.push(node.id);
        } else {
          console.error(`TG: Could not find parent node |${parentId}|`);
        }
      }

      graphData.elements.nodes?.forEach(n => {
        const nd = n.data;

        if (supportsGroups(layoutName)) {
          let newNode: NodeModel;

          if (nd.isBox) {
            newNode = addGroup(nd as NodeData);
          } else {
            newNode = addNode(nd as NodeData);
          }

          if (nd.parent) {
            addChild(newNode);
          }
        } else {
          if (!nd.isBox) {
            addNode(nd as NodeData);
          }
        }
      });

      // Compute rank result if enabled
      let scoringCriteria: ScoringCriteria[] = [];

      if (showRank) {
        for (const ranking of rankBy) {
          if (ranking === RankMode.RANK_BY_INBOUND_EDGES) {
            scoringCriteria.push(ScoringCriteria.InboundEdges);
          }

          if (ranking === RankMode.RANK_BY_OUTBOUND_EDGES) {
            scoringCriteria.push(ScoringCriteria.OutboundEdges);
          }
        }

        let upperBound = 0;
        ({ upperBound } = scoreNodes(graphData.elements, ...scoringCriteria));

        if (setRankResult) {
          setRankResult({ upperBound });
        }
      } else {
        scoreNodes(graphData.elements, ...scoringCriteria);
      }

      // Compute edge healths one time for the graph
      assignEdgeHealth(graphData.elements.edges || [], nodeMap, graphSettings);

      graphData.elements.edges?.forEach(e => {
        const ed = e.data;
        addEdge(ed as EdgeData);
      });

      const nodes = Array.from(nodeMap.values());
      return { nodes: nodes, edges: edges };
    };

    //
    // update model merging existing nodes / edges
    //
    const updateModel = (controller: Controller): void => {
      if (!controller) {
        return;
      }

      if (!controller.hasGraph()) {
        resetGraph();
      }

      const model = generateDataModel();
      const modelMap = new Map<string, GraphModel>();
      model.nodes.forEach(n => modelMap.set(n.id, n));
      model.edges.forEach(e => modelMap.set(e.id, e));

      controller.getElements().forEach(e => {
        const eModel = modelMap.get(e.getId());
        if (eModel) {
          switch (e.getType()) {
            case 'edge':
            case 'node':
              eModel.data = { ...e.getData(), ...eModel.data };
              break;
            case 'group':
              eModel.data = { ...e.getData(), ...eModel.data };
              (eModel as NodeModel).collapsed = (e as Node).isCollapsed();
              break;
          }
        } else {
          if (e.getType() !== 'graph') {
            setObserved(() => controller.removeElement(e));
          }
        }
      });

      controller.fromModel(model);
      setObserved(() => {
        controller.getGraph().setData({
          graphData: graphData,
          onDeleteTrafficRouting: onDeleteTrafficRouting,
          onLaunchWizard: onLaunchWizard
        });
      });

      const { nodes } = elems(controller);

      // set decorators
      nodes.forEach(n => setNodeAttachments(n, graphSettings));

      // pre-select node-graph node, only when elems have changed (like on first render, or a structural change)
      const graphNode = graphData.fetchParams.node;
      if (graphNode && graphData.elementsChanged) {
        let selector: SelectAnd = [
          { prop: NodeAttr.namespace, val: graphNode.namespace.name },
          { prop: NodeAttr.nodeType, val: graphNode.nodeType }
        ];
        switch (graphNode.nodeType) {
          case NodeType.AGGREGATE:
            selector.push({ prop: NodeAttr.aggregate, val: graphNode.aggregate });
            selector.push({ prop: NodeAttr.aggregateValue, val: graphNode.aggregateValue });
            break;
          case NodeType.APP:
          case NodeType.BOX: // we only support app box node graphs, treat like an app node
            selector.push({ prop: NodeAttr.app, val: graphNode.app });
            if (graphNode.version && graphNode.version !== UNKNOWN) {
              selector.push({ prop: NodeAttr.version, val: graphNode.version });
            }
            break;
          case NodeType.SERVICE:
            selector.push({ prop: NodeAttr.service, val: graphNode.service });
            break;
          default:
            selector.push({ prop: NodeAttr.workload, val: graphNode.workload });
        }

        const selectedNodes = selectAnd(nodes, selector);
        if (selectedNodes.length > 0) {
          let target = selectedNodes[0];
          // default app to the whole app box, when appropriate
          if (
            (graphNode.nodeType === NodeType.APP || graphNode.nodeType === NodeType.BOX) &&
            !graphNode.version &&
            target.hasParent() &&
            target.getParent().getData().isBox === BoxByType.APP
          ) {
            target = target.getParent();
          }

          const data = target.getData() as NodeData;
          data.isSelected = true;
          setSelectedIds([target.getId()]);

          setObserved(() => target.setData(data));
        }
      }
    };

    console.debug(`TG: updateModel`);
    updateModel(controller);

    // notify that the graph has been updated
    const updateModelTime = Date.now();
    setUpdateModelTime(updateModelTime);
    setUpdateTime(updateModelTime);
  }, [
    controller,
    graphData,
    graphSettings,
    highlighter,
    layoutName,
    onDeleteTrafficRouting,
    onLaunchWizard,
    onReady,
    rankBy,
    setDetailsLevel,
    setRankResult,
    setSelectedIds,
    setUpdateTime,
    showRank
  ]);

  React.useEffect(() => {
    if (focusNode) {
      const { nodes } = elems(controller);
      const node = nodes.find(n => n.getId() === focusNode.id);
      if (node) {
        const data = node.getData() as NodeData;
        // select node if needed
        if (focusNode.isSelected) {
          data.isSelected = true;
          setSelectedIds([node.getId()]);
          setObserved(() => node.setData({ ...(node.getData() as NodeData) }));
        }
        // flash node
        for (let i = 0; i < 8; ++i) {
          setTimeout(() => {
            const data = node.getData() as NodeData;
            data.isFocus = !data.isFocus;
            setObserved(() => node.setData({ ...(node.getData() as NodeData) }));
          }, i * 500);
        }
      }
    }
  }, [controller, focusNode, setSelectedIds]);

  React.useEffect(() => {
    console.debug(`TG: controller changed`);
    initialLayout = true;
  }, [controller]);

  React.useEffect(() => {
    console.debug(`TG: graphData changed, elementsChanged=${graphData.elementsChanged}`);
    if (graphData.elementsChanged) {
      graphLayout(controller, LayoutType.Layout);
    }
  }, [controller, graphData]);

  React.useEffect(() => {
    console.debug(`TG: graphSettings changed`);
  }, [graphSettings]);

  React.useEffect(() => {
    console.debug(`TG: highlighter changed`);
  }, [highlighter]);

  React.useEffect(() => {
    console.debug(`TG: isMiniGraph changed`);
  }, [isMiniGraph]);

  React.useEffect(() => {
    console.debug(`TG: onReady changed`);
  }, [onReady]);

  React.useEffect(() => {
    console.debug(`TG: setDetails changed`);
  }, [setDetailsLevel]);

  React.useEffect(() => {
    if (!showTrafficAnimation) {
      trafficAnimation.stop();
      return;
    }

    if (!initialLayout) {
      trafficAnimation.start();
    }
  }, [controller, showTrafficAnimation, trafficAnimation, updateModelTime]);

  React.useEffect(() => {
    console.debug(`TG: layout changed`);

    if (!controller.hasGraph()) {
      return;
    }

    // When the initial layoutName property is set it is premature to perform a layout
    if (initialLayout) {
      return;
    }

    controller.getGraph().setLayout(layoutName);
    graphLayout(controller, LayoutType.Layout);
  }, [controller, layoutName]);

  //
  // Set back to graph summary at unmount-time (not every post-render)
  //
  React.useEffect(() => {
    return () => {
      if (updateSummary) {
        updateSummary({ isPF: true, summaryType: 'graph', summaryTarget: undefined });
      }
    };
  }, [updateSummary]);

  // Enable the selection-based zoom
  useEventListener<GraphAreaSelectedEventListener>(
    GRAPH_AREA_SELECTED_EVENT,
    ({ graph, modifier, startPoint, endPoint }) => {
      if (modifier === 'shiftKey' || modifier === 'ctrlKey') {
        graph.zoomToSelection(startPoint, endPoint);
        return;
      }
    }
  );

  useEventListener<GraphLayoutEndEventListener>(GRAPH_LAYOUT_END_EVENT, onLayoutEnd);

  console.debug(`TG: Render Topology hasGraph=${controller.hasGraph()}`);

  return isMiniGraph ? (
    <TopologyView data-test="topology-view-pf">
      <VisualizationSurface data-test="visualization-surface" state={{}} />
    </TopologyView>
  ) : (
    <>
      <ReactResizeDetector handleWidth={true} handleHeight={true} skipOnMount={true} onResize={handleResize} />
      <TopologyView
        data-test="topology-view-pf"
        controlBar={
          <TourStop info={GraphTourStops.Layout}>
            <TourStop info={GraphTourStops.Legend}>
              <TopologyControlBar
                data-test="topology-control-bar"
                controlButtons={createTopologyControlButtons({
                  ...defaultControlButtonsOptions,
                  fitToScreen: false,
                  zoomIn: false,
                  zoomOut: false,
                  customButtons: [
                    {
                      ariaLabel: 'Hide Healthy Edges',
                      callback: () => {
                        setEdgeMode(EdgeMode.UNHEALTHY === edgeMode ? EdgeMode.ALL : EdgeMode.UNHEALTHY);
                      },
                      icon: (
                        <KialiIcon.LongArrowRight
                          className={EdgeMode.UNHEALTHY === edgeMode ? toolbarActiveStyle : undefined}
                        />
                      ),
                      id: 'toolbar_edge_mode_unhealthy',
                      tooltip: 'Hide healthy edges'
                    },
                    {
                      ariaLabel: 'Hide All Edges',
                      id: 'toolbar_edge_mode_none',
                      icon: (
                        <KialiIcon.LongArrowRight
                          className={EdgeMode.NONE === edgeMode ? toolbarActiveStyle : undefined}
                        />
                      ),
                      tooltip: 'Hide all edges',
                      callback: () => {
                        setEdgeMode(EdgeMode.NONE === edgeMode ? EdgeMode.ALL : EdgeMode.NONE);
                      }
                    },
                    {
                      ariaLabel: 'Dagre - boxing layout',
                      id: 'toolbar_layout_dagre',
                      icon: (
                        <KialiIcon.Topology
                          className={LayoutName.Dagre === layoutName ? toolbarActiveStyle : undefined}
                        />
                      ),
                      tooltip: 'Dagre - boxing layout',
                      callback: () => {
                        setLayoutName(LayoutName.Dagre);
                      }
                    },
                    {
                      ariaLabel: 'Grid - non-boxing layout',
                      id: 'toolbar_layout_grid',
                      icon: (
                        <KialiIcon.Topology
                          className={LayoutName.Grid === layoutName ? toolbarActiveStyle : undefined}
                        />
                      ),
                      tooltip: 'Grid - non-boxing layout',
                      callback: () => {
                        setLayoutName(LayoutName.Grid);
                      }
                    },
                    {
                      ariaLabel: 'Concentric - non-boxing layout',
                      id: 'toolbar_layout_concentric',
                      icon: (
                        <KialiIcon.Topology
                          className={LayoutName.Concentric === layoutName ? toolbarActiveStyle : undefined}
                        />
                      ),
                      tooltip: 'Concentric - non-boxing layout',
                      callback: () => {
                        setLayoutName(LayoutName.Concentric);
                      }
                    },
                    {
                      ariaLabel: 'Breadth First - non-boxing layout',
                      id: 'toolbar_layout_breadth_first',
                      icon: (
                        <KialiIcon.Topology
                          className={LayoutName.BreadthFirst === layoutName ? toolbarActiveStyle : undefined}
                        />
                      ),
                      tooltip: 'Breadth First - non-boxing layout',
                      callback: () => {
                        setLayoutName(LayoutName.BreadthFirst);
                      }
                    }
                  ],
                  // currently unused
                  zoomInCallback: () => {
                    controller && controller.getGraph().scaleBy(ZOOM_IN);
                  },
                  // currently unused
                  zoomOutCallback: () => {
                    controller && controller.getGraph().scaleBy(ZOOM_OUT);
                  },
                  // currently unused
                  fitToScreenCallback: () => {
                    controller.getGraph().fit(FIT_PADDING);
                  },
                  resetViewCallback: () => {
                    graphLayout(controller, LayoutType.Layout);
                  },
                  legend: true,
                  legendIcon: <KialiIcon.Map className={showLegend ? toolbarActiveStyle : undefined} />,
                  legendTip: 'Legend',
                  legendCallback: () => {
                    if (toggleLegend) toggleLegend();
                  }
                })}
              />
            </TourStop>
          </TourStop>
        }
      >
        <VisualizationSurface data-test="visualization-surface" state={{}} />
      </TopologyView>
    </>
  );
};

export const GraphPF: React.FC<{
  edgeLabels: EdgeLabelMode[];
  edgeMode: EdgeMode;
  focusNode?: FocusNode;
  graphData: GraphData;
  isMiniGraph: boolean;
  layout: Layout;
  onDeleteTrafficRouting: (key: string, serviceDetails: ServiceDetailsInfo) => void;
  onEdgeTap?: (edge: Edge<EdgeModel>) => void;
  onLaunchWizard: (
    key: WizardAction,
    mode: WizardMode,
    namespace: string,
    serviceDetails: ServiceDetailsInfo,
    gateways: string[],
    peerAuths: PeerAuthentication[]
  ) => void;
  onNodeTap?: (node: Node<NodeModel>) => void;
  onReady: (refs: GraphRefs) => void;
  rankBy: RankMode[];
  setEdgeMode: (edgeMode: EdgeMode) => void;
  setLayout: (layout: Layout) => void;
  setRankResult: (rankResult: RankResult) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  showLegend: boolean;
  showOutOfMesh: boolean;
  showRank: boolean;
  showSecurity: boolean;
  showTrafficAnimation: boolean;
  showVirtualServices: boolean;
  toggleLegend?: () => void;
  trace?: JaegerTrace;
  updateSummary: (graphEvent: GraphEvent) => void;
}> = ({
  edgeLabels,
  edgeMode,
  focusNode,
  graphData,
  isMiniGraph,
  layout,
  onDeleteTrafficRouting,
  onEdgeTap,
  onLaunchWizard,
  onNodeTap,
  onReady,
  rankBy,
  setEdgeMode,
  setLayout,
  setRankResult,
  setUpdateTime,
  showLegend,
  showOutOfMesh,
  showRank,
  showSecurity,
  showTrafficAnimation,
  showVirtualServices,
  toggleLegend,
  trace,
  updateSummary
}) => {
  //create controller on startup and register factories
  const [controller, setController] = React.useState<Visualization>();
  const [highlighter, setHighlighter] = React.useState<GraphHighlighterPF>();
  const [trafficAnimation, setTrafficAnimation] = React.useState<TrafficAnimation>();

  // Set up the controller one time
  React.useEffect(() => {
    console.debug('TG: New Controller!');

    const c = new Visualization();
    c.registerElementFactory(elementFactory);
    c.registerLayoutFactory(layoutFactory);
    c.registerComponentFactory(stylesComponentFactory);
    setController(c);
    setHighlighter(new GraphHighlighterPF(c));
    setTrafficAnimation(new TrafficAnimation(c));
  }, []);

  const getLayoutName = (layout: Layout): LayoutName => {
    switch (layout.name) {
      case 'kiali-breadthfirst':
        return LayoutName.BreadthFirst;
      case 'kiali-concentric':
        return LayoutName.Concentric;
      case 'kiali-grid':
        return LayoutName.Grid;
      default:
        return LayoutName.Dagre;
    }
  };

  const setLayoutByName = (layoutName: LayoutName): void => {
    const layout = getLayoutByName(layoutName);
    HistoryManager.setParam(URLParam.GRAPH_LAYOUT, layout.name);
    // TODO: PF graph does have support for namespace box layout, just use dagre
    HistoryManager.setParam(URLParam.GRAPH_NAMESPACE_LAYOUT, KialiDagreGraph.getLayout().name);
    setLayout(layout);
  };

  if (!controller || !graphData || graphData.isLoading) {
    return (
      <Bullseye data-test="loading-contents">
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  console.debug(`TG: Render, hasGraph=${controller?.hasGraph()}`);
  return (
    <VisualizationProvider data-test="visualization-provider" controller={controller}>
      <TopologyContent
        controller={controller}
        edgeLabels={edgeLabels}
        edgeMode={edgeMode}
        focusNode={focusNode}
        graphData={graphData}
        highlighter={highlighter!}
        isMiniGraph={isMiniGraph}
        layoutName={getLayoutName(layout)}
        onDeleteTrafficRouting={onDeleteTrafficRouting}
        onEdgeTap={onEdgeTap}
        onLaunchWizard={onLaunchWizard}
        onNodeTap={onNodeTap}
        onReady={onReady}
        rankBy={rankBy}
        setEdgeMode={setEdgeMode}
        setLayout={setLayoutByName}
        setRankResult={setRankResult}
        setUpdateTime={setUpdateTime}
        showLegend={showLegend}
        showOutOfMesh={showOutOfMesh}
        showRank={showRank}
        showSecurity={showSecurity}
        showTrafficAnimation={showTrafficAnimation}
        showVirtualServices={showVirtualServices}
        toggleLegend={toggleLegend}
        trace={trace}
        trafficAnimation={trafficAnimation!}
        updateSummary={updateSummary}
      />
    </VisualizationProvider>
  );
};
