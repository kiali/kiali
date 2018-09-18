import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { PropTypes } from 'prop-types';

import { GraphParamsType, GraphType, NodeParamsType, NodeType } from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';
import * as LayoutDictionary from '../../components/CytoscapeGraph/graphs/LayoutDictionary';
import GraphPage from '../../containers/GraphPageContainer';
import { makeNamespaceGraphUrlFromParams, makeNodeGraphUrlFromParams } from '../../components/Nav/NavUtils';
import { config } from '../../config';
import * as Enum from '../../utils/Enum';

const URLSearchParams = require('url-search-params');

const SESSION_KEY = 'graph-params';

type GraphURLProps = {
  // @todo: redo this manual params with Redux-Router
  // @todo: add back in circuit-breaker, route-rules params to Redux-Router for URL-params
  namespace: string;
  app: string;
  version: string;
  workload: string;
  duration: string;
  graphType: string;
  injectServiceNodes: boolean;
  layout: string;
};

/**
 * Handle URL parameters for Graph page
 */
export default class GraphRouteHandler extends React.Component<RouteComponentProps<GraphURLProps>, GraphParamsType> {
  static contextTypes = {
    router: PropTypes.object
  };

  static readonly graphParamsDefaults: GraphParamsType = {
    namespace: { name: 'all' },
    graphDuration: { value: config().toolbar.defaultDuration },
    graphLayout: LayoutDictionary.getLayout({ name: '' }),
    edgeLabelMode: EdgeLabelMode.HIDE,
    graphType: GraphType.VERSIONED_APP,
    injectServiceNodes: false
  };

  static parseProps = (queryString: string) => {
    const urlParams = new URLSearchParams(queryString);
    const _duration = urlParams.get('duration')
      ? { value: urlParams.get('duration') }
      : GraphRouteHandler.graphParamsDefaults.graphDuration;
    const _edgeLabelMode = Enum.fromValue(
      EdgeLabelMode,
      urlParams.get('edges'),
      GraphRouteHandler.graphParamsDefaults.edgeLabelMode
    );
    const _graphType = Enum.fromValue(
      GraphType,
      urlParams.get('graphType'),
      GraphRouteHandler.graphParamsDefaults.graphType
    );
    let _injectServiceNodes: boolean;
    switch (urlParams.get('injectServiceNodes')) {
      case 'true':
        _injectServiceNodes = true;
        break;
      case 'false':
        _injectServiceNodes = false;
        break;
      default:
        _injectServiceNodes = GraphRouteHandler.graphParamsDefaults.injectServiceNodes;
    }

    return {
      graphDuration: _duration,
      graphLayout: LayoutDictionary.getLayout({ name: urlParams.get('layout') }),
      edgeLabelMode: _edgeLabelMode,
      graphType: _graphType,
      injectServiceNodes: _injectServiceNodes
    };
  };

  static getNodeParamsFromProps(props: RouteComponentProps<GraphURLProps>): NodeParamsType | undefined {
    const app = props.match.params.app;
    const workload = props.match.params.workload;
    const appOk = app && app !== 'unknown' && app !== 'undefined';
    const workloadOk = workload && workload !== 'unknown' && workload !== 'undefined';
    if (!appOk && !workloadOk) {
      return;
    }
    const version = props.match.params.version;
    const nodeType = app ? NodeType.APP : NodeType.WORKLOAD;
    const node: NodeParamsType = { nodeType: nodeType, app: app, version: version, workload: workload };
    return node;
  }

  static getDerivedStateFromProps(props: RouteComponentProps<GraphURLProps>, currentState: GraphParamsType) {
    const nextNamespace = { name: props.match.params.namespace };
    const nextNode = GraphRouteHandler.getNodeParamsFromProps(props);
    const {
      graphDuration: nextDuration,
      graphLayout: nextLayout,
      edgeLabelMode: nextEdgeLabelMode,
      graphType: nextGraphType,
      injectServiceNodes: nextInjectServiceNodes
    } = GraphRouteHandler.parseProps(props.location.search);

    const layoutHasChanged = nextLayout.name !== currentState.graphLayout.name;
    const namespaceHasChanged = nextNamespace.name !== currentState.namespace.name;
    const nodeAppHasChanged = nextNode && currentState.node && nextNode.app !== currentState.node.app;
    const nodeVersionHasChanged = nextNode && currentState.node && nextNode.version !== currentState.node.version;
    const nodeTypeHasChanged = nextNode && currentState.node && nextNode.nodeType !== currentState.node.nodeType;
    const nodeWorkloadHasChanged = nextNode && currentState.node && nextNode.workload !== currentState.node.workload;
    const nodeHasChanged =
      (nextNode && !currentState.node) ||
      (!nextNode && currentState.node) ||
      nodeAppHasChanged ||
      nodeVersionHasChanged ||
      nodeWorkloadHasChanged ||
      nodeTypeHasChanged;
    const durationHasChanged = nextDuration.value !== currentState.graphDuration.value;
    const edgeLabelModeChanged = nextEdgeLabelMode !== currentState.edgeLabelMode;
    const graphTypeChanged = nextGraphType !== currentState.graphType;
    const injectServiceNodesChanged = nextInjectServiceNodes !== currentState.injectServiceNodes;

    if (
      layoutHasChanged ||
      namespaceHasChanged ||
      durationHasChanged ||
      edgeLabelModeChanged ||
      graphTypeChanged ||
      nodeHasChanged ||
      injectServiceNodesChanged
    ) {
      const newParams: GraphParamsType = {
        namespace: nextNamespace,
        node: nextNode,
        graphDuration: nextDuration,
        graphLayout: nextLayout,
        edgeLabelMode: nextEdgeLabelMode,
        graphType: nextGraphType,
        injectServiceNodes: nextInjectServiceNodes
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newParams));
      return { ...newParams };
    }
    return null;
  }

  constructor(routeProps: RouteComponentProps<GraphURLProps>) {
    super(routeProps);
    const previousParamsStr = sessionStorage.getItem(SESSION_KEY);
    const graphParams: GraphParamsType = previousParamsStr
      ? this.ensureGraphParamsDefaults(JSON.parse(previousParamsStr))
      : {
          namespace: { name: routeProps.match.params.namespace },
          node: GraphRouteHandler.getNodeParamsFromProps(routeProps),
          ...GraphRouteHandler.parseProps(routeProps.location.search)
        };
    this.state = graphParams;
  }

  componentDidMount() {
    // Note: `history.replace` simply changes the address bar text, not re-navigation
    if (this.state.node) {
      this.context.router.history.replace(makeNodeGraphUrlFromParams(this.state.node, this.state));
    } else {
      this.context.router.history.replace(makeNamespaceGraphUrlFromParams(this.state));
    }
  }

  render() {
    return <GraphPage {...this.state} />;
  }

  // Set default values in case we have an old state that is missing something
  private ensureGraphParamsDefaults(graphParams: any): GraphParamsType {
    return { ...GraphRouteHandler.graphParamsDefaults, ...graphParams };
  }
}
