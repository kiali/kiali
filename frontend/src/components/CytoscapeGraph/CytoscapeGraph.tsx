import * as Cy from 'cytoscape';
import { Core, EdgeSingular, NodeSingular } from 'cytoscape';
import * as React from 'react';
import ReactResizeDetector from 'react-resize-detector';
import { GraphData } from 'pages/Graph/GraphPage';
import { IntervalInMilliseconds, TimeInMilliseconds } from '../../types/Common';
import {
  BoxByType,
  CLUSTER_DEFAULT,
  CytoscapeBaseEvent,
  GraphEvent,
  CytoscapeGlobalScratchData,
  CytoscapeGlobalScratchNamespace,
  EdgeLabelMode,
  EdgeMode,
  Layout,
  NodeParamsType,
  NodeType,
  RankMode,
  RankResult,
  SummaryData,
  UNKNOWN,
  NodeAttr
} from '../../types/Graph';
import { JaegerTrace } from 'types/TracingInfo';
import { Namespace } from '../../types/Namespace';
import { addInfo } from 'utils/AlertUtils';
import { angleBetweenVectors, squaredDistance, normalize } from '../../utils/MathUtils';
import { WizardAction, WizardMode } from '../IstioWizards/WizardActions';
import {
  CytoscapeContextMenuWrapper,
  NodeContextMenuComponentType,
  EdgeContextMenuComponentType
} from './CytoscapeContextMenu';
import * as CytoscapeGraphUtils from './CytoscapeGraphUtils';
import { isCore, isEdge, isNode } from './CytoscapeGraphUtils';
import { CytoscapeReactWrapper } from './CytoscapeReactWrapper';
import { showTrace, hideTrace } from './CytoscapeTrace';
import { EmptyGraphLayout } from './EmptyGraphLayout';
import { FocusAnimation } from './FocusAnimation';
import { GraphHighlighter } from './graphs/GraphHighlighter';
import { TrafficRenderer } from './TrafficAnimation/TrafficRenderer';
import { homeCluster, serverConfig } from 'config';
import { decoratedNodeData } from './CytoscapeGraphUtils';
import { scoreNodes, ScoringCriteria } from './GraphScore';
import { assignEdgeHealth } from 'types/ErrorRate/GraphEdgeStatus';
import { PeerAuthentication } from 'types/IstioObjects';
import { ServiceDetailsInfo } from 'types/ServiceInfo';

type CytoscapeGraphProps = {
  containerClassName?: string;
  contextMenuEdgeComponent?: EdgeContextMenuComponentType;
  contextMenuNodeComponent?: NodeContextMenuComponentType;
  edgeLabels: EdgeLabelMode[];
  edgeMode: EdgeMode;
  focusSelector?: string;
  graphData: GraphData;
  isMiniGraph: boolean;
  layout: Layout;
  namespaceLayout: Layout;
  onDeleteTrafficRouting?: (key: string, serviceDetails: ServiceDetailsInfo) => void;
  onEdgeTap?: (e: GraphEdgeTapEvent) => void;
  onEmptyGraphAction?: () => void;
  onLaunchWizard?: (
    key: WizardAction,
    mode: WizardMode,
    namespace: string,
    serviceDetails: ServiceDetailsInfo,
    gateways: string[],
    peerAuths: PeerAuthentication[]
  ) => void;
  onNodeDoubleTap?: (e: GraphNodeDoubleTapEvent) => void;
  onNodeTap?: (e: GraphNodeTapEvent) => void;
  onReady?: (cytoscapeRef: any) => void;
  rankBy: RankMode[];
  refreshInterval: IntervalInMilliseconds;
  setActiveNamespaces?: (namespace: Namespace[]) => void;
  setNode?: (node?: NodeParamsType) => void;
  setRankResult?: (result: RankResult) => void;
  setTraceId?: (traceId?: string) => void;
  setUpdateTime?: (val: TimeInMilliseconds) => void;
  showIdleEdges: boolean;
  showIdleNodes: boolean;
  showOperationNodes: boolean;
  showOutOfMesh: boolean;
  showRank: boolean;
  showSecurity: boolean;
  showServiceNodes: boolean;
  showTrafficAnimation: boolean;
  showVirtualServices: boolean;
  summaryData: SummaryData | null;
  theme: string;
  toggleIdleNodes: () => void;
  trace?: JaegerTrace;
  updateSummary?: (event: GraphEvent) => void;
};

