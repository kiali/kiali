import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';

import { GraphParamsType, GraphType, NodeParamsType, NodeType } from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';
import * as LayoutDictionary from '../../components/CytoscapeGraph/graphs/LayoutDictionary';
import { config } from '../../config';
import * as Enum from '../../utils/Enum';
import { NamespaceActions } from '../../actions/NamespaceAction';
import Namespace from '../../types/Namespace';
import { store } from '../../store/ConfigStore';
import GraphPageContainer from '../../containers/GraphPageContainer';
import { DurationInSeconds } from '../../types/Common';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { GraphActions } from '../../actions/GraphActions';

const URLSearchParams = require('url-search-params');

/**
 * GraphRouteHandler handles bookmarkability. It parses the URL and updates state to
 * reflect information in the URL path variable and query parameters.  After rendering the
 * graph reflecting the URL it's job is done, it should not react to internal state changes.
 */

// We hold non-redux-managed graph state (i.e. GraphParamsType) in session state
const SESSION_KEY = 'graph-params';

// GraphURLPathProps holds path variable values.  Currenly all path variables are
// relevant only to a node graph
type GraphURLPathProps = {
  app: string;
  namespace: string;
  service: string;
  version: string;
  workload: string;
};

// GraphURLPathProps holds query param values.  It combines information held in session
// state (GraphParamsType) and redux state. (no information should be managed in both).
//
// A note on 'keepState': This is necessary to support the 'Graph' option in the left
// navigation menu.  Clicking on 'Graph' looks like a fresh URL navigation and therefore should
// override the current state, but actually the UX is better when keeping the state.  This allows
// the user to navigate around and when they come back to the graph be presented with their
// previous settings.
type GraphURLQueryProps = GraphParamsType & {
  graphDuration: DurationInSeconds;
  keepState: boolean;
  namespaces: Namespace;
};

/**
 * Handle URL parameters for Graph page
 */
export default class GraphRouteHandler extends React.Component<
  RouteComponentProps<GraphURLPathProps>,
  GraphURLQueryProps
