import { Bullseye, Spinner } from '@patternfly/react-core';
import { CogIcon, ExportIcon } from '@patternfly/react-icons';
import {
  createTopologyControlButtons,
  defaultControlButtonsOptions,
  EdgeModel,
  EdgeStyle,
  GraphElement,
  GRAPH_LAYOUT_END_EVENT,
  // GRAPH_POSITION_CHANGE_EVENT,
  Model,
  ModelKind,
  Node,
  NodeModel,
  SELECTION_STATE,
  TopologyControlBar,
  TopologyView,
  useEventListener,
  useVisualizationController,
  useVisualizationState,
  Visualization,
  VisualizationProvider,
  VisualizationSurface
} from '@patternfly/react-topology';
import { GraphData } from 'pages/Graph/GraphPage';
import * as React from 'react';
import { GraphEvent } from 'types/Graph';
import { JaegerTrace } from 'types/JaegerInfo';
import stylesComponentFactory from './components/stylesComponentFactory';
import elementFactory from './elements/elementFactory';
import {
  assignEdgeHealth,
  EdgeData,
  getNodeShape,
  getNodeStatus,
  GraphPFSettings,
  NodeData,
  setEdgeOptions,
  setNodeLabel
} from './GraphPFElems';
import layoutFactory from './layouts/layoutFactory';
import { hideTrace, showTrace } from './TracePF';
import { GraphHighlighterPF } from './GraphHighlighterPF';

let requestFit = false;

const DEFAULT_NODE_SIZE = 75;
const FIT_PADDING = 80;
const ZOOM_IN = 4 / 3;
const ZOOM_OUT = 3 / 4;

export enum LayoutName {
  Cola = 'Cola',
  ColaNoForce = 'ColaNoForce',
  Concentric = 'Concentric',
  Dagre = 'Dagre',
  Force = 'Force',
  Grid = 'Grid'
}

export interface TopologyOptions {
  layout: LayoutName;
}

export interface FocusNode {
  id: string;
  isSelected?: boolean;
}

export const DefaultOptions: TopologyOptions = {
  layout: LayoutName.Dagre
};