// This is a Cypress test hook. Cypress-react-selector can access the react node state, and so
// by offering `cy`, we can validate graph impact of test automation actions.  Note that state updates
// do not cause component updates (see shouldComponentUpdate)
type CytoscapeGraphState = {
  cy: Cy.Core | null;
};

export interface GraphEdgeTapEvent {
  namespace: string;
  source: string;
  target: string;
  type: string;
}

export interface GraphNodeTapEvent {
  aggregate?: string;
  aggregateValue?: string;
  app: string;
  cluster?: string;
  isBox?: string;
  isIdle: boolean;
  isInaccessible: boolean;
  isOutOfMesh: boolean;
  isOutside: boolean;
  isServiceEntry: boolean;
  isWaypoint?: boolean;
  namespace: string;
  nodeType: NodeType;
  service: string;
  version?: string;
  workload: string;
}

export interface GraphNodeDoubleTapEvent extends GraphNodeTapEvent {}

// exporting this class for testing
export class CytoscapeGraph extends React.Component<CytoscapeGraphProps, CytoscapeGraphState> {
  static contextTypes = {
    router: (): null => null
  };
  static defaultProps = {
    isMiniGraph: false
  };

  // for hover support
  static hoverInMs = 260;
  static hoverOutMs = 100;
  static mouseInTarget: any;
  static mouseInTimeout: any;
  static mouseOutTimeout: any;

  // for dbl-click support
  static doubleTapMs = 350;
  static tapTarget: any;
  static tapTimeout: any;
  static readonly DataNodeId = 'data-node-id';

  private readonly contextMenuRef: React.RefObject<CytoscapeContextMenuWrapper>;
  private cy?: Cy.Core;
  private customViewport: boolean;
  private cytoscapeGraphRef: any;
  private cytoscapeReactWrapperRef: any;
  private focusSelector?: string;
  private graphHighlighter?: GraphHighlighter;
  private needsInitialLayout: boolean;
  private nodeChanged: boolean;
  private trafficRenderer?: TrafficRenderer;
  private userBoxSelected?: Cy.Collection;
  private zoom: number; // the current zoom value, used for checking threshold crossing
  private zoomIgnore: boolean; // used to ignore zoom events when cy sometimes generates 'intermediate' values
  private zoomThresholds: number[];

  constructor(props: CytoscapeGraphProps) {
    super(props);
    this.contextMenuRef = React.createRef<CytoscapeContextMenuWrapper>();
    this.customViewport = false;
    this.cytoscapeGraphRef = React.createRef<CytoscapeGraph>();
    this.cytoscapeReactWrapperRef = React.createRef();
    this.focusSelector = props.focusSelector;
    this.needsInitialLayout = false;
    this.nodeChanged = false;
    this.state = {
      cy: null
    };
    this.zoom = 1; // 1 is the default cy zoom
    this.zoomIgnore = true; // ignore zoom events prior to the first rendering
    const settings = serverConfig.kialiFeatureFlags.uiDefaults.graph.settings;
    this.zoomThresholds = Array.from(
      new Set([settings.minFontLabel / settings.fontLabel, settings.minFontBadge / settings.fontLabel])
    );
  }

  componentDidMount(): void {
    this.cyInitialization(this.getCy()!);
  }