> {
  static contextTypes = {
    router: () => null
  };

  static readonly graphParamsDefaults: GraphParamsType = {
    edgeLabelMode: EdgeLabelMode.HIDE,
    graphLayout: LayoutDictionary.getLayout({ name: '' }),
    graphType: GraphType.VERSIONED_APP,
    injectServiceNodes: false
  };

  static parsePropsFromQueryParams = (queryString: string): GraphURLQueryProps => {
    const urlParams = new URLSearchParams(queryString);

    const _edgeLabelMode = Enum.fromValue(
      EdgeLabelMode,
      urlParams.get('edges'),
      GraphRouteHandler.graphParamsDefaults.edgeLabelMode
    );
    const _graphDuration = urlParams.has('duration')
      ? Number(urlParams.get('duration'))
      : config().toolbar.defaultDuration;
    const _graphType = Enum.fromValue(
      GraphType,
      urlParams.get('graphType'),
      GraphRouteHandler.graphParamsDefaults.graphType
    );
    const _injectServiceNodes = urlParams.has('injectServiceNodes')
      ? urlParams.get('injectServiceNodes') === 'true'
      : GraphRouteHandler.graphParamsDefaults.injectServiceNodes;
    const _keepState = urlParams.has('keepState') ? urlParams.get('keepState') === 'true' : false;
    const _namespaces = urlParams.has('namespaces') ? { name: urlParams.get('namespaces') } : { name: 'all' };

    const result = {
      edgeLabelMode: _edgeLabelMode,
      graphDuration: _graphDuration,
      graphLayout: LayoutDictionary.getLayout({ name: urlParams.get('layout') }),
      graphType: _graphType,
      injectServiceNodes: _injectServiceNodes,
      keepState: _keepState,
      namespaces: _namespaces
    };
    return result;
  };

  static getNodeParamsFromProps(props: RouteComponentProps<GraphURLPathProps>): NodeParamsType | undefined {
    const app = props.match.params.app;
    const appOk = app && app !== 'unknown' && app !== 'undefined';
    const namespace = props.match.params.namespace;
    const namespaceOk = namespace && namespace !== 'unknown' && namespace !== 'undefined';
    const service = props.match.params.service;
    const serviceOk = service && service !== 'unknown' && service !== 'undefined';
    const workload = props.match.params.workload;
    const workloadOk = workload && workload !== 'unknown' && workload !== 'undefined';
    if (!appOk && !namespaceOk && !serviceOk && !workloadOk) {
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
      app: app,
      namespace: { name: namespace },
      nodeType: nodeType,
      service: service,
      version: version,
      workload: workload
    };
    return node;
  }

  static getDerivedStateFromProps(props: RouteComponentProps<GraphURLPathProps>, currentState: GraphParamsType) {
    const nextNode = GraphRouteHandler.getNodeParamsFromProps(props);

    const {
      edgeLabelMode: nextEdgeLabelMode,
      graphDuration: nextGraphDuration,
      graphLayout: nextLayout,
      graphType: nextGraphType,
      injectServiceNodes: nextInjectServiceNodes,
      keepState: keepState,
      namespaces: nextNamespaces
    } = GraphRouteHandler.parsePropsFromQueryParams(props.location.search);

    // for an explanation of 'keepState' see the above comment.
    if (keepState) {
      return null;
    }

    const reduxNamespaces = store.getState().namespaces.activeNamespace;
    const reduxDuration = store.getState().userSettings.duration;

    const durationHasChanged = nextGraphDuration !== reduxDuration;
    const edgeLabelModeChanged = nextEdgeLabelMode !== currentState.edgeLabelMode;
    const graphTypeChanged = nextGraphType !== currentState.graphType;
    const injectServiceNodesChanged = nextInjectServiceNodes !== currentState.injectServiceNodes;
    const layoutHasChanged = nextLayout.name !== currentState.graphLayout.name;
    const namespaceHasChanged = !nextNode && nextNamespaces.name !== reduxNamespaces.name;
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

    // update the redux store with the URL information
    if (durationHasChanged) {
      store.dispatch(UserSettingsActions.setDuration(nextGraphDuration));
    }
    if (namespaceHasChanged) {
      store.dispatch(NamespaceActions.setActiveNamespace(nextNamespaces));
    }
    // if the graph has fundamentally changed then init relevant redux graph state
    if (graphTypeChanged || injectServiceNodesChanged || namespaceHasChanged || nodeHasChanged) {
      store.dispatch(GraphActions.changed());
    }

    if (edgeLabelModeChanged || graphTypeChanged || injectServiceNodesChanged || layoutHasChanged || nodeHasChanged) {
      const newGraphParams: GraphParamsType = {
        edgeLabelMode: nextEdgeLabelMode,
        graphLayout: nextLayout,
        graphType: nextGraphType,
        injectServiceNodes: nextInjectServiceNodes,
        node: nextNode
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newGraphParams));

      // Do we really need to return anything other than null?
      return { ...newGraphParams };
    }

    return null;
  }

  constructor(routeProps: RouteComponentProps<GraphURLPathProps>) {
    super(routeProps);
    const previousParamsStr = sessionStorage.getItem(SESSION_KEY);
    const graphParams: GraphURLQueryProps = previousParamsStr
      ? this.ensureGraphParamsDefaults(JSON.parse(previousParamsStr))
      : {
          node: GraphRouteHandler.getNodeParamsFromProps(routeProps),
          ...GraphRouteHandler.parsePropsFromQueryParams(routeProps.location.search)
        };
    this.state = graphParams;
  }

  render() {
    return (
      <>
        <GraphPageContainer {...this.state} />
      </>
    );
  }

  // Set default values in case we have an old state that is missing something
  private ensureGraphParamsDefaults(graphParams: any): GraphURLQueryProps {
    return { ...GraphRouteHandler.graphParamsDefaults, ...graphParams };
  }
}
