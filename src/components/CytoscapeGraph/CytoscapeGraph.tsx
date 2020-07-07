import * as Cy from 'cytoscape';
import * as React from 'react';
import ReactResizeDetector from 'react-resize-detector';
import Namespace from '../../types/Namespace';
import { GraphHighlighter } from './graphs/GraphHighlighter';
import TrafficRender from './TrafficAnimation/TrafficRenderer';
import EmptyGraphLayout from './EmptyGraphLayout';
import { CytoscapeReactWrapper } from './CytoscapeReactWrapper';
import * as CytoscapeGraphUtils from './CytoscapeGraphUtils';
import { CyNode, isCore, isEdge, isNode } from './CytoscapeGraphUtils';
import * as API from '../../services/Api';
import {
  CytoscapeBaseEvent,
  CytoscapeClickEvent,
  CytoscapeGlobalScratchData,
  CytoscapeGlobalScratchNamespace,
  CytoscapeMouseInEvent,
  CytoscapeMouseOutEvent,
  EdgeLabelMode,
  Layout,
  NodeParamsType,
  NodeType,
  UNKNOWN
} from '../../types/Graph';
import * as H from '../../types/Health';
import { NamespaceAppHealth, NamespaceServiceHealth, NamespaceWorkloadHealth } from '../../types/Health';
import { IntervalInMilliseconds, TimeInMilliseconds } from '../../types/Common';
import FocusAnimation from './FocusAnimation';
import { CytoscapeContextMenuWrapper, NodeContextMenuType, EdgeContextMenuType } from './CytoscapeContextMenu';
import { angleBetweenVectors, squaredDistance, normalize } from '../../utils/MathUtils';
import { NodeSingular } from 'cytoscape';
import { EdgeSingular } from 'cytoscape';
import { Core } from 'cytoscape';
import { GraphData } from 'pages/Graph/GraphPage';
import { JaegerTrace } from 'types/JaegerInfo';
import { showTrace, hideTrace } from './CytoscapeTrace';

type CytoscapeGraphProps = {
  compressOnHide: boolean;
  containerClassName?: string;
  contextMenuEdgeComponent?: EdgeContextMenuType;
  contextMenuGroupComponent?: NodeContextMenuType;
  contextMenuNodeComponent?: NodeContextMenuType;
  displayUnusedNodes: () => void;
  edgeLabelMode: EdgeLabelMode;
  graphData: GraphData;
  focusSelector?: string;
  isMiniGraph: boolean;
  isMTLSEnabled: boolean;
  layout: Layout;
  onEmptyGraphAction?: () => void;
  onNodeDoubleTap?: (e: GraphNodeDoubleTapEvent) => void;
  onNodeTap?: (e: GraphNodeTapEvent) => void;
  onReady?: (cytoscapeRef: any) => void;
  refreshInterval: IntervalInMilliseconds;
  setActiveNamespaces?: (namespace: Namespace[]) => void;
  setNode?: (node?: NodeParamsType) => void;
  setUpdateTime?: (val: TimeInMilliseconds) => void;
  showCircuitBreakers: boolean;
  showMissingSidecars: boolean;
  showNodeLabels: boolean;
  showOperationNodes: boolean;
  showSecurity: boolean;
  showServiceNodes: boolean;
  showTrafficAnimation: boolean;
  showUnusedNodes: boolean;
  showVirtualServices: boolean;
  trace?: JaegerTrace;
  updateSummary?: (event: CytoscapeClickEvent) => void;
};

type Position = {
  x: number;
  y: number;
};

type InitialValues = {
  position?: Position;
  zoom?: number;
};

export interface GraphNodeTapEvent {
  aggregate?: string;
  aggregateValue?: string;
  app: string;
  hasMissingSC: boolean;
  isInaccessible: boolean;
  isOutside: boolean;
  isServiceEntry: boolean;
  isUnused: boolean;
  namespace: string;
  nodeType: NodeType;
  service: string;
  version?: string;
  workload: string;
}

export interface GraphNodeDoubleTapEvent extends GraphNodeTapEvent {}

// exporting this class for testing
export default class CytoscapeGraph extends React.Component<CytoscapeGraphProps> {
  static contextTypes = {
    router: () => null
  };
  static defaultProps = {
    isMiniGraph: false
  };
  // for dbl-click support
  static doubleTapMs = 350;
  static tapTarget: any;
  static tapTimeout: any;
  static readonly DataNodeId = 'data-node-id';