  shouldComponentUpdate(nextProps: CytoscapeGraphProps): boolean {
    this.nodeChanged =
      this.nodeChanged || this.props.graphData.fetchParams.node !== nextProps.graphData.fetchParams.node;

    // only update on display changes for the existing graph. Duration or refreshInterval changes don't
    // affect display. Options that trigger a graph refresh will have an update when the refresh
    // completes (showIdleNodes, showSecurity, showServiceNodes, etc).
    let result =
      this.props.edgeLabels !== nextProps.edgeLabels ||
      this.props.graphData.isLoading !== nextProps.graphData.isLoading ||
      this.props.graphData.elements !== nextProps.graphData.elements ||
      this.props.layout !== nextProps.layout ||
      this.props.namespaceLayout !== nextProps.namespaceLayout ||
      this.props.rankBy !== nextProps.rankBy ||
      this.props.showOutOfMesh !== nextProps.showOutOfMesh ||
      this.props.showRank !== nextProps.showRank ||
      this.props.showTrafficAnimation !== nextProps.showTrafficAnimation ||
      this.props.showVirtualServices !== nextProps.showVirtualServices ||
      this.props.trace !== nextProps.trace;

    return result;
  }

  componentDidUpdate(prevProps: CytoscapeGraphProps): void {
    const cy = this.getCy();
    if (!cy) {
      return;
    }
    if (this.props.graphData.isLoading) {
      return;
    }

    // Check to see if we should run a layout when we process the graphUpdate
    let runLayout = false;
    const newLayout =
      this.props.layout.name !== prevProps.layout.name ||
      this.props.namespaceLayout.name !== prevProps.namespaceLayout.name;

    if (this.needsInitialLayout || newLayout || this.props.graphData.elementsChanged || this.nodeNeedsRelayout()) {
      this.needsInitialLayout = false;
      runLayout = true;
    }

    cy.emit('kiali-zoomignore', [true]);
    this.processGraphUpdate(cy, runLayout, newLayout).then(_response => {
      // pre-select node if provided
      const node = this.props.graphData.fetchParams.node;
      if (node && cy && cy.$(':selected').length === 0) {
        let selector = `[namespace = "${node.namespace.name}"][nodeType = "${node.nodeType}"]`;
        switch (node.nodeType) {
          case NodeType.AGGREGATE:
            selector = `${selector}[aggregate = ' ${node.aggregate!} '][aggregateValue = ' ${node.aggregateValue!} ']`;
            break;
          case NodeType.APP:
          case NodeType.BOX: // we only support app box node graphs, treat like an app node
            selector = `${selector}[app = ' node.app ']`;
            if (node.version && node.version !== UNKNOWN) {
              selector = `${selector}[version = ' node.version ']`;
            }
            break;
          case NodeType.SERVICE:
            selector = `${selector}[service = ' node.service ']`;
            break;
          default:
            selector = `${selector}[workload = ' node.workload ']`;
        }

        const eles = cy.nodes(selector);
        if (eles.length > 0) {
          let target = eles[0];
          // default app to the whole app box, when appropriate
          if (
            (node.nodeType === NodeType.APP || node.nodeType === NodeType.BOX) &&
            !node.version &&
            target.isChild() &&
            target.parent()[0].data(NodeAttr.isBox) === BoxByType.APP
          ) {
            target = target.parent()[0];
          }

          this.selectTargetAndUpdateSummary(target);
        }
      }

      if (this.props.trace) {
        showTrace(cy, this.props.graphData.fetchParams.graphType, this.props.trace);
      } else if (!this.props.trace && prevProps.trace) {
        hideTrace(cy);
      }
    });
  }

  componentWillUnmount(): void {
    if (CytoscapeGraph.mouseInTimeout) {
      clearTimeout(CytoscapeGraph.mouseInTimeout);
      CytoscapeGraph.mouseInTimeout = null;
    }
    if (CytoscapeGraph.mouseOutTimeout) {
      clearTimeout(CytoscapeGraph.mouseOutTimeout);
      CytoscapeGraph.mouseOutTimeout = null;
    }
  }

