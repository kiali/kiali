import { Bullseye, Spinner } from '@patternfly/react-core';
import { CogIcon, ExportIcon } from '@patternfly/react-icons';
import {
  Controller,
  createTopologyControlButtons,
  defaultControlButtonsOptions,
  EdgeModel,
  EdgeStyle,
  GraphElement,
  GraphModel,
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
  useVisualizationState,
  Visualization,
  VisualizationProvider,
  VisualizationSurface
} from '@patternfly/react-topology';
import { GraphData } from 'pages/Graph/GraphPage';
import * as React from 'react';
import { EdgeLabelMode, GraphEvent } from 'types/Graph';
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
import { TimeInMilliseconds } from 'types/Common';

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
  controller: Controller;
  edgeLabels: EdgeLabelMode[];
  focusNode?: FocusNode;
  graphData: GraphData;
  highlighter: GraphHighlighterPF;
  homeCluster: string;
  onReady: (controller: any) => void;
  options: TopologyOptions;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  showMissingSidecars: boolean;
  showSecurity: boolean;
  showVirtualServices: boolean;
  trace?: JaegerTrace;
  updateSummary: (graphEvent: GraphEvent) => void;
}> = ({
  controller,
  edgeLabels,
  graphData,
  highlighter,
  homeCluster,
  onReady,
  options,
  setUpdateTime,
  showMissingSidecars,
  showSecurity,
  showVirtualServices,
  trace,
  updateSummary
}) => {
  const graphSettings: GraphPFSettings = React.useMemo(() => {
    return {
      activeNamespaces: graphData.fetchParams.namespaces,
      edgeLabels: edgeLabels,
      graphType: graphData.fetchParams.graphType,
      homeCluster: homeCluster,
      showMissingSidecars: showMissingSidecars,
      showSecurity: showSecurity,
      showVirtualServices: showVirtualServices,
      trafficRates: graphData.fetchParams.trafficRates
    } as GraphPFSettings;
  }, [graphData, edgeLabels, homeCluster, showMissingSidecars, showSecurity, showVirtualServices]);

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
  }, [updateSummary, selectedIds, highlighter, controller]);

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
    const resetGraph = () => {
      if (controller) {
        const defaultModel: Model = {
          graph: {
            id: 'graphPF',
            type: 'graph',
            layout: options.layout
          }
        };
        controller.fromModel(defaultModel, false);
        setDetailsLevel();
        requestFit = true;
      }
    };

    //
    // Manage the GraphData / DataModel
    //
    const generateDataModel = () => {
      let nodeMap: Map<string, NodeModel> = new Map<string, NodeModel>();
      const edges: EdgeModel[] = [];

      const onHover = (element: GraphElement, isMouseIn: boolean) => {
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
      controller.getGraph().setData({ graphData: graphData });
    };

    const initialGraph = !controller.hasGraph();
    console.log(`updateModel`);
    updateModel(controller);
    if (initialGraph) {
      console.log('onReady');
      onReady(controller);
    }

    // notify that the graph has been updated
    setUpdateTime(Date.now());
  }, [controller, graphData, graphSettings, highlighter, onReady, options.layout, setDetailsLevel, setUpdateTime]);

  React.useEffect(() => {
    console.log(`controller changed`);
  }, [controller]);

  React.useEffect(() => {
    console.log(`graphData changed`);
  }, [graphData]);

  React.useEffect(() => {
    console.log(`graphSettings changed`);
  }, [graphSettings]);

  React.useEffect(() => {
    console.log(`highlighter changed`);
  }, [highlighter]);

  React.useEffect(() => {
    console.log(`options changed`);
  }, [options.layout]);

  React.useEffect(() => {
    console.log(`other changed`);
  }, [onReady, setDetailsLevel]);

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
  // useEventListener(GRAPH_POSITION_CHANGE_EVENT, onLayoutPositionChange);

  console.log('Render graph');
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
  edgeLabels: EdgeLabelMode[];
  focusNode?: FocusNode;
  graphData: GraphData;
  homeCluster: string;
  onReady: (controller: any) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  showMissingSidecars: boolean;
  showSecurity: boolean;
  showVirtualServices: boolean;
  trace?: JaegerTrace;
  updateSummary: (graphEvent: GraphEvent) => void;
}> = ({
  edgeLabels,
  focusNode,
  graphData,
  homeCluster,
  onReady,
  setUpdateTime,
  showMissingSidecars,
  showSecurity,
  showVirtualServices,
  trace,
  updateSummary
}) => {
  //create controller on startup and register factories
  const [controller, setController] = React.useState<Visualization>();
  const [highlighter, setHighlighter] = React.useState<GraphHighlighterPF>();

  // Set up the controller one time
  React.useEffect(() => {
    console.log('New Controller!');
    const c = new Visualization();
    c.registerElementFactory(elementFactory);
    c.registerLayoutFactory(layoutFactory);
    c.registerComponentFactory(stylesComponentFactory);
    setController(c);
    setHighlighter(new GraphHighlighterPF(c));
  }, []);

  if (!controller || !graphData || graphData.isLoading) {
    return (
      <Bullseye data-test="loading-contents">
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  console.log(`Render GraphPF! hasGraph=${controller?.hasGraph()}`);
  return (
    <VisualizationProvider data-test="visualization-provider" controller={controller}>
      <TopologyContent
        controller={controller}
        edgeLabels={edgeLabels}
        focusNode={focusNode}
        graphData={graphData}
        highlighter={highlighter!}
        homeCluster={homeCluster}
        onReady={onReady}
        options={DefaultOptions}
        setUpdateTime={setUpdateTime}
        showMissingSidecars={showMissingSidecars}
        showSecurity={showSecurity}
        showVirtualServices={showVirtualServices}
        trace={trace}
        updateSummary={updateSummary}
      />
    </VisualizationProvider>
  );
};

export default GraphPF;