  private graphHighlighter?: GraphHighlighter;
  private trafficRenderer?: TrafficRender;
  private focusSelector?: string;
  private cytoscapeReactWrapperRef: any;
  private readonly contextMenuRef: React.RefObject<CytoscapeContextMenuWrapper>;
  private namespaceChanged: boolean;
  private nodeChanged: boolean;
  private resetSelection: boolean = false;
  private initialValues: InitialValues;
  private cy?: Cy.Core;

  constructor(props: CytoscapeGraphProps) {
    super(props);
    this.focusSelector = props.focusSelector;
    this.namespaceChanged = false;
    this.nodeChanged = false;
    this.initialValues = {
      position: undefined,
      zoom: undefined
    };
    this.cytoscapeReactWrapperRef = React.createRef();
    this.contextMenuRef = React.createRef<CytoscapeContextMenuWrapper>();
  }

  componentDidMount() {
    const cy = this.getCy();
    this.cyInitialization(cy);
    if (this.props.trace) {
      showTrace(cy, this.props.trace);
    }
  }

  shouldComponentUpdate(nextProps: CytoscapeGraphProps) {
    this.nodeChanged =
      this.nodeChanged || this.props.graphData.fetchParams.node !== nextProps.graphData.fetchParams.node;

    // only update on display changes for the existing graph. Duration or refreshInterval changes don't
    // affect display. Options that trigger a graph refresh will have an update when the refresh
    // completes (showSecurity, showServiceNodes, showUnusedNodes, etc).
    let result =
      this.props.edgeLabelMode !== nextProps.edgeLabelMode ||
      this.props.graphData.isLoading !== nextProps.graphData.isLoading ||
      this.props.graphData.elements !== nextProps.graphData.elements ||
      this.props.layout !== nextProps.layout ||
      this.props.compressOnHide !== nextProps.compressOnHide ||
      this.props.showCircuitBreakers !== nextProps.showCircuitBreakers ||
      this.props.showMissingSidecars !== nextProps.showMissingSidecars ||
      this.props.showNodeLabels !== nextProps.showNodeLabels ||
      this.props.showTrafficAnimation !== nextProps.showTrafficAnimation ||
      this.props.showVirtualServices !== nextProps.showVirtualServices ||
      this.props.trace !== nextProps.trace;

    return result;
  }

  componentDidUpdate(prevProps: CytoscapeGraphProps) {
    if (this.props.graphData.isLoading) {
      return;
    }

    const cy = this.getCy();
    if (!cy) {
      return;
    }

    let updateLayout = false;
    if (
      this.nodeNeedsRelayout() ||
      this.namespaceNeedsRelayout(prevProps.graphData.elements, this.props.graphData.elements) ||
      this.elementsNeedRelayout(prevProps.graphData.elements, this.props.graphData.elements) ||
      this.props.layout.name !== prevProps.layout.name
    ) {
      updateLayout = true;
    }

    this.processGraphUpdate(cy, updateLayout);

    // pre-select node if provided
    const node = this.props.graphData.fetchParams.node;
    if (node && cy && cy.$(':selected').length === 0) {
      let selector = "[nodeType = '" + node.nodeType + "']";
      switch (node.nodeType) {
        case NodeType.AGGREGATE:
          selector =
            selector + "[aggregate = '" + node.aggregate! + "'][aggregateValue = '" + node.aggregateValue! + "']";
          break;
        case NodeType.APP:
          selector = selector + "[app = '" + node.app + "']";
          if (node.version && node.version !== UNKNOWN) {
            selector = selector + "[version = '" + node.version + "']";
          }
          break;
        case NodeType.SERVICE:
          selector = selector + "[service = '" + node.service + "']";
          break;
        default:
          selector = selector + "[workload = '" + node.workload + "']";
      }
      const eles = cy.nodes(selector);
      if (eles.length > 0) {
        this.selectTargetAndUpdateSummary(eles[0]);
      }
    }
    if (this.props.graphData.elements !== prevProps.graphData.elements) {
      this.updateHealth(cy);
    }
    if (this.props.trace) {
      showTrace(cy, this.props.trace);
    } else if (!this.props.trace && prevProps.trace) {
      hideTrace(cy);
    }
  }