  render(): React.ReactElement {
    return (
      <div id="cytoscape-graph" className={this.props.containerClassName} ref={this.cytoscapeGraphRef}>
        <ReactResizeDetector handleWidth={true} handleHeight={true} skipOnMount={false} onResize={this.onResize} />
        <EmptyGraphLayout
          action={this.props.onEmptyGraphAction}
          elements={this.props.graphData.elements}
          error={this.props.graphData.errorMessage}
          isLoading={this.props.graphData.isLoading}
          isError={!!this.props.graphData.isError}
          isMiniGraph={this.props.isMiniGraph}
          namespaces={this.props.graphData.fetchParams.namespaces}
          showIdleNodes={this.props.showIdleNodes}
          toggleIdleNodes={this.props.toggleIdleNodes}
        >
          <CytoscapeContextMenuWrapper
            ref={this.contextMenuRef}
            contextMenuEdgeComponent={this.props.contextMenuEdgeComponent}
            contextMenuNodeComponent={this.props.contextMenuNodeComponent}
            onDeleteTrafficRouting={this.props.onDeleteTrafficRouting}
            onLaunchWizard={this.props.onLaunchWizard}
            theme={this.props.theme}
          />
          <CytoscapeReactWrapper ref={e => this.setCytoscapeReactWrapperRef(e)} />
        </EmptyGraphLayout>
      </div>
    );
  }

  getCy(): Cy.Core | null {
    return this.cytoscapeReactWrapperRef.current ? this.cytoscapeReactWrapperRef.current.getCy() : null;
  }

  static buildTapEventArgs(event: GraphEvent): GraphNodeTapEvent | GraphEdgeTapEvent {
    const target = event.summaryTarget;
    const targetType = event.summaryType;
    const targetOrBoxChildren = targetType === 'box' ? target.descendants() : target;

    if (targetType === 'edge') {
      const nodeSource = decoratedNodeData(target.source());
      const nodeTarget = decoratedNodeData(target.target());
      return {
        namespace: nodeSource.namespace,
        type: nodeSource.nodeType,
        source: nodeSource[nodeSource.nodeType],
        target: nodeTarget[nodeTarget.nodeType]
      };
    }
    // Invoke callback
    return {
      aggregate: target.data(NodeAttr.aggregate),
      aggregateValue: target.data(NodeAttr.aggregateValue),
      app: target.data(NodeAttr.app),
      cluster: target.data(NodeAttr.cluster),
      isBox: target.data(NodeAttr.isBox),
      isIdle: targetOrBoxChildren.every(t => t.data(NodeAttr.isIdle)),
      isInaccessible: target.data(NodeAttr.isInaccessible),
      isOutOfMesh: target.data(NodeAttr.isOutOfMesh),
      isOutside: target.data(NodeAttr.isOutside),
      isServiceEntry: target.data(NodeAttr.isServiceEntry),
      isWaypoint: target.data(NodeAttr.isWaypoint),
      namespace: target.data(NodeAttr.namespace),
      nodeType: target.data(NodeAttr.nodeType),
      service: target.data(NodeAttr.service),
      version: targetType === 'box' ? undefined : target.data(NodeAttr.version),
      workload: target.data(NodeAttr.workload)
    };
  }

  private setCytoscapeReactWrapperRef(cyRef: any): void {
    if (this.cytoscapeReactWrapperRef.current !== cyRef) {
      this.cytoscapeReactWrapperRef.current = cyRef;
      const cy = this.getCy();
      this.cyInitialization(cy!);
      this.setState({ cy: cy });
    }
  }

  private onResize = (): void => {
    if (this.cy) {
      this.cy.resize();
      // always fit to the newly sized space
      this.safeFit(this.cy, true);
    }
  };

