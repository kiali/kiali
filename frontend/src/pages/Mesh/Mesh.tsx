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
  GraphLayoutEndEventListener,
  GraphAreaSelectedEventListener,
  GRAPH_AREA_SELECTED_EVENT
} from '@patternfly/react-topology';
import { Layout } from 'types/Graph';
import { elementFactory } from './elements/elementFactory';
import { layoutFactory } from './layouts/layoutFactory';
import { TimeInMilliseconds } from 'types/Common';
import { HistoryManager, URLParam } from 'app/History';
import { TourStop } from 'components/Tour/TourStop';
import { meshComponentFactory } from './components/meshComponentFactory';
import { MeshData, MeshRefs } from './MeshPage';
import { MeshInfraType, MeshTarget, MeshType } from 'types/Mesh';
import { MeshHighlighter } from './MeshHighlighter';
import {
  EdgeData,
  NodeData,
  assignEdgeHealth,
  getNodeShape,
  getNodeStatus,
  setEdgeOptions,
  setNodeAttachments,
  setNodeLabel
} from './MeshElems';
import { elems, setObserved } from 'helpers/GraphHelpers';
import { MeshTourStops } from './MeshHelpTour';
import { KialiMeshDagre } from './layouts/KialiMeshDagre';
//import { KialiMeshCola } from './layouts/KialiMeshCola';
import { KialiDagreGraph } from 'components/CytoscapeGraph/graphs/KialiDagreGraph';
import { KialiIcon } from 'config/KialiIcon';
import { toolbarActiveStyle } from 'styles/GraphStyle';

const DEFAULT_NODE_SIZE = 100;
const NAMESPACE_NODE_SIZE = 70;
const ZOOM_IN = 4 / 3;
const ZOOM_OUT = 3 / 4;

export const FIT_PADDING = 90;

export enum LayoutName {
  Dagre = 'dagre',
  //MeshCola = 'kiali-mesh-cola',
  MeshDagre = 'kiali-mesh-dagre'
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
    // case LayoutName.MeshCola:
    // return KialiMeshCola.getLayout();
    case LayoutName.MeshDagre:
      return KialiMeshDagre.getLayout();
    default:
      return KialiDagreGraph.getLayout();
  }
}

export function meshLayout(controller: Controller, layoutType: LayoutType, reset: boolean = true): void {
  if (!controller?.hasGraph()) {
    console.debug('Skip meshLayout, no graph');
    return;
  }
  if (initialLayout) {
    console.debug('Skip meshLayout, initial layout not yet performed');
    return;
  }
  if (layoutInProgress) {
    console.debug('Skip meshLayout, layout already in progress');
    return;
  }
  console.debug(`layout in progress (layoutType=${layoutType} reset=${reset}`);
  layoutInProgress = layoutType;
  if (reset) {
    controller.getGraph().reset();
  }
  controller.getGraph().layout();
}