export const TopologyContent: React.FC<{
  graphData: GraphData;
  graphSettings: GraphPFSettings;
  onReady: (controller: any) => void;
  options: TopologyOptions;
  trace?: JaegerTrace;
  updateSummary: (event: GraphEvent) => void;
}> = ({ graphData, graphSettings, onReady, options, trace, updateSummary }) => {
  const controller = useVisualizationController();
  const highlighter = new GraphHighlighterPF(controller);

  //
  // SelectedIds State
  //
  const [selectedIds] = useVisualizationState<string[]>(SELECTION_STATE, []);
  React.useEffect(() => {
    highlighter.setSelectedId(selectedIds.length > 0 ? selectedIds[0] : undefined);

    if (selectedIds.length > 0) {
      const elem = controller.getElementById(selectedIds[0]);
      switch (elem?.getKind()) {
        case ModelKind.edge: {
          updateSummary({ isPF: true, summaryType: 'edge', summaryTarget: elem } as GraphEvent);
          return;
        }
        case ModelKind.node: {
          const isBox = (elem.getData() as NodeData).isBox;
          updateSummary({ isPF: true, summaryType: isBox ? 'box' : 'node', summaryTarget: elem } as GraphEvent);
          return;
        }
        default:
          updateSummary({ isPF: true, summaryType: 'graph', summaryTarget: controller } as GraphEvent);
      }
    } else {
      updateSummary({ isPF: true, summaryType: 'graph', summaryTarget: controller } as GraphEvent);
    }
  }, [controller, updateSummary, selectedIds]);

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
      console.log('Hide Trace Overlay');
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
      if ([LayoutName.Concentric, LayoutName.Dagre, LayoutName.Grid].includes(options.layout)) {
        fitView();
      } else {
        //TODO: find a smoother way to fit while elements are still moving
        setTimeout(fitView, 100);
        setTimeout(fitView, 250);
        setTimeout(fitView, 500);
      }
    }
  }, [fitView, options.layout]);

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
    console.log('SetDetailsLevel');
    if (controller && controller.hasGraph()) {
      controller.getGraph().setDetailsLevelThresholds({
        low: 0.3,
        medium: 0.5
      });
    }
  }, [controller]);

  //
  // Reset [new] graph with initial model
  //
  const resetGraph = React.useCallback(() => {
    console.log('Reset');
    if (controller) {
      const model: Model = {
        graph: {
          id: 'g1',
          type: 'graph',
          layout: options.layout
        }
      };
      controller.fromModel(model, false);
      setDetailsLevel();
      requestFit = true;
    }
  }, [controller, options.layout, setDetailsLevel]);

  const onHover = (element: GraphElement, isMouseIn: boolean) => {
    if (isMouseIn) {
      console.log(`Hover In ${element.getId()}`);
      highlighter.onMouseIn(element);
    } else {
      console.log(`Hover Out ${element.getId()}`);
      highlighter.onMouseOut(element);
    }
  };

  //
  // Manage the GraphData / DataModel
  //
  const generateDataModel = React.useCallback(() => {
    let nodeMap: Map<string, NodeModel> = new Map<string, NodeModel>();
    const edges: EdgeModel[] = [];
    // const opts = { ...DefaultOptions, ...options };

    function addGroup(data: NodeData): NodeModel {
      const group: NodeModel = {
        children: [],
        collapsed: false,
        data: data,
        group: true,
        id: data.id,
        style: { padding: 10 },
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
        // style: { padding: 20 },
        type: 'node',
        width: DEFAULT_NODE_SIZE
      };
      setNodeLabel(node, nodeMap, graphSettings);
      nodeMap.set(data.id, node);

      return node;
    }

    function addEdge(data: EdgeData): EdgeModel {
      const edge: EdgeModel = {
        data: data,
        edgeStyle: EdgeStyle.solid,
        id: data.id,
        source: data.source,
        target: data.target,
        type: 'edge'
        //animationSpeed: getAnimationSpeed(count, options.maxEdgeValue),
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
  }, [graphData, graphSettings]);

  //
  // update model merging existing nodes / edges
  //
  const updateModel = React.useCallback(() => {
    if (!controller) {
      return;
    } else if (!controller.hasGraph()) {
      console.error('updateModel called while controller has no graph');
    }

    console.log('updateModel');

    const updatedModel = generateDataModel();

    const allIds = [...(updatedModel.nodes || []), ...(updatedModel.edges || [])].map(item => item.id);
    controller.getElements().forEach(e => {
      if (e.getType() !== 'graph') {
        if (allIds.includes(e.getId())) {
          //keep previous data
          switch (e.getType()) {
            case 'node':
              const updatedNode = updatedModel.nodes?.find(n => n.id === e.getId());
              if (updatedNode) {
                updatedNode.data = { ...e.getData(), ...updatedNode.data };
              }
              break;
            case 'group':
              const updatedGroup = updatedModel.nodes?.find(n => n.id === e.getId());
              if (updatedGroup) {
                updatedGroup.collapsed = (e as Node).isCollapsed();
              }
              break;
          }
        } else {
          controller.removeElement(e);
        }
      }
    });

    controller.fromModel(updatedModel);
  }, [controller, generateDataModel]);

  //
  // update model on layout / metrics / filters change (TODO, may need to add logic to handle these change scenarios)
  //
  React.useEffect(() => {
    if (!controller.hasGraph()) {
      resetGraph();
      updateModel();
      onReady(controller);
    }
  }, [controller, onReady, resetGraph, updateModel]);

  //
  // Final Cleanup (at unmount-time, not every post-render)
  //
  React.useEffect(() => {
    return () => {
      console.log('Cleanup');
      if (updateSummary) {
        console.log('Clear Summary');
        updateSummary({ isPF: true, summaryType: 'graph', summaryTarget: undefined });
      }
    };
  }, [updateSummary]);

  useEventListener(GRAPH_LAYOUT_END_EVENT, onLayoutEnd);
  // useEventListener(GRAPH_POSITION_CHANGE_EVENT, onLayoutPositionChange);

  console.log('Render TV');
  return (
    <TopologyView
      data-test="topology-view"
      controlBar={
        <TopologyControlBar
          data-test="topology-control-bar"
          controlButtons={createTopologyControlButtons({
            ...defaultControlButtonsOptions,
            fitToScreen: false,
            customButtons: [
              {
                id: 'export',
                icon: <ExportIcon />,
                // tooltip: t('Export'),
                callback: () => {
                  // const svg = document.getElementsByClassName('pf-topology-visualization-surface__svg')[0];
                  // saveSvgAsPng(svg, 'topology.png', {
                  //  backgroundColor: '#fff',
                  //  encoderOptions: 0
                  //});
                }
              },
              {
                id: 'options',
                icon: <CogIcon />,
                // tooltip: t('More options'),
                callback: () => {
                  //  toggleTopologyOptions();
                }
              }
            ],
            zoomInCallback: () => {
              controller && controller.getGraph().scaleBy(ZOOM_IN);
            },
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
            //TODO: enable legend with display icons and colors
            legend: false
          })}
        />
      }
    >
      <VisualizationSurface data-test="visualization-surface" state={{}} />
    </TopologyView>
  );
};

export const GraphPF: React.FC<{
  graphData: GraphData;
  graphSettings: GraphPFSettings;
  focusNode?: FocusNode;
  onReady: (controller: any) => void;
  trace?: JaegerTrace;
  updateSummary: (graphEvent: GraphEvent) => void;
}> = ({ graphData, graphSettings, onReady, trace, updateSummary }) => {
  //create controller on startup and register factories
  const [controller, setController] = React.useState<Visualization>();

  React.useEffect(() => {
    const c = new Visualization();
    console.log('REGISTER!!!');
    c.registerElementFactory(elementFactory);
    c.registerLayoutFactory(layoutFactory);
    c.registerComponentFactory(stylesComponentFactory);
    setController(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!controller || !graphData || graphData.isLoading) {
    return (
      <Bullseye data-test="loading-contents">
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  console.log('Render!');
  return (
    <VisualizationProvider data-test="visualization-provider" controller={controller}>
      <TopologyContent
        graphData={graphData}
        graphSettings={graphSettings}
        onReady={onReady}
        options={DefaultOptions}
        trace={trace}
        updateSummary={updateSummary}
      />
    </VisualizationProvider>
  );
};

export default GraphPF;