  private cyInitialization(cy: Cy.Core): void {
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
    this.cy.boxSelectionEnabled(true);

    this.contextMenuRef!.current!.connectCy(this.cy);

    this.graphHighlighter = new GraphHighlighter(cy);
    this.trafficRenderer = new TrafficRenderer(cy);

    const getCytoscapeBaseEvent = (event: Cy.EventObject): CytoscapeBaseEvent | null => {
      const target = event.target;
      if (target === cy) {
        return { summaryType: 'graph', summaryTarget: cy };
      } else if (isNode(target)) {
        if (target.data(NodeAttr.isBox)) {
          return { summaryType: 'box', summaryTarget: target };
        } else {
          return { summaryType: 'node', summaryTarget: target };
        }
      } else if (isEdge(target)) {
        return { summaryType: 'edge', summaryTarget: target };
      } else {
        return null;
      }
    };

    const findRelatedNode = (element: any): null | string => {
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

        // cancel any active hover timers
        if (CytoscapeGraph.mouseInTimeout) {
          clearTimeout(CytoscapeGraph.mouseInTimeout);
          CytoscapeGraph.mouseInTimeout = null;
        }
        if (CytoscapeGraph.mouseOutTimeout) {
          clearTimeout(CytoscapeGraph.mouseOutTimeout);
          CytoscapeGraph.mouseOutTimeout = null;
        }

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
            // ignore if clicking the graph background and this is not the main graph
            if (
              cytoscapeEvent.summaryType === 'graph' &&
              (this.props.isMiniGraph || this.props.graphData.fetchParams.node)
            ) {
              return;
            }

            // if clicking the same target, then unselect it (by re-selecting the graph)
            if (
              this.props.summaryData &&
              cytoscapeEvent.summaryType !== 'graph' &&
              cytoscapeEvent.summaryType === this.props.summaryData.summaryType &&
              cytoscapeEvent.summaryTarget === this.props.summaryData.summaryTarget
            ) {
              this.handleTap({ summaryType: 'graph', summaryTarget: cy } as SummaryData);
              this.selectTarget(cy);
            } else {
              this.handleTap(cytoscapeEvent);
              this.selectTarget(event.target);
            }
          }
        }, CytoscapeGraph.doubleTapMs);
      }
    });

    // Note that at the time of writing (on my chrome) the order of box events:
    // 1) boxstart
    // 2) boxend
    // 3) box, a separate event for each boxselected element
    // The boxselect event never seems to fire. boxend does not seem to supply the boxselected collection (why?).
    // So, boxend seems not useful. I don't see a way to do this other than to 'fit' each time we add an elem.
    cy.on('boxstart', (evt: Cy.EventObject) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        this.userBoxSelected = cy.collection();
      }
    });

    cy.on('box', (evt: Cy.EventObject) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        const elements: Cy.Collection = evt.target;
        if (elements) {
          elements.forEach(e => {
            if (e.data(NodeAttr.nodeType) !== NodeType.BOX) {
              this.userBoxSelected = this.userBoxSelected?.add(elements);
            }
          });
          CytoscapeGraphUtils.safeFit(cy, this.userBoxSelected);
          this.customViewport = true;
        }
      }
    });

    cy.on('mouseover', 'node,edge', (evt: Cy.EventObject) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (!cytoscapeEvent) {
        return;
      }

      // cancel any active mouseOut timer
      if (CytoscapeGraph.mouseOutTimeout) {
        clearTimeout(CytoscapeGraph.mouseOutTimeout);
        CytoscapeGraph.mouseOutTimeout = null;
      }

      // start mouseIn timer
      CytoscapeGraph.mouseInTimeout = setTimeout(() => {
        // timer expired without a mouseout so perform highlighting and show hover contextInfo
        this.handleMouseIn(cytoscapeEvent);

        // if we are not showing labels (due to zoom level), show contextInfo
        const zoom = cy.zoom();
        const noLabels = this.zoomThresholds.some(zoomThresh => {
          return zoom <= zoomThresh;
        });
        if (noLabels) {
          this.contextMenuRef!.current!.handleContextMenu(cytoscapeEvent.summaryTarget, true);
        }
      }, CytoscapeGraph.hoverInMs);

      // change to mouse pointer for consistency in UI
      const container = cy.container();
      if (container !== null) {
        container.style.cursor = 'pointer';
      }
    });

    cy.on('mouseout', 'node,edge', (evt: Cy.EventObject) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);

      if (!cytoscapeEvent) {
        return;
      }

      // cancel any active mouseIn timer
      if (CytoscapeGraph.mouseInTimeout) {
        clearTimeout(CytoscapeGraph.mouseInTimeout);
        CytoscapeGraph.mouseInTimeout = null;
      }

      // start mouseOut timer
      CytoscapeGraph.mouseOutTimeout = setTimeout(() => {
        // timer expired so remove contextInfo
        this.contextMenuRef!.current!.hideContextMenu(true);
      }, CytoscapeGraph.hoverOutMs);

      // remove highlighting
      this.handleMouseOut(cytoscapeEvent);

      // change to mouse pointer back to default, for consistency in UI
      const container = cy.container();
      if (container !== null) {
        container.style.cursor = 'default';
      }
    });

    cy.on('viewport', (evt: Cy.EventObject) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        this.customViewport = true;
      }
    });

    // 'kiali-fit' is a custom event that we emit allowing us to reset cytoscapeGraph.customViewport
    cy.on('kiali-fit', (evt: Cy.EventObject) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        this.customViewport = false;
      }
    });

    // 'kiali-zoomignore' is a custom event that we emit before and after a graph manipulation
    // that can generate unwanted 'intermediate' values (like a CytsoscapeGraphUtils.runLayout()).
    // note - this event does not currently support nesting (i.e. expects true followed by false)
    cy.on('kiali-zoomignore', (evt: Cy.EventObject, zoomIgnore: boolean) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        // When ending the zoomIgnore update to the current zoom level to prepare for the next 'zoom' event
        if (!zoomIgnore) {
          this.zoom = cy.zoom();
        }
        this.zoomIgnore = zoomIgnore;
      }
    });

    // Crossing a zoom threshold can affect labeling, and so we refresh labels when crossing a threshold.
    // Some cy 'zoom' events need to be ignored, typically while a layout or drag-zoom 'box' event is
    // in progress, as cy can generate unwanted 'intermediate' values.  So check for zoomIgnore=true.
    cy.on('zoom', (evt: Cy.EventObject) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (!cytoscapeEvent || this.zoomIgnore) {
        return;
      }

      const oldZoom = this.zoom;
      const newZoom = cy.zoom();
      this.zoom = newZoom;

      const thresholdCrossed = this.zoomThresholds.some(zoomThresh => {
        return (newZoom < zoomThresh && oldZoom >= zoomThresh) || (newZoom >= zoomThresh && oldZoom < zoomThresh);
      });

      if (thresholdCrossed) {
        CytoscapeGraphUtils.refreshLabels(cy, false);
      }
    });

    // We use a 'layoutstop' even handler to perform common handling, as layouts can be initiated
    // outside of just this class (for example, graph hide).
    cy.on('layoutstop', (_evt: Cy.EventObject) => {
      // re-enable zoom handling after the 'fit' to avoid any chance of a zoom-threshold-cross loop
      cy.emit('kiali-zoomignore', [false]);

      // After a layout Cytoscape seems to occasionally use stale visibility and/or positioning for labels.
      // It looks like a cy bug to me, but maybe it has to do with either the html node-label extension,
      // or our BoxLayout.  Anyway, refreshing them here seems to usually fix the issue.
      CytoscapeGraphUtils.refreshLabels(cy, false);

      // Perform a safeFit (one that takes into consideration a custom viewport set by the user).  This will
      // ensure we limit to max-zoom, or fit to the viewport when appropriate.
      this.safeFit(cy);

      // Finally, massage any loop edges as best as possible
      this.fixLoopOverlap(cy);
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

      // Skip root nodes from bounding expansion calculation, their size is defined by their contents, so no point in
      // messing with these values.
      if (target.isParent() && !target.isChild()) {
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
      // - Required height is only needed at the bottom, so we know that we always have to grow at the bottom by this value.

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

      const compareBoundsExpansion = (be1: number[], be2: number[]): boolean => {
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
      }
    });

    cy.ready((evt: Cy.EventObject) => {
      if (this.props.onReady) {
        this.props.onReady(evt.cy);
      }
      this.needsInitialLayout = true;
    });

    cy.on('destroy', (_evt: Cy.EventObject) => {
      this.trafficRenderer!.stop();
      this.trafficRenderer = undefined;
      this.cy = undefined;
      if (this.props.updateSummary) {
        this.props.updateSummary({ summaryType: 'graph', summaryTarget: undefined });
      }
    });
  }

  private focus(cy: Cy.Core): void {
    if (!this.focusSelector) {
      return;
    }

    // only perform the focus one time
    const focusSelector = this.focusSelector;
    this.focusSelector = undefined;

    let selected = cy.$(focusSelector);

    if (!selected) {
      addInfo(
        'Could not focus on requested node. The node may be idle or hidden.',
        true,
        undefined,
        `${focusSelector}`
      );
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

  private safeFit(cy: Cy.Core, force?: boolean): void {
    if (!force && this.customViewport) {
      return;
    }

    CytoscapeGraphUtils.safeFit(cy);
    this.focus(cy);
  }

  private processGraphUpdate(cy: Cy.Core, runLayout: boolean, newLayout: boolean): Promise<void> {
    this.trafficRenderer!.pause();

    const isTheGraphSelected = cy.$(':selected').length === 0;

    const globalScratchData: CytoscapeGlobalScratchData = {
      activeNamespaces: this.props.graphData.fetchParams.namespaces,
      edgeLabels: this.props.edgeLabels,
      forceLabels: false,
      graphType: this.props.graphData.fetchParams.graphType,
      homeCluster: homeCluster?.name || CLUSTER_DEFAULT,
      showOutOfMesh: this.props.showOutOfMesh,
      showSecurity: this.props.showSecurity,
      showVirtualServices: this.props.showVirtualServices,
      trafficRates: this.props.graphData.fetchParams.trafficRates
    };
    cy.scratch(CytoscapeGlobalScratchNamespace, globalScratchData);

    let elements = this.props.graphData.elements;
    let scoringCriteria: ScoringCriteria[] = [];
    if (this.props.showRank) {
      for (const ranking of this.props.rankBy) {
        if (ranking === RankMode.RANK_BY_INBOUND_EDGES) {
          scoringCriteria.push(ScoringCriteria.InboundEdges);
        }
        if (ranking === RankMode.RANK_BY_OUTBOUND_EDGES) {
          scoringCriteria.push(ScoringCriteria.OutboundEdges);
        }
      }

      let upperBound = 0;
      ({ elements, upperBound } = scoreNodes(this.props.graphData.elements, ...scoringCriteria));
      if (this.props.setRankResult) {
        this.props.setRankResult({ upperBound });
      }
    } else {
      scoreNodes(this.props.graphData.elements, ...scoringCriteria);
    }

    // don't preserve any user pan/zoom when completely changing the layout
    if (newLayout) {
      this.customViewport = false;
    }

    cy.startBatch();

    // KIALI-1291 issue was caused because some layouts (can't tell if all) do reuse the existing positions.
    // We got some issues when changing from/to cola/cose, as the nodes started to get far away from each other.
    // Previously we deleted the nodes prior to a layout update, this was too much and it seems that only resetting the
    // positions to 0,0 makes the layout more predictable.
    if (runLayout) {
      cy.nodes().positions({ x: 0, y: 0 });
    }

    // update the entire set of nodes and edges to keep the graph up-to-date
    cy.json({ elements: elements });

    cy.endBatch();

    // Compute edge healths one time for the graph
    assignEdgeHealth(cy);

    // Run layout outside of the batch operation for it to take effect on the new nodes,
    // Layouts can run async so wait until it completes to finish the graph update.
    if (runLayout) {
      return new Promise((resolve, _reject) => {
        CytoscapeGraphUtils.runLayout(cy, this.props.layout, this.props.namespaceLayout).then(_response => {
          this.finishGraphUpdate(cy, isTheGraphSelected, runLayout);
          resolve();
        });
      });
    } else {
      this.finishGraphUpdate(cy, isTheGraphSelected, runLayout);
      return Promise.resolve();
    }
  }

  private finishGraphUpdate(cy: Cy.Core, isTheGraphSelected: boolean, runLayout: boolean): void {
    // We opt-in for manual selection to be able to control when to select a node/edge
    // https://github.com/cytoscape/cytoscape.js/issues/1145#issuecomment-153083828
    cy.nodes().unselectify();
    cy.edges().unselectify();

    // Verify our current selection is still valid, if not, select the graph
    if (!isTheGraphSelected && cy.$(':selected').length === 0) {
      this.handleTap({ summaryType: 'graph', summaryTarget: cy });
    }

    // When the graphUpdate runs a layout then this logic is handled in the 'layoutstop' eventhandler, otherwise do it here
    if (!runLayout) {
      CytoscapeGraphUtils.refreshLabels(cy, false);
      cy.emit('kiali-zoomignore', [false]);
    }

    if (this.props.showTrafficAnimation) {
      this.trafficRenderer!.start(cy.edges());
    }

    // notify that the graph has been updated
    if (this.props.setUpdateTime) {
      this.props.setUpdateTime(Date.now());
    }
  }

  private selectTarget = (target?: Cy.NodeSingular | Cy.EdgeSingular | Cy.Core): void => {
    if (this.cy) {
      this.cy.$(':selected').selectify().unselect().unselectify();
      if (target && !isCore(target)) {
        target.selectify().select().unselectify();
      }
    }
  };

  private selectTargetAndUpdateSummary = (target: Cy.NodeSingular | Cy.EdgeSingular): void => {
    this.selectTarget(target);
    const event: GraphEvent = {
      summaryType: target.data(NodeAttr.isBox) ? 'box' : 'node',
      summaryTarget: target
    };
    if (this.props.updateSummary) {
      this.props.updateSummary(event);
    }
    this.graphHighlighter!.onClick(event);
  };

  private handleDoubleTap = (event: GraphEvent): void => {
    if (this.props.onNodeDoubleTap && CytoscapeGraph.isCyNodeClickEvent(event)) {
      this.props.onNodeDoubleTap(CytoscapeGraph.buildTapEventArgs(event) as GraphNodeTapEvent);
    }
  };

  private handleTap = (event: GraphEvent): void => {
    if (this.props.updateSummary) {
      this.props.updateSummary(event);
    }

    if (this.props.onNodeTap && CytoscapeGraph.isCyNodeClickEvent(event)) {
      this.props.onNodeTap(CytoscapeGraph.buildTapEventArgs(event) as GraphNodeTapEvent);
    }

    if (!this.props.isMiniGraph) {
      this.graphHighlighter!.onClick(event);
    } else if (this.props.onEdgeTap && CytoscapeGraph.isCyEdgeClickEvent(event)) {
      this.props.onEdgeTap(CytoscapeGraph.buildTapEventArgs(event) as GraphEdgeTapEvent);
    }
  };

  private handleMouseIn = (event: GraphEvent): void => {
    this.graphHighlighter!.onMouseIn(event);
  };

  private handleMouseOut = (event: GraphEvent): void => {
    this.graphHighlighter!.onMouseOut(event);
  };

  private nodeNeedsRelayout(): boolean {
    const needsRelayout = this.nodeChanged;
    if (needsRelayout) {
      this.nodeChanged = false;
    }
    return needsRelayout;
  }

  static isCyNodeClickEvent(event: GraphEvent): boolean {
    const targetType = event.summaryType;
    if (targetType !== 'node' && targetType !== 'box') {
      return false;
    }

    return true;
  }

  static isCyEdgeClickEvent(event: GraphEvent): boolean {
    const targetType = event.summaryType;
    return targetType === 'edge';
  }

  private fixLoopOverlap(cy: Cy.Core): void {
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