// The is the main graph rendering component
const TopologyContent: React.FC<{
  controller: Controller;
  highlighter: MeshHighlighter;
  isMiniMesh: boolean;
  layoutName: LayoutName;
  meshData: MeshData;
  onEdgeTap?: (edge: Edge<EdgeModel>) => void;
  onNodeTap?: (node: Node<NodeModel>) => void;
  onReady: (refs: MeshRefs) => void;
  setLayout: (val: LayoutName) => void;
  setTarget: (meshTarget: MeshTarget) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  showLegend: boolean;
  toggleLegend?: () => void;
}> = ({
  controller,
  highlighter,
  isMiniMesh,
  layoutName,
  meshData,
  onEdgeTap,
  onNodeTap,
  onReady,
  setLayout: _setLayoutName,
  setTarget,
  setUpdateTime,
  showLegend,
  toggleLegend
}) => {
  //
  // SelectedIds State
  //
  const [selectedIds, setSelectedIds] = useVisualizationState<string[]>(SELECTION_STATE, []);

  React.useEffect(() => {
    if (isMiniMesh) {
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
            setTarget({ elem: controller, type: MeshType.Mesh });
        }
      }
      return;
    }

    if (selectedIds.length > 0) {
      const elem = controller.getElementById(selectedIds[0]);
      switch (elem?.getKind()) {
        case ModelKind.edge: {
          highlighter.setSelectedId(selectedIds[0]);
          setTarget({ elem: elem, type: MeshType.Edge });
          return;
        }
        case ModelKind.node: {
          highlighter.setSelectedId(selectedIds[0]);
          const isBox = elem.getData().isBox;
          setTarget({ type: isBox ? MeshType.Box : MeshType.Node, elem: elem as Node });
          return;
        }
        case ModelKind.graph:
        default:
          highlighter.setSelectedId(undefined);
          setSelectedIds([]);
          setTarget({ elem: controller, type: MeshType.Mesh });
      }
    } else {
      highlighter.setSelectedId(undefined);
      setTarget({ elem: controller, type: MeshType.Mesh });
    }
  }, [setTarget, selectedIds, highlighter, controller, isMiniMesh, onEdgeTap, onNodeTap, setSelectedIds, meshData]);

  //
  // Layout and resize handling
  //
  const handleResize = React.useCallback(() => {
    meshLayout(controller, LayoutType.Resize);
  }, [controller]);

  const onLayoutEnd = React.useCallback(() => {
    console.debug(`onLayoutEnd layoutInProgress=${layoutInProgress}`);

    // If a layout was called outside of our standard mechanism, don't perform our layoutEnd actions
    if (!initialLayout && !layoutInProgress) {
      return;
    }

    if (layoutInProgress !== LayoutType.LayoutNoFit) {
      // On a resize, delay fit to ensure that the canvas size updates before the fit
      if (layoutInProgress === LayoutType.Resize) {
        setTimeout(() => {
          controller.getGraph().fit(FIT_PADDING);
        }, 250);
      } else {
        controller.getGraph().fit(FIT_PADDING);
      }
    }

    // we need to finish the initial layout before we advertise to the outside
    // world that the graph is ready for external processing (like find/hide)
    if (initialLayout) {
      initialLayout = false;
      onReady({ getController: () => controller, setSelectedIds: setSelectedIds });
    }

    layoutInProgress = undefined;
  }, [controller, onReady, setSelectedIds]);

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
  // update model on meshData change
  //
  React.useEffect(() => {
    //
    // Reset [new] graph with initial model
    //
    const resetGraph = (): void => {
      if (controller) {
        const defaultModel: Model = {
          graph: {
            id: 'mesh',
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
        data.collapsible = false;
        data.onHover = onHover;
        const group: NodeModel = {
          children: [],
          data: data,
          group: true,
          id: data.id,
          status: getNodeStatus(data),
          style: { padding: [35, 35, 35, 35] },
          type: 'group'
        };
        setNodeLabel(group, nodeMap);
        nodeMap.set(data.id, group);

        return group;
      }

      function addNode(data: NodeData): NodeModel {
        data.onHover = onHover;
        const size = data.infraType === MeshInfraType.NAMESPACE ? NAMESPACE_NODE_SIZE : DEFAULT_NODE_SIZE;
        const node: NodeModel = {
          data: data,
          height: size,
          id: data.id,
          shape: getNodeShape(data),
          status: getNodeStatus(data),
          style: { padding: 50 },
          type: 'node',
          width: size
        };
        setNodeLabel(node, nodeMap);
        nodeMap.set(data.id, node);

        return node;
      }

      function addEdge(data: EdgeData): EdgeModel {
        data.onHover = onHover;
        const edge: EdgeModel = {
          animationSpeed: EdgeAnimationSpeed.none,
          data: data,
          edgeStyle: EdgeStyle.default,
          id: data.id,
          source: data.source,
          target: data.target,
          type: 'edge'
        };
        setEdgeOptions(edge, nodeMap);
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

      meshData.elements.nodes?.forEach(n => {
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
      assignEdgeHealth(meshData.elements.edges || [], nodeMap);

      meshData.elements.edges?.forEach(e => {
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
            setObserved(() => controller.removeElement(e));
          }
        }
      });

      controller.fromModel(model);
      setObserved(() => controller.getGraph().setData({ meshData: meshData }));

      const { nodes } = elems(controller);

      // set decorators
      nodes.forEach(n => setNodeAttachments(n));
    };

    console.debug(`mesh updateModel`);
    updateModel(controller);

    // notify that the graph has been updated
    setUpdateTime(Date.now());
  }, [controller, meshData, highlighter, layoutName, onReady, setDetailsLevel, setSelectedIds, setUpdateTime]);

  //TODO REMOVE THESE DEBUGGING MESSAGES...
  // Leave them for now, they are just good for understanding state changes while we develop this PFT graph.
  React.useEffect(() => {
    console.debug(`controller changed`);
    initialLayout = true;
  }, [controller]);

  React.useEffect(() => {
    console.debug(`meshData changed, elementsChange=${meshData.elementsChanged}`);
    if (meshData.elementsChanged) {
      meshLayout(controller, LayoutType.Layout);
    }
  }, [controller, meshData]);

  React.useEffect(() => {
    console.debug(`highlighter changed`);
  }, [highlighter]);

  React.useEffect(() => {
    console.debug(`isMiniMesh changed`);
  }, [isMiniMesh]);

  React.useEffect(() => {
    console.debug(`onReady changed`);
  }, [onReady]);

  React.useEffect(() => {
    console.debug(`setDetails changed`);
  }, [setDetailsLevel]);

  React.useEffect(() => {
    console.debug(`layout changed`);

    if (!controller.hasGraph()) {
      return;
    }

    // When the initial layoutName property is set it is premature to perform a layout
    if (initialLayout) {
      return;
    }

    controller.getGraph().setLayout(layoutName);
    meshLayout(controller, LayoutType.Layout);
  }, [controller, layoutName]);

  //
  // Set back to mesh target at unmount-time (not every post-render)
  //
  React.useEffect(() => {
    return () => {
      if (setTarget) {
        setTarget({ type: MeshType.Mesh, elem: undefined });
      }
    };
  }, [setTarget]);

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

  console.debug(`Render Topology hasGraph=${controller.hasGraph()}`);

  // TODO: I expected to find some sort of "onResize" hook in PFT, but after looking at the code
  // I ended up adding a ReactResizeDetector. It doesn't seem to work perfectly with PFT, but it's
  // not terrible.  Later I found https://github.com/patternfly/react-topology/issues/62, which
  // indicates that this is currently the way to go.  I added a suggestion there for some kind
  // of hook or option, but it would be a future.
  return isMiniMesh ? (
    <TopologyView data-test="mesh-topology-view-pf">
      <VisualizationSurface data-test="mesh-visualization-surface" state={{}} />
    </TopologyView>
  ) : (
    <>
      <ReactResizeDetector handleWidth={true} handleHeight={true} skipOnMount={true} onResize={handleResize} />
      <TopologyView
        data-test="mesh-topology-view-pf"
        controlBar={
          <TourStop info={MeshTourStops.Layout}>
            <TourStop info={MeshTourStops.Legend}>
              <TopologyControlBar
                data-test="mesh-topology-control-bar"
                controlButtons={createTopologyControlButtons({
                  ...defaultControlButtonsOptions,
                  fitToScreen: false,
                  zoomIn: false,
                  zoomOut: false,
                  customButtons: [
                    {
                      ariaLabel: 'Layout - Dagre',
                      id: 'toolbar_layout_dagre',
                      icon: (
                        <KialiIcon.Topology
                          className={LayoutName.Dagre === layoutName ? toolbarActiveStyle : undefined}
                        />
                      ),
                      tooltip: 'Layout - Dagre',
                      callback: () => {
                        _setLayoutName(LayoutName.Dagre);
                      }
                    },
                    {
                      ariaLabel: 'Layout - Mesh Dagre',
                      id: 'toolbar_layout_mesh_dagre',
                      icon: (
                        <KialiIcon.Topology
                          className={LayoutName.MeshDagre === layoutName ? toolbarActiveStyle : undefined}
                        />
                      ),
                      tooltip: 'Layout - Mesh Dagre',
                      callback: () => {
                        _setLayoutName(LayoutName.MeshDagre);
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
                    meshLayout(controller, LayoutType.Layout);
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

export const Mesh: React.FC<{
  isMiniMesh: boolean;
  layout: Layout;
  meshData: MeshData;
  onEdgeTap?: (edge: Edge<EdgeModel>) => void;
  onNodeTap?: (node: Node<NodeModel>) => void;
  onReady: (refs: MeshRefs) => void;
  setLayout: (layout: Layout) => void;
  setTarget: (meshTarget: MeshTarget) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  showLegend: boolean;
  toggleLegend?: () => void;
}> = ({
  isMiniMesh,
  layout,
  meshData,
  onEdgeTap,
  onNodeTap,
  onReady,
  setLayout,
  setTarget,
  setUpdateTime,
  showLegend,
  toggleLegend
}) => {
  //create controller on startup and register factories
  const [controller, setController] = React.useState<Visualization>();
  const [highlighter, setHighlighter] = React.useState<MeshHighlighter>();

  // Set up the controller one time
  React.useEffect(() => {
    console.debug('New Controller!');
    const c = new Visualization();
    c.registerElementFactory(elementFactory);
    c.registerLayoutFactory(layoutFactory);
    c.registerComponentFactory(meshComponentFactory);
    setController(c);
    setHighlighter(new MeshHighlighter(c));
  }, []);

  const getLayoutName = (layout: Layout): LayoutName => {
    switch (layout.name) {
      // case LayoutName.MeshCola:
      case LayoutName.MeshDagre:
        return layout.name;
      default:
        return LayoutName.Dagre;
    }
  };

  const setLayoutByName = (layoutName: LayoutName): void => {
    const layout = getLayoutByName(layoutName);
    HistoryManager.setParam(URLParam.MESH_LAYOUT, layout.name);
    setLayout(layout);
  };

  if (!controller || !meshData || meshData.isLoading) {
    return (
      <Bullseye data-test="loading-contents">
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  console.debug(`Render Mesh! hasGraph=${controller?.hasGraph()}`);
  return (
    <VisualizationProvider data-test="visualization-provider" controller={controller}>
      <TopologyContent
        controller={controller}
        meshData={meshData}
        highlighter={highlighter!}
        isMiniMesh={isMiniMesh}
        layoutName={getLayoutName(layout)}
        onEdgeTap={onEdgeTap}
        onNodeTap={onNodeTap}
        onReady={onReady}
        setLayout={setLayoutByName}
        setTarget={setTarget}
        setUpdateTime={setUpdateTime}
        showLegend={showLegend}
        toggleLegend={toggleLegend}
      />
    </VisualizationProvider>
  );
};
