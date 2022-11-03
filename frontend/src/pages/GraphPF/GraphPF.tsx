import { Bullseye, Spinner } from '@patternfly/react-core';
import { CogIcon, ExportIcon } from '@patternfly/react-icons';
import {
  createTopologyControlButtons,
  defaultControlButtonsOptions,
  EdgeModel,
  EdgeStyle,
  GRAPH_LAYOUT_END_EVENT,
  GRAPH_POSITION_CHANGE_EVENT,
  Model,
  Node,
  NodeModel,
  TopologyControlBar,
  TopologyView,
  useEventListener,
  useVisualizationController,
  Visualization,
  VisualizationProvider,
  VisualizationSurface
} from '@patternfly/react-topology';
import { GraphData } from 'pages/Graph/GraphPage';
import * as React from 'react';
import componentFactory from './componentFactories/componentFactory';
import stylesComponentFactory from './componentFactories/stylesComponentFactory';
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

export const HOVER_EVENT = 'hover';

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

export const DefaultOptions: TopologyOptions = {
  layout: LayoutName.Dagre
};

export const TopologyContent: React.FC<{
  graphData: GraphData;
  graphSettings: GraphPFSettings;
  onReady: (controller: any) => void;
  options: TopologyOptions;
}> = ({ graphData, graphSettings, options, onReady }) => {
  const controller = useVisualizationController();

  // update hover as the mouse moves
  const [hoveredId, setHoveredId] = React.useState<string>('');
  const onHover = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: NodeData) => {
      setHoveredId(data.isHovered ? data.id : '');
    },
    []
  );

  //fit view to elements
  const fitView = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      controller.getGraph().fit(FIT_PADDING);
    } else {
      console.error('fitView called before controller graph');
    }
  }, [controller]);

  //TODO: Find a way to block all animation and just have this called on final layout
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

  const onLayoutPositionChange = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      //hide popovers on pan / zoom
      const popover = document.querySelector('[aria-labelledby="popover-decorator-header"]');
      if (popover) {
        (popover as HTMLElement).style.display = 'none';
      }
    }
  }, [controller]);

  //update graph details level
  const setDetailsLevel = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      controller.getGraph().setDetailsLevelThresholds({
        low: 0.3,
        medium: 0.5
      });
    }
  }, [controller]);

  //reset graph and model
  const resetGraph = React.useCallback(() => {
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
    }
  }, [controller, options.layout, setDetailsLevel]);

  //update details on low / med scale change
  React.useEffect(() => {
    setDetailsLevel();
  }, [controller, setDetailsLevel]);

  //update model merging existing nodes / edges
  const updateModel = React.useCallback(() => {
    if (!controller) {
      return;
    } else if (!controller.hasGraph()) {
      console.error('updateModel called while controller has no graph');
      //    } else if (waitForMetrics && prevMetrics === metrics) {
      //      return;
    }

    //highlight either hoveredId or selected id
    //  let highlightedId = hoveredId;
    //  if (!highlightedId && selectedIds.length === 1) {
    //    highlightedId = selectedIds[0];
    //  }

    const updatedModel = generateDataModel(graphData, graphSettings);
    
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
    
    const initialModel = controller.hasGraph();
    controller.fromModel(updatedModel);
    if (initialModel) {
      onReady(controller);
      console.log("On Ready");
    }
  }, [controller, graphData, graphSettings, onReady]);

  const generateDataModel = (graphData: GraphData, graphSettings: GraphPFSettings): Model => {
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
      // TODO, do we actually need to do anything with this?
      if (hoveredId === data.id) {
        console.log(`Hovering over ${hoveredId} `);
      }
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

    graphData.elements.edges?.forEach(e => {
      const ed = e.data;
      addEdge(ed as EdgeData);
    });

    // Compute edge healths one time for the graph
    assignEdgeHealth(edges, nodeMap, graphSettings);

    const nodes = Array.from(nodeMap.values());
    return { nodes: nodes, edges: edges };
  };

  //update model on layout / metrics / filters change
  React.useEffect(() => {
    //update graph
    if (!controller.hasGraph()) {
      resetGraph();
    }

    //then update model
    updateModel();
  }, [controller, resetGraph, updateModel]);

  useEventListener(HOVER_EVENT, onHover);
  useEventListener(GRAPH_LAYOUT_END_EVENT, onLayoutEnd);
  useEventListener(GRAPH_POSITION_CHANGE_EVENT, onLayoutPositionChange);

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
      {/* <div id="topology-search-container" data-test="topology-search-container">
        <InputGroup>
          <TextInput
            data-test="search-topology-element-input"
            id="search-topology-element-input"
            className={'search'}
            placeholder="Find in view"
            autoFocus
            // type={searchValidated !== ValidatedOptions.default ? 'text' : 'search'}
            aria-label="search"
            //onKeyPress={e => e.key === 'Enter' && onSearch(searchValue)}
            //onChange={onChangeSearch}
            //value={searchValue}
            //validated={searchValidated}
          />
        </InputGroup>
      </div> */}
    </TopologyView>
  );
};

export const GraphPF: React.FC<{
  graphData: GraphData;
  graphSettings: GraphPFSettings;
  onReady: (controller: any) => void;
}> = ({ graphData, graphSettings, onReady }) => {

  //create controller on startup and register factories
  const [controller, setController] = React.useState<Visualization>();

  React.useEffect(() => {
    const c = new Visualization();
    console.log('REGISTER!!!');
    c.registerLayoutFactory(layoutFactory);
    c.registerComponentFactory(componentFactory);
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
      <TopologyContent graphData={graphData} graphSettings={graphSettings} onReady={onReady} options={DefaultOptions} />
    </VisualizationProvider>
  );
};

export default GraphPF;