  render() {
    return (
      <div id="cytoscape-container" className={this.props.containerClassName}>
        <ReactResizeDetector handleWidth={true} handleHeight={true} skipOnMount={false} onResize={this.onResize} />
        <EmptyGraphLayout
          action={this.props.onEmptyGraphAction}
          displayUnusedNodes={this.props.displayUnusedNodes}
          elements={this.props.graphData.elements}
          error={this.props.graphData.errorMessage}
          isDisplayingUnusedNodes={this.props.showUnusedNodes}
          isLoading={this.props.graphData.isLoading}
          isError={!!this.props.graphData.isError}
          isMiniGraph={this.props.isMiniGraph}
          namespaces={this.props.graphData.fetchParams.namespaces}
        >
          <CytoscapeContextMenuWrapper
            ref={this.contextMenuRef}
            edgeContextMenuContent={this.props.contextMenuEdgeComponent}
            nodeContextMenuContent={this.props.contextMenuNodeComponent}
            groupContextMenuContent={this.props.contextMenuGroupComponent}
          />
          <CytoscapeReactWrapper ref={e => this.setCytoscapeReactWrapperRef(e)} />
        </EmptyGraphLayout>
      </div>
    );
  }

  getCy() {
    return this.cytoscapeReactWrapperRef.current ? this.cytoscapeReactWrapperRef.current.getCy() : null;
  }

  static buildTapEventArgs(event: CytoscapeClickEvent): GraphNodeTapEvent {
    const target = event.summaryTarget;
    const targetType = event.summaryType;
    const targetOrGroupChildren = targetType === 'group' ? target.descendants() : target;

    // Invoke callback
    return {
      aggregate: target.data(CyNode.aggregate),
      aggregateValue: target.data(CyNode.aggregateValue),
      app: target.data(CyNode.app),
      hasMissingSC: targetOrGroupChildren.every(t => t.data(CyNode.hasMissingSC)),
      isInaccessible: target.data(CyNode.isInaccessible),
      isOutside: target.data(CyNode.isOutside),
      isServiceEntry: target.data(CyNode.isServiceEntry),
      isUnused: targetOrGroupChildren.every(t => t.data(CyNode.isUnused)),
      namespace: target.data(CyNode.namespace),
      nodeType: target.data(CyNode.nodeType),
      service: target.data(CyNode.service),
      version: targetType === 'group' ? undefined : target.data(CyNode.version),
      workload: target.data(CyNode.workload)
    };
  }

  private setCytoscapeReactWrapperRef(cyRef: any) {
    this.cytoscapeReactWrapperRef.current = cyRef;
    this.cyInitialization(this.getCy());
  }

  private onResize = () => {
    if (this.cy) {
      this.cy.resize();
      const currentPosition = this.cy.pan();
      const currentZoom = this.cy.zoom();
      if (
        this.initialValues.position &&
        this.initialValues.position.x === currentPosition.x &&
        this.initialValues.position.y === currentPosition.y &&
        this.initialValues.zoom === currentZoom
      ) {
        // There was a resize, but we are in the initial pan/zoom state, we can fit again.
        this.safeFit(this.cy);
      }
    }
  };

