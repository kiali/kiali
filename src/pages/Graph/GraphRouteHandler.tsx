import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { PropTypes } from 'prop-types';
import { connect } from 'react-redux';

import { GraphParamsType, GraphType, NodeParamsType, NodeType } from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';
import * as LayoutDictionary from '../../components/CytoscapeGraph/graphs/LayoutDictionary';
import GraphPage from '../../containers/GraphPageContainer';
import { makeNamespaceGraphUrlFromParams, makeNodeGraphUrlFromParams } from '../../components/Nav/NavUtils';
import { config } from '../../config';
import * as Enum from '../../utils/Enum';
import { KialiAppState } from '../../store/Store';
import { NamespaceActions } from '../../actions/NamespaceAction';
import Namespace from '../../types/Namespace';
import { JsonString } from '../../types/Common';
import { activeNamespaceSelector, previousGraphStateSelector } from '../../store/Selectors';
import { Dispatch } from 'redux';
import { HistoryManager } from '../../app/History';

const URLSearchParams = require('url-search-params');

const SESSION_KEY = 'graph-params';

type GraphURLProps = {
  namespace: string;
  app: string;
  service: string;
  version: string;
  workload: string;
  duration: string;
  graphType: string;
  injectServiceNodes: boolean;
  layout: string;
};

const mapStateToProps = (state: KialiAppState) => {
  return {
    activeNamespace: activeNamespaceSelector(state),
    previousGraphState: previousGraphStateSelector(state)
  };
};

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    setActiveNamespace: (namespace: Namespace) => {
      dispatch(NamespaceActions.setActiveNamespace(namespace));
    },
    setPreviousGraphState: (graphState: JsonString) => {
      dispatch(NamespaceActions.setPreviousGraphState(graphState));
    }
  };
};

/**
 * Handle URL parameters for Graph page
 */
export class GraphRouteHandler extends React.Component<RouteComponentProps<GraphURLProps>, GraphParamsType> {
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

  static parsePropsFromUrl = (queryString: string): GraphParamsType => {
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
    const _injectServiceNodes = urlParams.has('injectServiceNodes')
      ? (urlParams.get('injectServiceNodes') as boolean)
      : GraphRouteHandler.graphParamsDefaults.injectServiceNodes;

    return {
      namespace: { name: 'all' },
      graphDuration: _duration,
      graphLayout: LayoutDictionary.getLayout({ name: urlParams.get('layout') }),
      edgeLabelMode: _edgeLabelMode,
      graphType: _graphType,
      injectServiceNodes: _injectServiceNodes
    };
  };

  static getNodeParamsFromProps(props: RouteComponentProps<GraphURLProps>): NodeParamsType | undefined {
    const app = props.match.params.app;
    const appOk = app && app !== 'unknown' && app !== 'undefined';
    const service = props.match.params.service;
    const serviceOk = service && service !== 'unknown' && service !== 'undefined';
    const workload = props.match.params.workload;
    const workloadOk = workload && workload !== 'unknown' && workload !== 'undefined';
    if (!appOk && !serviceOk && !workloadOk) {
      return;
    }
    let nodeType;
    let version;
    if (appOk || workloadOk) {
      nodeType = appOk ? NodeType.APP : NodeType.WORKLOAD;
      version = props.match.params.version;
    } else {
      nodeType = NodeType.SERVICE;
      version = '';
    }
    const node: NodeParamsType = {
      nodeType: nodeType,
      app: app,
      version: version,
      workload: workload,
      service: service
    };
    return node;
  }

  static getDerivedStateFromProps(props: RouteComponentProps<GraphURLProps>, currentState: GraphParamsType) {
    // at this point, the namespace in the url is incorrect, we need to rewrite the url
    // to use the redux namespace
    // @ts-ignore
    const nextNamespace = props.activeNamespace;
    const nextNode = GraphRouteHandler.getNodeParamsFromProps(props);
    const {
      graphDuration: nextDuration,
      graphLayout: nextLayout,
      edgeLabelMode: nextEdgeLabelMode,
      graphType: nextGraphType,
      injectServiceNodes: nextInjectServiceNodes
    } = GraphRouteHandler.parsePropsFromUrl(props.location.search);

    const layoutHasChanged = nextLayout.name !== currentState.graphLayout.name;
    const namespaceHasChanged = nextNamespace.name !== currentState.namespace.name;
    const nodeAppHasChanged = nextNode && currentState.node && nextNode.app !== currentState.node.app;
    const nodeServiceHasChanged = nextNode && currentState.node && nextNode.service !== currentState.node.service;
    const nodeVersionHasChanged = nextNode && currentState.node && nextNode.version !== currentState.node.version;
    const nodeTypeHasChanged = nextNode && currentState.node && nextNode.nodeType !== currentState.node.nodeType;
    const nodeWorkloadHasChanged = nextNode && currentState.node && nextNode.workload !== currentState.node.workload;
    const nodeHasChanged =
      (nextNode && !currentState.node) ||
      (!nextNode && currentState.node) ||
      nodeAppHasChanged ||
      nodeServiceHasChanged ||
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

      // if the node is set then we are on zoomed in subview and
      // we don't want to change the url because
      // the handleDoubleTap has already changed the url
      if (!newParams.node) {
        HistoryManager.setGraphNamespaceParam(nextNamespace.name);
      }
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
          ...GraphRouteHandler.parsePropsFromUrl(routeProps.location.search)
        };
    this.state = graphParams;
  }

  componentDidMount() {
    this.updateGraphUrl();
  }

  render() {
    return (
      <>
        <GraphPage {...this.state} />
      </>
    );
  }

  private updateGraphUrl() {
    // Note: `history.replace` simply changes the address bar text, not re-navigation
    if (this.state.node) {
      this.context.router.history.replace(makeNodeGraphUrlFromParams(this.state));
    } else {
      this.context.router.history.replace(makeNamespaceGraphUrlFromParams(this.state));
    }
  }

  // Set default values in case we have an old state that is missing something
  private ensureGraphParamsDefaults(graphParams: any): GraphParamsType {
    return { ...GraphRouteHandler.graphParamsDefaults, ...graphParams };
  }
}

const GraphRouteHandlerContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphRouteHandler);
export default GraphRouteHandlerContainer;
