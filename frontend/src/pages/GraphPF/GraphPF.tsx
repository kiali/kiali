import { Bullseye, Spinner } from '@patternfly/react-core';
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
import { getFocusSelector, unsetFocusSelector } from 'utils/SearchParamUtils';

let initialLayout = false;
let requestFit = false;

const DEFAULT_NODE_SIZE = 50;
const ZOOM_IN = 4 / 3;
const ZOOM_OUT = 3 / 4;

export const FIT_PADDING = 80;

export enum LayoutName {
  BreadthFirst = 'BreadthFirst',
  Concentric = 'Concentric',
  Dagre = 'Dagre',
  Grid = 'Grid'
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
  graphData: GraphData;
  highlighter: GraphHighlighterPF;
  isMiniGraph: boolean;
  layoutName: LayoutName;
  onEdgeTap?: (edge: Edge<EdgeModel>) => void;
  onNodeTap?: (node: Node<NodeModel>) => void;
  onReady: (controller: any) => void;
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
  }, [updateSummary, selectedIds, highlighter, controller, isMiniGraph, onEdgeTap, onNodeTap, setSelectedIds]);

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

  //
  // layoutEnd handling
  //
  const onLayoutEnd = React.useCallback(() => {
    //fit view to new loaded elements
    if (requestFit) {
      requestFit = false;
      fitView();
    }
  }, [fitView]);

  //
  // TODO: Maybe add this back if we have popovers that behave badly
  // layoutPosition Change  handling
  //
  /*
        const onLayoutPositionChange = React.useCallback(() => {
          if (controller && controller.hasGraph()) {
            //hide popovers on pan / zoom
            const popover = document.querySelector('[aria-labelledby="popover-decorator-header"]');
            if (popover) {
              (popover as HTMLElement).style.display = 'none';
            }
          }
        }, [controller]);
        */

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
        setNodeLabel(group, nodeMap, graphSettings);
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
        setNodeLabel(node, nodeMap, graphSettings);
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
        let newNode: NodeModel;
        if (nd.isBox) {
          newNode = addGroup(nd as NodeData);
        } else {
          newNode = addNode(nd as NodeData);
        }
        if (nd.parent) {
          addChild(newNode);
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
      model.nodes.forEach(e => modelMap.set(e.id, e));
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

      let focusNodeId = getFocusSelector();
      if (focusNodeId) {
        const focusNode = nodes.find(n => n.getId() === focusNodeId);
        if (focusNode) {
          const data = focusNode.getData() as NodeData;
          data.isSelected = true;
          setSelectedIds([focusNode.getId()]);
          focusNode.setData({ ...(focusNode.getData() as NodeData) });
        }
        unsetFocusSelector();
      }

      // pre-select node if provided
      const graphNode = graphData.fetchParams.node;
      if (graphNode) {
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

    const initialGraph = !controller.hasGraph();
    console.debug(`updateModel`);
    updateModel(controller);
    if (initialGraph) {
      console.debug('onReady');
      onReady(controller);
    }

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

  //TODO REMOVE THESE DEBUGGING MESSAGES...
  // Leave them for now, they are just good for understanding state changes while we develop this PFT graph.
  React.useEffect(() => {
    console.debug(`controller changed`);
  }, [controller]);

  React.useEffect(() => {
    console.debug(`graphData changed`);
  }, [graphData]);

  React.useEffect(() => {
    console.debug(`graphSettings changed`);
  }, [graphSettings]);

  React.useEffect(() => {
    console.debug(`highlighter changed`);
  }, [highlighter]);

  React.useEffect(() => {
    console.debug(`isMiniGraph changed`);
  }, [isMiniGraph]);

  React.useEffect(() => {
    console.debug(`onReady changed`);
    initialLayout = true;
  }, [onReady]);

  React.useEffect(() => {
    console.debug(`setDetails changed`);
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
    console.debug(`layout changed`);
    if (!controller.hasGraph()) {
      return;
    }

    requestFit = true;

    // When the initial layoutName property is set it is premature to perform a layout
    if (initialLayout) {
      initialLayout = false;
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

  console.debug(`Render Topology hasGraph=${controller.hasGraph()}`);

  return isMiniGraph ? (
    <TopologyView data-test="topology-view-pf">
      <VisualizationSurface data-test="visualization-surface" state={{}} />
    </TopologyView>
  ) : (
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
                    ariaLabel: 'Layout - Dagre',
                    id: 'toolbar_layout_dagre',
                    disabled: LayoutName.Dagre === layoutName,
                    icon: <TopologyIcon />,
                    tooltip: 'Layout - dagre',
                    callback: () => {
                      setLayoutName(LayoutName.Dagre);
                    }
                  },
                  {
                    ariaLabel: 'Layout - Grid',
                    id: 'toolbar_layout_grid',
                    disabled: LayoutName.Grid === layoutName,
                    icon: <TopologyIcon />,
                    tooltip: 'Layout - grid',
                    callback: () => {
                      setLayoutName(LayoutName.Grid);
                    }
                  },
                  {
                    ariaLabel: 'Layout - Concentric',
                    id: 'toolbar_layout_concentric',
                    disabled: LayoutName.Concentric === layoutName,
                    icon: <TopologyIcon />,
                    tooltip: 'Layout - concentric',
                    callback: () => {
                      setLayoutName(LayoutName.Concentric);
                    }
                  },
                  {
                    ariaLabel: 'Layout - Breadth First',
                    id: 'toolbar_layout_breadth_first',
                    disabled: LayoutName.BreadthFirst === layoutName,
                    icon: <TopologyIcon />,
                    tooltip: 'Layout - breadth first',
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
  onReady: (controller: any) => void;
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
    console.debug('New Controller!');
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
    let layout: Layout;
    // TODO, handle namespaceLayout
    switch (layoutName) {
      case LayoutName.BreadthFirst:
        layout = KialiBreadthFirstGraph.getLayout();
        break;
      case LayoutName.Concentric:
        layout = KialiConcentricGraph.getLayout();
        break;
      case LayoutName.Grid:
        layout = KialiGridGraph.getLayout();
        break;
      default:
        layout = KialiDagreGraph.getLayout();
    }

    HistoryManager.setParam(URLParam.GRAPH_LAYOUT, layout.name);
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

  console.debug(`Render GraphPF! hasGraph=${controller?.hasGraph()}`);
  return (
    <VisualizationProvider data-test="visualization-provider" controller={controller}>
      <TopologyContent
        controller={controller}
        edgeLabels={edgeLabels}
        edgeMode={edgeMode}
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
