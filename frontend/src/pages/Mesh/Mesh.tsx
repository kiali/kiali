import { Bullseye, Spinner } from '@patternfly/react-core';
import { MapIcon } from '@patternfly/react-icons';
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
  Edge
} from '@patternfly/react-topology';
import { TopologyIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { Layout } from 'types/Graph';
import { elementFactory } from './elements/elementFactory';
import { layoutFactory } from './layouts/layoutFactory';
import { TimeInMilliseconds } from 'types/Common';
import { HistoryManager, URLParam } from 'app/History';
import { TourStop } from 'components/Tour/TourStop';
import { getFocusSelector, unsetFocusSelector } from 'utils/SearchParamUtils';
import { meshComponentFactory } from './components/meshComponentFactory';
import { MeshData } from './MeshPage';
import { MeshInfraType, MeshTarget } from 'types/Mesh';
import { MeshHighlighter } from './MeshHighlighter';
import {
  EdgeData,
  NodeData,
  assignEdgeHealth,
  elems,
  getNodeShape,
  getNodeStatus,
  setEdgeOptions,
  setNodeAttachments,
  setNodeLabel
} from './MeshElems';
import { MeshTourStops } from './MeshHelpTour';
import { KialiMeshDagre } from './layouts/KialiMeshDagre';
//import { KialiMeshCola } from './layouts/KialiMeshCola';
import { KialiDagreGraph } from 'components/CytoscapeGraph/graphs/KialiDagreGraph';

let initialLayout = false;
let requestFit = false;

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

// TODO: Implement some sort of focus when provided
export interface FocusNode {
  id: string;
  isSelected?: boolean;
}

// The is the main graph rendering component
const TopologyContent: React.FC<{
  controller: Controller;
  meshData: MeshData;
  highlighter: MeshHighlighter;
  isMiniMesh: boolean;
  layoutName: LayoutName;
  onEdgeTap?: (edge: Edge<EdgeModel>) => void;
  onNodeTap?: (node: Node<NodeModel>) => void;
  onReady: (controller: any) => void;
  onResize?: () => void;
  setLayout: (val: LayoutName) => void;
  setTarget: (meshTarget: MeshTarget) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  toggleLegend?: () => void;
}> = ({
  controller,
  meshData,
  highlighter,
  isMiniMesh,
  layoutName,
  onEdgeTap,
  onNodeTap,
  onReady,
  onResize,
  setLayout: _setLayoutName,
  setTarget,
  setUpdateTime,
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
            setTarget({ elem: controller, type: 'mesh' } as MeshTarget);
        }
      }
      return;
    }

    if (selectedIds.length > 0) {
      const elem = controller.getElementById(selectedIds[0]);
      switch (elem?.getKind()) {
        case ModelKind.edge: {
          highlighter.setSelectedId(selectedIds[0]);
          setTarget({ elem: elem, type: 'edge' } as MeshTarget);
          return;
        }
        case ModelKind.node: {
          highlighter.setSelectedId(selectedIds[0]);
          const isBox = (elem.getData() as NodeData).isBox;
          setTarget({ type: isBox ? 'box' : 'node', elem: elem } as MeshTarget);
          return;
        }
        case ModelKind.graph:
        default:
          highlighter.setSelectedId(undefined);
          setSelectedIds([]);
          setTarget({ elem: controller, type: 'mesh' } as MeshTarget);
      }
    } else {
      highlighter.setSelectedId(undefined);
      setTarget({ elem: controller, type: 'mesh' } as MeshTarget);
    }
  }, [setTarget, selectedIds, highlighter, controller, isMiniMesh, onEdgeTap, onNodeTap, setSelectedIds]);

  //
  // fitView handling
  //
  const fitView = React.useCallback(() => {
    if (controller?.hasGraph()) {
      const graph = controller.getGraph();
      graph.reset();
      graph.fit(FIT_PADDING);
    }
  }, [controller]);

  // resize handling
  const handleResize = React.useCallback(() => {
    if (!requestFit && controller?.hasGraph()) {
      requestFit = true;
      controller.getGraph().reset();
      controller.getGraph().layout();
    }
    if (onResize) {
      onResize();
    }
  }, [onResize, controller]);

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
    const resetGraph = () => {
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
    const generateDataModel = () => {
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
    const updateModel = (controller: Controller) => {
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
      controller.getGraph().setData({ meshData: meshData });

      const { nodes } = elems(controller);

      // set decorators
      nodes.forEach(n => setNodeAttachments(n));

      const focusNodeId = getFocusSelector();
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
      // - Currently no pre-selection
    };

    const initialGraph = !controller.hasGraph();
    console.debug(`mesh updateModel`);
    updateModel(controller);
    if (initialGraph) {
      console.debug('mesh onReady');
      onReady(controller);
    }

    // notify that the graph has been updated
    setUpdateTime(Date.now());
  }, [controller, meshData, highlighter, layoutName, onReady, setDetailsLevel, setSelectedIds, setUpdateTime]);

  //TODO REMOVE THESE DEBUGGING MESSAGES...
  // Leave them for now, they are just good for understanding state changes while we develop this PFT graph.
  React.useEffect(() => {
    console.debug(`controller changed`);
  }, [controller]);

  React.useEffect(() => {
    console.debug(`meshData changed`);
  }, [meshData]);

  React.useEffect(() => {
    console.debug(`highlighter changed`);
  }, [highlighter]);

  React.useEffect(() => {
    console.debug(`isMiniMesh changed`);
  }, [isMiniMesh]);

  React.useEffect(() => {
    console.debug(`onReady changed`);
    initialLayout = true;
  }, [onReady]);

  React.useEffect(() => {
    console.debug(`setDetails changed`);
  }, [setDetailsLevel]);

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
  // Set back to mesh target at unmount-time (not every post-render)
  //
  React.useEffect(() => {
    return () => {
      if (setTarget) {
        setTarget({ type: 'mesh', elem: undefined });
      }
    };
  }, [setTarget]);

  useEventListener(GRAPH_LAYOUT_END_EVENT, onLayoutEnd);

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
                      disabled: LayoutName.Dagre === layoutName,
                      icon: <TopologyIcon />,
                      tooltip: 'Layout - Dagre',
                      callback: () => {
                        _setLayoutName(LayoutName.Dagre);
                      }
                    },
                    {
                      ariaLabel: 'Layout - Mesh Dagre',
                      id: 'toolbar_layout_mesh_dagre',
                      disabled: LayoutName.MeshDagre === layoutName,
                      icon: <TopologyIcon />,
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
                    if (controller) {
                      requestFit = true;
                      controller.getGraph().reset();
                      controller.getGraph().layout();
                    }
                  },
                  legend: false, // Actual Legend is still TODO...
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

export const Mesh: React.FC<{
  focusNode?: FocusNode;
  meshData: MeshData;
  isMiniMesh: boolean;
  layout: Layout;
  onEdgeTap?: (edge: Edge<EdgeModel>) => void;
  onNodeTap?: (node: Node<NodeModel>) => void;
  onReady: (controller: any) => void;
  onResize: () => void;
  setLayout: (layout: Layout) => void;
  setTarget: (meshTarget: MeshTarget) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  toggleLegend?: () => void;
}> = ({
  meshData,
  isMiniMesh,
  layout,
  onEdgeTap,
  onNodeTap,
  onReady,
  onResize,
  setLayout,
  setTarget,
  setUpdateTime,
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

  const setLayoutByName = (layoutName: LayoutName) => {
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
        onResize={onResize}
        onReady={onReady}
        setLayout={setLayoutByName}
        setTarget={setTarget}
        setUpdateTime={setUpdateTime}
        toggleLegend={toggleLegend}
      />
    </VisualizationProvider>
  );
};
