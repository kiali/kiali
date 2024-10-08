import { Bullseye, Spinner } from '@patternfly/react-core';
import ReactResizeDetector from 'react-resize-detector';
import { LongArrowAltRightIcon, TopologyIcon, MapIcon } from '@patternfly/react-icons';
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
  Edge
} from '@patternfly/react-topology';
import { GraphData } from 'pages/Graph/GraphPage';
import * as React from 'react';
import {
  BoxByType,
  EdgeLabelMode,
  EdgeMode,
  GraphEvent,
  Layout,
  NodeAttr,
  NodeType,
  Protocol,
  UNKNOWN
} from 'types/Graph';
import { JaegerTrace } from 'types/TracingInfo';
import { stylesComponentFactory } from './components/stylesComponentFactory';
import { elementFactory } from './elements/elementFactory';
import {
  assignEdgeHealth,
  EdgeData,
  elems,
  getNodeShape,
  getNodeStatus,
  GraphPFSettings,
  NodeData,
  selectAnd,
  SelectAnd,
  setEdgeOptions,
  setNodeAttachments,
  setNodeLabel
} from './GraphPFElems';
import { layoutFactory } from './layouts/layoutFactory';
import { hideTrace, showTrace } from './TracePF';
import { GraphHighlighterPF } from './GraphHighlighterPF';
import { TimeInMilliseconds } from 'types/Common';
import { KialiConcentricGraph } from 'components/CytoscapeGraph/graphs/KialiConcentricGraph';
import { KialiDagreGraph } from 'components/CytoscapeGraph/graphs/KialiDagreGraph';
import { KialiGridGraph } from 'components/CytoscapeGraph/graphs/KialiGridGraph';
import { KialiBreadthFirstGraph } from 'components/CytoscapeGraph/graphs/KialiBreadthFirstGraph';
import { HistoryManager, URLParam } from 'app/History';
import { tcpTimerConfig, timerConfig } from 'components/CytoscapeGraph/TrafficAnimation/AnimationTimerConfig';
import { TourStop } from 'components/Tour/TourStop';
import { GraphTourStops } from 'pages/Graph/GraphHelpTour';
import { supportsGroups } from 'utils/GraphUtils';
import { GraphRefs } from './GraphPagePF';

let initialLayout = false;
let requestFit = false;

const DEFAULT_NODE_SIZE = 40;
const ZOOM_IN = 4 / 3;
const ZOOM_OUT = 3 / 4;

export const FIT_PADDING = 80;

export enum LayoutName {
  BreadthFirst = 'BreadthFirst',
  Concentric = 'Concentric',
  Dagre = 'Dagre',
  Grid = 'Grid'
}

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

