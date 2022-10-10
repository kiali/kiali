import { InputGroup, TextInput } from '@patternfly/react-core';
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
  NodeShape,
  NodeStatus,
  TopologyControlBar,
  TopologyView,
  useEventListener,
  useVisualizationController,
  Visualization,
  VisualizationProvider,
  VisualizationSurface
} from '@patternfly/react-topology';
import _ from 'lodash';
import { GraphData } from 'pages/Graph/GraphPage';
import * as React from 'react';
import { BoxByType, DecoratedGraphNodeData, NodeType, UNKNOWN } from 'types/Graph';
import componentFactory from './componentFactories/componentFactory';
import stylesComponentFactory from './componentFactories/stylesComponentFactory';
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
  layout: LayoutName.ColaNoForce
};

export const TopologyContent: React.FC<{
  graphData: GraphData;
  options: TopologyOptions;
}> = ({ graphData, options }) => {
  const controller = useVisualizationController();

  const [hoveredId, setHoveredId] = React.useState<string>('');
  const onHover = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any) => {
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

    const updatedModel = generateDataModel(graphData, hoveredId);
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
  }, [controller, graphData, hoveredId]);

  const generateDataModel = (graphData: GraphData, _hoveredId: string): Model => {
    let nodes: NodeModel[] = [];
    const edges: EdgeModel[] = [];
    // const opts = { ...DefaultOptions, ...options };

    function addGroup(id: string, label: string, data: any): NodeModel {
      const group: NodeModel = {
        id: id,
        children: [],
        type: 'group',
        group: true,
        collapsed: false, // options.startCollapsed,
        label: label,
        style: { padding: 10 },
        data: data
      };
      nodes.push(group);

      return group;
    }

    function addNode(id: string, label: string, data: any): NodeModel {
      const node: NodeModel = {
        id: id,
        type: 'node',
        label: label,
        width: DEFAULT_NODE_SIZE,
        height: DEFAULT_NODE_SIZE,
        shape: NodeShape.ellipse,
        status: NodeStatus.default,
        style: { padding: 20 },
        data: data
      };
      nodes.push(node);

      return node;
    }

    function addEdge(id: string, sourceId: string, targetId: string, data: any) {
      const edge = {
        id: id,
        type: 'edge',
        source: sourceId,
        target: targetId,
        edgeStyle: EdgeStyle.solid,
        //animationSpeed: getAnimationSpeed(count, options.maxEdgeValue),
        data: data
      };
      edges.push(edge);

      return edge;
    }

    function boxLabel(nd: DecoratedGraphNodeData): string {
      switch (nd.isBox!) {
        case BoxByType.CLUSTER:
          return nd.cluster;
        case BoxByType.NAMESPACE:
          return nd.namespace;
        default:
          return nd.app!;
      }
    }

    function nodeLabel(nd: DecoratedGraphNodeData): string {
      switch (nd.nodeType) {
        case NodeType.APP:
          return nd.app!;
        case NodeType.SERVICE:
          return nd.service!;
        case NodeType.WORKLOAD:
          return nd.workload!;
        case NodeType.UNKNOWN:
          return UNKNOWN;
        default:
          return nd.workload!;
      }
    }

    function addChild(node: NodeModel): void {
      const parentId = (node.data as DecoratedGraphNodeData).parent!;
      const parent = nodes.find(n => (n.data as DecoratedGraphNodeData).id === parentId);
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
        newNode = addGroup(nd.id, boxLabel(nd), nd);
      } else {
        newNode = addNode(nd.id, nodeLabel(nd), nd);
      }
      if (nd.parent) {
        addChild(newNode);
      }
    });

    graphData.elements.edges?.forEach(e => {
      const ed = e.data;
      addEdge(ed.id, ed.source, ed.target, ed);
    });

    return { nodes, edges };
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
      <div id="topology-search-container" data-test="topology-search-container">
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
      </div>
    </TopologyView>
  );
};

export const GraphPF: React.FC<{
  graphData: GraphData;
}> = ({ graphData }) => {
  //create controller on startup and register factories
  const [controller, setController] = React.useState<Visualization>();
  React.useEffect(() => {
    const c = new Visualization();
    c.registerLayoutFactory(layoutFactory);
    c.registerComponentFactory(componentFactory);
    c.registerComponentFactory(stylesComponentFactory);
    setController(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <VisualizationProvider data-test="visualization-provider" controller={controller}>
      <TopologyContent graphData={graphData} options={DefaultOptions} />
    </VisualizationProvider>
  );
};

export default GraphPF;