  private cyInitialization(cy: Cy.Core) {
    if (!cy) {
      return;
    }

    // Caches the cy instance that is currently in use.
    // If that cy instance is the same one we are being asked to initialize, do NOT initialize it again;
    // this would add duplicate callbacks and would screw up the graph highlighter. If, however,
    // we are being asked to initialize a different cy instance, we assume the current one is now obsolete
    // so we do want to initialize the new cy instance.
    if (this.cy === cy) {
      return;
    }
    this.cy = cy;

    this.contextMenuRef!.current!.connectCy(this.cy);

    this.graphHighlighter = new GraphHighlighter(cy);
    this.trafficRenderer = new TrafficRender(cy, cy.edges());

    const getCytoscapeBaseEvent = (event: Cy.EventObject): CytoscapeBaseEvent | null => {
      const target = event.target;
      if (target === cy) {
        return { summaryType: 'graph', summaryTarget: cy };
      } else if (isNode(target)) {
        if (target.data(CyNode.isGroup)) {
          return { summaryType: 'group', summaryTarget: target };
        } else {
          return { summaryType: 'node', summaryTarget: target };
        }
      } else if (isEdge(target)) {
        return { summaryType: 'edge', summaryTarget: target };
      } else {
        return null;
      }
    };

    const findRelatedNode = element => {
      // Skip top-level node, this one has margins that we don't want to consider.
      if (element.getAttribute(CytoscapeGraph.DataNodeId)) {
        return null;
      }
      while (element && element.getAttribute) {
        const dataNodeId = element.getAttribute(CytoscapeGraph.DataNodeId);
        if (dataNodeId) {
          return dataNodeId;
        }
        element = element.parentNode;
      }
      return null;
    };

    cy.on('tap', (event: Cy.EventObject) => {
      // Check if we clicked a label, if so stop processing the event right away.
      if (event.originalEvent) {
        const element = document.elementFromPoint(event.originalEvent.clientX, event.originalEvent.clientY);
        const realTargetId = findRelatedNode(element);
        if (realTargetId) {
          const realTarget = cy.$id(realTargetId);
          if (realTarget) {
            event.preventDefault();
            realTarget.trigger('tap');
            return;
          }
        }
      }

      let tapped: NodeSingular | EdgeSingular | Core | null = event.target;
      if (CytoscapeGraph.tapTimeout) {
        // cancel any single-tap timer in progress
        clearTimeout(CytoscapeGraph.tapTimeout);
        CytoscapeGraph.tapTimeout = null;

        if (tapped === CytoscapeGraph.tapTarget) {
          // if we click the same target again, perform double-tap
          tapped = null;
          CytoscapeGraph.tapTarget = null;
          const cytoscapeEvent = getCytoscapeBaseEvent(event);
          if (cytoscapeEvent) {
            this.handleDoubleTap(cytoscapeEvent);
          }
        }
      }
      if (tapped) {
        // start single-tap timer
        CytoscapeGraph.tapTarget = tapped;
        CytoscapeGraph.tapTimeout = setTimeout(() => {
          // timer expired without a follow-up click, so perform single-tap
          CytoscapeGraph.tapTarget = null;
          const cytoscapeEvent = getCytoscapeBaseEvent(event);
          if (cytoscapeEvent) {
            this.handleTap(cytoscapeEvent);
            this.selectTarget(event.target, true);
          }
        }, CytoscapeGraph.doubleTapMs);
      }
    });
    cy.on('mouseover', 'node,edge', (evt: Cy.EventObject) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        this.handleMouseIn(cytoscapeEvent);
      }
    });

    cy.on('mouseout', 'node,edge', (evt: Cy.EventObject) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        this.handleMouseOut(cytoscapeEvent);
      }
    });

    cy.on('nodehtml-create-or-update', 'node', (evt: Cy.EventObjectNode, data: any) => {
      const { label, isNew } = data;
      const { target } = evt;
      // This is the DOM node of the label, if we want the cyNode it is `target`
      const node = label.getNode();

      // Assign to the label node (the DOM element) an id that matches the cy node.
      // This is so that when we click, we can identify if the clicked label belongs to
      // any cy node and select it
      // Note that we don't add an actual listener to this DOM node. We use the cy click event, this proved to be more
      // stable than adding a listener. As we only want the contents to match and not the whole node (which is bigger).
      if (isNew) {
        node.setAttribute('data-node-id', target.id());
      }

      // Skip parent nodes from bounding expansion calculation, their size is defined by their contents, so no point in
      // messing with these values.
      if (target.isParent()) {
        return;
      }

      // The code below expands the bounds of a node, taking into consideration the labels. This is important not only
      // for displaying the label, but to avoid nodes overlapping with other labels.
      // We assume that a label is placed centered in the bottom part of a node.
      // The algorithm is:
      // - Take the old bounds-expansion
      // - Get the bounding-box of a node (without taking into account the overlays  i.e. the one that appears on click)
      // - Compute the required extra width as the label width minus the bounding box width
      //   - This will yield a a positive number if we need more space, or negative if we need less space.
      // - Compute the required height as the height of the label. Since the label is at the bottom, we only need that.
      //   If its center was aligned with the center of the node, we would do a similar operation as with the width.
      // - Spread the required width as extra space in the left area and space in the right area of the cy node
      //   (half in each side)
      // - Required height is only needed at the bottom, so we now that we always have to grow at the bottom by this value.

      let oldBE = target.numericStyle('bounds-expansion');
      if (oldBE.length === 1) {
        oldBE = Array(4).fill(oldBE[0]);
      }
      // Do not include the "click" overlay on the bounding box calc
      const bb = target.boundingBox({ includeOverlays: false });
      let newBE = [...oldBE];
      const requiredWidth = node.offsetWidth - bb.w;
      const requiredHeight = node.offsetHeight;
      newBE[1] += requiredWidth * 0.5;
      newBE[3] += requiredWidth * 0.5;
      newBE[2] = requiredHeight;

      // Ensure we don't end with negative values in our bounds-expansion
      newBE = newBE.map(val => Math.max(val, 0));

      const compareBoundsExpansion = (be1: number[], be2: number[]) => {
        if (be1.length !== be2.length) {
          return false;
        }

        const delta = 0.00001;

        for (let i = 0; i < be1.length; ++i) {
          if (Math.abs(be1[i] - be2[i]) > delta) {
            return false;
          }
        }
        return true;
      };

      // Only trigger an update if it really changed, else just skip to avoid this function to call again
      if (!compareBoundsExpansion(oldBE, newBE)) {
        target.style('bounds-expansion', newBE);
        // bounds-expansion changed. Make sure we tell our parent (if any) to update as well (so he can update the label position).
        if (target.isChild()) {
          // The timeout ensures that the previous value is already applied
          setTimeout(() => {
            if (!target.cy().destroyed()) {
              (target.cy() as any) // because we are using an extension
                .nodeHtmlLabel()
                .updateNodeLabel(target.parent());
            }
          }, 0);
        }
      }
    });

    cy.on('layoutstop', (_evt: Cy.EventObject) => {
      // Don't allow a large zoom if the graph has a few nodes (nodes would look too big).
      this.safeFit(cy);
      this.fixLoopOverlap(cy);
    });

    cy.ready((evt: Cy.EventObject) => {
      if (this.props.onReady) {
        this.props.onReady(evt.cy);
      }
      this.processGraphUpdate(cy, true);
    });

    cy.on('destroy', (_evt: Cy.EventObject) => {
      this.trafficRenderer!.stop();
      this.cy = undefined;
      if (this.props.updateSummary) {
        this.props.updateSummary({ summaryType: 'graph', summaryTarget: undefined });
      }
    });
  }

  private focus(cy: Cy.Core) {
    if (!!!this.focusSelector) {
      return;
    }

    let selected = cy.$(this.focusSelector);

    // only perform the focus one time
    this.focusSelector = undefined;

    if (!selected) {
      return;
    }

    // If there is only one, select it
    if (selected.length === 1) {
      this.selectTargetAndUpdateSummary(selected[0]);
    } else {
      // If we have many elements, try to check if a compound in this query contains everything, if so, select it.
      const compound = selected.filter('$node > node');
      if (compound && compound.length === 1 && selected.subtract(compound).same(compound.children())) {
        this.selectTargetAndUpdateSummary(compound[0]);
        selected = compound;
      }
    }

    // Start animation
    new FocusAnimation(cy).start(selected);
  }

  private safeFit(cy: Cy.Core) {
    this.focus(cy);
    CytoscapeGraphUtils.safeFit(cy);
    this.initialValues.position = { ...cy.pan() };
    this.initialValues.zoom = cy.zoom();
  }

  private processGraphUpdate(cy: Cy.Core, updateLayout: boolean) {
    this.trafficRenderer!.stop();

    const isTheGraphSelected = cy.$(':selected').length === 0;
    if (this.resetSelection) {
      if (!isTheGraphSelected) {
        this.selectTarget();
        this.handleTap({ summaryType: 'graph', summaryTarget: cy });
      }
      this.resetSelection = false;
    }

    const globalScratchData: CytoscapeGlobalScratchData = {
      activeNamespaces: this.props.graphData.fetchParams.namespaces,
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphData.fetchParams.graphType,
      mtlsEnabled: this.props.isMTLSEnabled,
      showCircuitBreakers: this.props.showCircuitBreakers,
      showMissingSidecars: this.props.showMissingSidecars,
      showSecurity: this.props.showSecurity,
      showNodeLabels: this.props.showNodeLabels,
      showVirtualServices: this.props.showVirtualServices
    };
    cy.scratch(CytoscapeGlobalScratchNamespace, globalScratchData);

    cy.startBatch();

    // KIALI-1291 issue was caused because some layouts (can't tell if all) do reuse the existing positions.
    // We got some issues when changing from/to cola/cose, as the nodes started to get far away from each other.
    // Previously we deleted the nodes prior to a layout update, this was too much and it seems that only reseting the
    // positions to 0,0 makes the layout more predictable.
    if (updateLayout) {
      cy.nodes().positions({ x: 0, y: 0 });
    }

    // update the entire set of nodes and edges to keep the graph up-to-date
    cy.json({ elements: this.props.graphData.elements });

    cy.endBatch();

    // Run layout and fit outside of the batch operation for it to take effect on the new nodes
    if (updateLayout) {
      CytoscapeGraphUtils.runLayout(cy, this.props.layout);
      this.safeFit(cy);
    }

    // We opt-in for manual selection to be able to control when to select a node/edge
    // https://github.com/cytoscape/cytoscape.js/issues/1145#issuecomment-153083828
    cy.nodes().unselectify();
    cy.edges().unselectify();

    // Verify our current selection is still valid, if not, select the graph
    if (!isTheGraphSelected && cy.$(':selected').length === 0) {
      this.handleTap({ summaryType: 'graph', summaryTarget: cy });
    }

    // Update TrafficRenderer
    this.trafficRenderer!.setEdges(cy.edges());
    if (this.props.showTrafficAnimation) {
      this.trafficRenderer!.start();
    }

    // notify that the graph has been updated
    if (this.props.setUpdateTime) {
      this.props.setUpdateTime(Date.now());
    }
  }

  private selectTarget = (target?: Cy.NodeSingular | Cy.EdgeSingular | Cy.Core, isTapped: boolean = false) => {
    if (this.props.isMiniGraph && isTapped) {
      return;
    }
    if (this.cy) {
      this.cy.$(':selected').selectify().unselect().unselectify();
      if (target && !isCore(target)) {
        target.selectify().select().unselectify();
      }
    }
  };

  private selectTargetAndUpdateSummary = (target: Cy.NodeSingular | Cy.EdgeSingular) => {
    this.selectTarget(target);
    const event: CytoscapeClickEvent = {
      summaryType: target.data(CyNode.isGroup) ? 'group' : 'node',
      summaryTarget: target
    };
    if (this.props.updateSummary) {
      this.props.updateSummary(event);
    }
    this.graphHighlighter!.onClick(event);
  };

  private handleDoubleTap = (event: CytoscapeClickEvent) => {
    if (this.props.onNodeDoubleTap && CytoscapeGraph.isCyNodeClickEvent(event)) {
      this.props.onNodeDoubleTap(CytoscapeGraph.buildTapEventArgs(event));
    }
  };

  private handleTap = (event: CytoscapeClickEvent) => {
    if (this.props.updateSummary) {
      this.props.updateSummary(event);
    }

    if (this.props.onNodeTap && CytoscapeGraph.isCyNodeClickEvent(event)) {
      this.props.onNodeTap(CytoscapeGraph.buildTapEventArgs(event));
    }

    if (!this.props.isMiniGraph) {
      this.graphHighlighter!.onClick(event);
    }
  };

  private handleMouseIn = (event: CytoscapeMouseInEvent) => {
    this.graphHighlighter!.onMouseIn(event);
  };

  private handleMouseOut = (event: CytoscapeMouseOutEvent) => {
    this.graphHighlighter!.onMouseOut(event);
  };

  private namespaceNeedsRelayout(prevElements: any, nextElements: any) {
    const needsRelayout = this.namespaceChanged && prevElements !== nextElements;
    if (needsRelayout) {
      this.namespaceChanged = false;
    }
    return needsRelayout;
  }

  private nodeNeedsRelayout() {
    const needsRelayout = this.nodeChanged;
    if (needsRelayout) {
      this.nodeChanged = false;
    }
    return needsRelayout;
  }

  // Tests if the element is still in the current graph
  private isElementValid(ele: Cy.NodeSingular | Cy.EdgeSingular) {
    return ele.cy() === this.cy;
  }

  static isCyNodeClickEvent(event: CytoscapeClickEvent): boolean {
    const targetType = event.summaryType;
    if (targetType !== 'node' && targetType !== 'group') {
      return false;
    }

    return true;
  }

  // To know if we should re-layout, we need to know if any element changed
  // Do a quick round by comparing the number of nodes and edges, if different
  // a change is expected.
  // If we have the same number of elements, compare the ids, if we find one that isn't
  // in the other, we can be sure that there are changes.
  // Worst case is when they are the same, avoid that.
  private elementsNeedRelayout(prevElements: any, nextElements: any) {
    if (prevElements === nextElements) {
      return false;
    }
    if (
      !prevElements ||
      !nextElements ||
      !prevElements.nodes ||
      !prevElements.edges ||
      !nextElements.nodes ||
      !nextElements.edges ||
      prevElements.nodes.length !== nextElements.nodes.length ||
      prevElements.edges.length !== nextElements.edges.length
    ) {
      return true;
    }
    // If both have the same ids, we don't need to relayout
    return !(
      this.nodeOrEdgeArrayHasSameIds(nextElements.nodes, prevElements.nodes) &&
      this.nodeOrEdgeArrayHasSameIds(nextElements.edges, prevElements.edges)
    );
  }

  private nodeOrEdgeArrayHasSameIds<T extends Cy.NodeSingular | Cy.EdgeSingular>(a: Array<T>, b: Array<T>) {
    const aIds = a.map(e => e.id).sort();
    return b
      .map(e => e.id)
      .sort()
      .every((eId, index) => eId === aIds[index]);
  }

  private updateHealth(cy: Cy.Core) {
    if (!cy) {
      return;
    }
    const duration = this.props.graphData.fetchParams.duration;
    // Keep a map of namespace x promises in order not to fetch several times the same data per namespace
    const appHealthPerNamespace = new Map<string, Promise<NamespaceAppHealth>>();
    const serviceHealthPerNamespace = new Map<string, Promise<NamespaceServiceHealth>>();
    const workloadHealthPerNamespace = new Map<string, Promise<NamespaceWorkloadHealth>>();
    // Asynchronously fetch health
    cy.nodes().forEach(ele => {
      const inaccessible = ele.data(CyNode.isInaccessible);
      if (inaccessible) {
        return;
      }
      const namespace = ele.data(CyNode.namespace);
      const namespaceOk = namespace && namespace !== '' && namespace !== UNKNOWN;
      // incomplete telemetry can result in an unknown namespace, if so set nodeType UNKNOWN
      const nodeType = namespaceOk ? ele.data(CyNode.nodeType) : NodeType.UNKNOWN;
      const workload = ele.data(CyNode.workload);
      const workloadOk = workload && workload !== '' && workload !== UNKNOWN;
      // use workload health when workload is set and valid (workload nodes or versionApp nodes)
      const useWorkloadHealth = nodeType === NodeType.WORKLOAD || (nodeType === NodeType.APP && workloadOk);

      if (useWorkloadHealth) {
        let promise = workloadHealthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceWorkloadHealth(namespace, duration);
          workloadHealthPerNamespace.set(namespace, promise);
        }
        this.updateNodeHealth(ele, promise, workload);
      } else if (nodeType === NodeType.APP) {
        const app = ele.data(CyNode.app);
        let promise = appHealthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceAppHealth(namespace, duration);
          appHealthPerNamespace.set(namespace, promise);
        }
        this.updateNodeHealth(ele, promise, app);
        // TODO: If we want to block health checks for service entries, uncomment this (see kiali-2029)
        // } else if (nodeType === NodeType.SERVICE && !ele.data(CyNode.isServiceEntry)) {
      } else if (nodeType === NodeType.SERVICE) {
        const service = ele.data(CyNode.service);

        let promise = serviceHealthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceServiceHealth(namespace, duration);
          serviceHealthPerNamespace.set(namespace, promise);
        }
        this.updateNodeHealth(ele, promise, service);
      }
    });
  }

  private updateNodeHealth(
    ele: Cy.NodeSingular,
    promise: Promise<H.NamespaceAppHealth | H.NamespaceServiceHealth | H.NamespaceWorkloadHealth>,
    key: string
  ) {
    ele.data(
      'healthPromise',
      promise.then(nsHealth => nsHealth[key])
    );
    promise
      .then(nsHealth => {
        // Discard if the element is no longer valid
        if (this.isElementValid(ele)) {
          const health = nsHealth[key];
          if (health) {
            const status = health.getGlobalStatus();
            ele.removeClass(H.DEGRADED.name + ' ' + H.FAILURE.name);
            if (status === H.DEGRADED || status === H.FAILURE) {
              ele.addClass(status.name);
            }
          } else {
            ele.removeClass(`${H.DEGRADED.name}  ${H.FAILURE.name} ${H.HEALTHY.name}`);
            console.debug(`No health found for [${ele.data(CyNode.nodeType)}] [${key}]`);
          }
        }
      })
      .catch(err => {
        // Discard if the element is no longer valid
        if (this.isElementValid(ele)) {
          ele.removeClass(`${H.DEGRADED.name}  ${H.FAILURE.name} ${H.HEALTHY.name}`);
        }
        console.error(`Could not fetch health for [${ele.data(CyNode.nodeType)}] [${key}]: ${API.getErrorString(err)}`);
      });
  }

  private fixLoopOverlap(cy: Cy.Core) {
    cy.$(':loop').forEach(loop => {
      const node = loop.source();
      const otherEdges = node.connectedEdges().subtract(loop);
      const minDistance = 1;

      // Default values in rads (taken from cytoscape docs)
      const DEFAULT_LOOP_SWEEP = -1.5707;
      const DEFAULT_LOOP_DIRECTION = -0.7854;

      loop.style('loop-direction', DEFAULT_LOOP_DIRECTION);
      loop.style('loop-sweep', DEFAULT_LOOP_SWEEP);

      let found = false;
      // Check if we have any other edge that overlaps with any of our loop edges
      // this uses cytoscape forEach (https://js.cytoscape.org/#eles.forEach)
      otherEdges.forEach(edge => {
        const testPoint = edge.source().same(node) ? edge.sourceEndpoint() : edge.targetEndpoint();
        if (
          squaredDistance(testPoint, loop.sourceEndpoint()) <= minDistance ||
          squaredDistance(testPoint, loop.targetEndpoint()) <= minDistance
        ) {
          found = true;
          return false; // break the inner cytoscape forEach
        }
        return; // return to avoid typescript error about "not all code paths return a value"
      });

      if (!found) {
        return;
      }

      // Simple case, one other edge, just move the loop-direction half the default loop-sweep value to avoid the edge
      if (otherEdges.length === 1) {
        const loopDirection = loop.numericStyle('loop-direction') - loop.numericStyle('loop-sweep') * 0.5;
        loop.style('loop-direction', loopDirection);
        return;
      }

      // Compute every angle between the top (12 o’clock position)
      // We store the angles as radians and positive numbers, thus we add PI to the negative angles.
      const usedAngles: number[] = [];
      otherEdges.forEach(edge => {
        const testPoint = edge.source().same(node) ? edge.sourceEndpoint() : edge.targetEndpoint();
        const angle = angleBetweenVectors(
          normalize({ x: testPoint.x - node.position().x, y: testPoint.y - node.position().y }),
          { x: 0, y: 1 }
        );
        usedAngles.push(angle < 0 ? angle + 2 * Math.PI : angle);
      });

      usedAngles.sort((a, b) => a - b);

      // Try to fit our loop in the longest arc
      // Iterate over the found angles and find the longest distance
      let maxArc = {
        start: 0,
        end: 0,
        value: 0
      };
      for (let i = 0; i < usedAngles.length; ++i) {
        const start = i === 0 ? usedAngles[usedAngles.length - 1] : usedAngles[i - 1];
        const end = usedAngles[i];
        const arc = Math.abs(start - end);
        if (arc > maxArc.value) {
          maxArc.value = arc;
          maxArc.start = start;
          maxArc.end = end;
        }
      }

      // If the max arc is 1.0 radians (the biggest gap is of about 50 deg), the node is already too busy, ignore it
      if (maxArc.value < 1.0) {
        return;
      }

      if (maxArc.start > maxArc.end) {
        // To ensure the difference between end and start goes in the way we want, we add a full circle to our end
        maxArc.end += Math.PI * 2;
      }

      if (maxArc.value <= -DEFAULT_LOOP_SWEEP) {
        // Make it slightly smaller to be able to fit
        // loop-sweep is related to the distance between the start and end of our loop edge
        loop.style('loop-sweep', -maxArc.value * 0.9);
        maxArc.start += maxArc.value * 0.05;
        maxArc.end -= maxArc.value * 0.05;
      }
      // Move the loop to the center of the arc, loop-direction is related to the middle point of the loop
      loop.style('loop-direction', maxArc.start + (maxArc.end - maxArc.start) * 0.5);
    });
  }
}