// TODO: Implement some sort of focus when provided
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
  onEdgeTap?: (edge: Edge<EdgeModel>) => void;
  onNodeTap?: (node: Node<NodeModel>) => void;
  onReady: (refs: GraphRefs) => void;
  setEdgeMode: (edgeMode: EdgeMode) => void;
  setLayout: (val: LayoutName) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  showOutOfMesh: boolean;
  showSecurity: boolean;
  showTrafficAnimation: boolean;
  showVirtualServices: boolean;
  toggleLegend?: () => void;
  trace?: JaegerTrace;
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
  onEdgeTap,
  onNodeTap,
  onReady,
  setEdgeMode,
  setLayout: setLayoutName,
  setUpdateTime,
  showOutOfMesh,
  showSecurity,
  showTrafficAnimation,
  showVirtualServices,
  trace,
  toggleLegend,
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
  React.useEffect(() => {
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
  }, [
    controller,
    graphData,
    highlighter,
    isMiniGraph,
    onEdgeTap,
    onNodeTap,
    selectedIds,
    setSelectedIds,
    updateSummary
  ]);

  //
  // TraceOverlay State
  //
  React.useEffect(() => {
    if (!controller || !controller.hasGraph()) {
      return undefined;
    }

    if (!!trace) {
      showTrace(controller, graphData.fetchParams.graphType, trace);
    }

    return () => {
      hideTrace(controller);
    };
  }, [controller, graphData.fetchParams.graphType, trace]);

  //
  // fitView handling
  //
  const fitView = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      controller.getGraph().fit(FIT_PADDING);
    } else {
      console.error('fitView called before controller graph');
    }
  }, [controller]);

  // resize handling
  const handleResize = React.useCallback(() => {
    if (!requestFit && controller?.hasGraph()) {
      requestFit = true;
      controller.getGraph().reset();
      controller.getGraph().layout();

      // Fit padding after resize
      setTimeout(() => {
        controller.getGraph().fit(FIT_PADDING);
      }, 250);
    }
  }, [controller]);

  //
  // layoutEnd handling
  //
  const onLayoutEnd = React.useCallback(() => {
    //fit view to new loaded elements
    if (requestFit) {
      requestFit = false;
      fitView();
    }

    // we need to finish the initial layout before we advertise to the outside
    // world that the graph is ready for external processing (like find/hide)
    if (initialLayout) {
      initialLayout = false;
      onReady({ getController: () => controller, setSelectedIds: setSelectedIds });
    }
  }, [controller, fitView, onReady, setSelectedIds]);

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
            type: 'graph',
            layout: layoutName
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
          console.error(`Could not find parent node |${parentId}|`);
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
            controller.removeElement(e);
          }
        }
      });

      controller.fromModel(model);
      controller.getGraph().setData({ graphData: graphData });

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

          target.setData(data);
        }
      }
    };

    console.trace(`PFT updateModel`);
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
    onReady,
    setDetailsLevel,
    setSelectedIds,
    setUpdateTime
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
          node.setData({ ...(node.getData() as NodeData) });
        }
        // flash node
        for (let i = 0; i < 10; ++i) {
          setTimeout(() => {
            const data = node.getData() as NodeData;
            data.isFocus = !data.isFocus;
            node.setData({ ...(node.getData() as NodeData) });
          }, i * 500);
        }
      }
    }
  }, [controller, focusNode, setSelectedIds]);

  //TODO REMOVE THESE DEBUGGING MESSAGES...
  // Leave them for now, they are just good for understanding state changes while we develop this PFT graph.
  React.useEffect(() => {
    console.trace(`PFT: controller changed`);
    initialLayout = true;
  }, [controller]);

  React.useEffect(() => {
    console.trace(`PFT: graphData changed, elementsChanged=${graphData.elementsChanged}`);
  }, [graphData]);

  React.useEffect(() => {
    console.trace(`PFT: graphSettings changed`);
  }, [graphSettings]);

  React.useEffect(() => {
    console.trace(`PFT: highlighter changed`);
  }, [highlighter]);

  React.useEffect(() => {
    console.trace(`PFT: isMiniGraph changed`);
  }, [isMiniGraph]);

  React.useEffect(() => {
    console.trace(`PFT: onReady changed`);
  }, [onReady]);

  React.useEffect(() => {
    console.trace(`PFT: setDetails changed`);
  }, [setDetailsLevel]);

  React.useEffect(() => {
    const edges = controller.getGraph().getEdges();
    if (!showTrafficAnimation) {
      edges
        .filter(e => e.getEdgeAnimationSpeed() !== EdgeAnimationSpeed.none)
        .forEach(e => {
          e.setEdgeAnimationSpeed(EdgeAnimationSpeed.none);
          e.setEdgeStyle(EdgeStyle.solid);
        });
      return;
    }

    timerConfig.resetCalibration();
    tcpTimerConfig.resetCalibration();
    // Calibrate animation amplitude
    edges.forEach(e => {
      const edgeData = e.getData() as EdgeData;
      switch (edgeData.protocol) {
        case Protocol.GRPC:
          timerConfig.calibrate(edgeData.grpc);
          break;
        case Protocol.HTTP:
          timerConfig.calibrate(edgeData.http);
          break;
        case Protocol.TCP:
          tcpTimerConfig.calibrate(edgeData.tcp);
          break;
      }
    });
    edges.forEach(e => {
      const edgeData = e.getData() as EdgeData;
      switch (edgeData.protocol) {
        case Protocol.GRPC:
          e.setEdgeAnimationSpeed(timerConfig.computeAnimationSpeedPF(edgeData.grpc));
          break;
        case Protocol.HTTP:
          e.setEdgeAnimationSpeed(timerConfig.computeAnimationSpeedPF(edgeData.http));
          break;
        case Protocol.TCP:
          e.setEdgeAnimationSpeed(tcpTimerConfig.computeAnimationSpeedPF(edgeData.tcp));
          break;
      }
      if (e.getEdgeAnimationSpeed() !== EdgeAnimationSpeed.none) {
        e.setEdgeStyle(EdgeStyle.dashedMd);
      }
    });
  }, [controller, showTrafficAnimation, updateModelTime]);

  React.useEffect(() => {
    console.trace(`PFT: layout changed`);

    if (!controller.hasGraph()) {
      return;
    }

    requestFit = true;

    // When the initial layoutName property is set it is premature to perform a layout
    if (initialLayout) {
      return;
    }

    controller.getGraph().setLayout(layoutName);
    controller.getGraph().layout();
    if (requestFit) {
      requestFit = false;
      fitView();
    }
  }, [controller, fitView, layoutName]);

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

  useEventListener(GRAPH_LAYOUT_END_EVENT, onLayoutEnd);

  console.trace(`PFT: Render Topology hasGraph=${controller.hasGraph()}`);

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
                    // TODO, get rid of the show all edges option, and the disabling, when we can set an option active
                    {
                      ariaLabel: 'Show All Edges',
                      callback: () => {
                        setEdgeMode(EdgeMode.ALL);
                      },
                      disabled: EdgeMode.ALL === edgeMode,
                      icon: <LongArrowAltRightIcon />,
                      id: 'toolbar_edge_mode_all',
                      tooltip: 'Show all edges'
                    },
                    {
                      ariaLabel: 'Hide Healthy Edges',
                      callback: () => {
                        //change this back when we have the active styling
                        //setEdgeMode(EdgeMode.UNHEALTHY === edgeMode ? EdgeMode.ALL : EdgeMode.UNHEALTHY);
                        setEdgeMode(EdgeMode.UNHEALTHY);
                      },
                      disabled: EdgeMode.UNHEALTHY === edgeMode,
                      icon: <LongArrowAltRightIcon />,
                      id: 'toolbar_edge_mode_unhealthy',
                      tooltip: 'Hide healthy edges'
                    },
                    {
                      ariaLabel: 'Hide All Edges',
                      id: 'toolbar_edge_mode_none',
                      disabled: EdgeMode.NONE === edgeMode,
                      icon: <LongArrowAltRightIcon />,
                      tooltip: 'Hide all edges',
                      callback: () => {
                        //change this back when we have the active styling
                        //setEdgeMode(EdgeMode.NONE === edgeMode ? EdgeMode.ALL : EdgeMode.NONE);
                        setEdgeMode(EdgeMode.NONE);
                      }
                    },
                    {
                      ariaLabel: 'Dagre - boxing layout',
                      id: 'toolbar_layout_dagre',
                      disabled: LayoutName.Dagre === layoutName,
                      icon: <TopologyIcon />,
                      tooltip: 'Dagre - boxing layout',
                      callback: () => {
                        setLayoutName(LayoutName.Dagre);
                      }
                    },
                    {
                      ariaLabel: 'Grid - non-boxing layout',
                      id: 'toolbar_layout_grid',
                      disabled: LayoutName.Grid === layoutName,
                      icon: <TopologyIcon />,
                      tooltip: 'Grid - non-boxing layout',
                      callback: () => {
                        setLayoutName(LayoutName.Grid);
                      }
                    },
                    {
                      ariaLabel: 'Concentric - non-boxing layout',
                      id: 'toolbar_layout_concentric',
                      disabled: LayoutName.Concentric === layoutName,
                      icon: <TopologyIcon />,
                      tooltip: 'Concentric - non-boxing layout',
                      callback: () => {
                        setLayoutName(LayoutName.Concentric);
                      }
                    },
                    {
                      ariaLabel: 'Breadth First - non-boxing layout',
                      id: 'toolbar_layout_breadth_first',
                      disabled: LayoutName.BreadthFirst === layoutName,
                      icon: <TopologyIcon />,
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
                  resetViewCallback: () => {
                    if (controller) {
                      requestFit = true;
                      controller.getGraph().reset();
                      controller.getGraph().layout();
                    }
                  },
                  legend: true,
                  legendIcon: <MapIcon />,
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
  onEdgeTap?: (edge: Edge<EdgeModel>) => void;
  onNodeTap?: (node: Node<NodeModel>) => void;
  onReady: (refs: GraphRefs) => void;
  setEdgeMode: (edgeMode: EdgeMode) => void;
  setLayout: (layout: Layout) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  showOutOfMesh: boolean;
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
  onEdgeTap,
  onNodeTap,
  onReady,
  setEdgeMode,
  setLayout,
  setUpdateTime,
  showOutOfMesh,
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

  // Set up the controller one time
  React.useEffect(() => {
    console.trace('PFT: New Controller!');

    const c = new Visualization();
    c.registerElementFactory(elementFactory);
    c.registerLayoutFactory(layoutFactory);
    c.registerComponentFactory(stylesComponentFactory);
    setController(c);
    setHighlighter(new GraphHighlighterPF(c));
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

  console.trace(`PFT: Render, hasGraph=${controller?.hasGraph()}`);
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
        onEdgeTap={onEdgeTap}
        onNodeTap={onNodeTap}
        onReady={onReady}
        setEdgeMode={setEdgeMode}
        setLayout={setLayoutByName}
        setUpdateTime={setUpdateTime}
        showOutOfMesh={showOutOfMesh}
        showSecurity={showSecurity}
        showTrafficAnimation={showTrafficAnimation}
        showVirtualServices={showVirtualServices}
        trace={trace}
        toggleLegend={toggleLegend}
        updateSummary={updateSummary}
      />
    </VisualizationProvider>
  );
};
