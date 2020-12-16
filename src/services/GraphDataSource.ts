import { AppenderString, DurationInSeconds, TimeInMilliseconds, TimeInSeconds } from '../types/Common';
import {
  DecoratedGraphElements,
  EdgeLabelMode,
  GraphDefinition,
  GraphElements,
  GraphType,
  GroupByType,
  NodeParamsType,
  NodeType,
  UNKNOWN,
  DecoratedGraphNodeWrapper
} from '../types/Graph';
import Namespace from '../types/Namespace';
import * as AlertUtils from '../utils/AlertUtils';
import { PromisesRegistry } from '../utils/CancelablePromises';
import * as API from './Api';
import { decorateGraphData } from '../store/Selectors/GraphData';
import EventEmitter from 'eventemitter3';
import { createSelector } from 'reselect';
import { NamespaceAppHealth, NamespaceServiceHealth, NamespaceWorkloadHealth, NA } from 'types/Health';

export const EMPTY_GRAPH_DATA = { nodes: [], edges: [] };
const PROMISE_KEY = 'CURRENT_REQUEST';

// GraphDataSource allows us to have multiple graphs in play, which functionally allows us to maintain
// the master graph page as well as to offer mini-graphs in the detail pages.
//
// GraphDataSource (GDS) emits events asynchronously and has the potential to disrupt the expected
// react+redux workflow typical of our components.  To avoid unexpected results here are some
// [anti-]patterns for using GraphDataSource:
//   - Do not set up GDS callbacks in nested components.  It is better to process the callbacks in the
//     top-level component and then update props (via react or redux) and let the lower components update normally.
//       - if A embeds B, do not have callbacks for the same GDS in A and B, just A
//   - Avoid accessing GDS fields to access fetch information (elements, timestamps, fetchParameters, etc).  In
//     short, the fields are volatile and can change at unexpected times.
//       - Instead, in the callbacks save what you need to local variables or properties.  Then use them to
//         trigger react/redux state changes normally.
//   - Avoid passing a GDS as a property.
//       - The only reason to do this is for an embedded component to access the GDS fields directly, which is
//         an anti-pattern explained above.  Having said that, if you are SURE the GDS is stable, it will work
//         (at this writing we still do this for mini-graphs).

type EmitEvents = {
  (eventName: 'loadStart', isPreviousDataInvalid: boolean, fetchParams: FetchParams): void;
  (eventName: 'emptyNamespaces', fetchParams: FetchParams): void;
  (eventName: 'fetchError', errorMessage: string | null, fetchParams: FetchParams): void;
  (
    eventName: 'fetchSuccess',
    graphTimestamp: TimeInSeconds,
    graphDuration: DurationInSeconds,
    graphData: DecoratedGraphElements,
    fetchParams: FetchParams
  ): void;
};

type NamespaceHealth = NamespaceAppHealth | NamespaceServiceHealth | NamespaceWorkloadHealth;
type NodeHealth = {
  key: string;
  node: DecoratedGraphNodeWrapper;
};

export interface FetchParams {
  duration: DurationInSeconds;
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  includeHealth: boolean;
  injectServiceNodes: boolean;
  namespaces: Namespace[];
  node?: NodeParamsType;
  queryTime?: TimeInMilliseconds; // default now
  showIdleEdges: boolean;
  showIdleNodes: boolean;
  showOperationNodes: boolean;
  showSecurity: boolean;
}

type OnEvents = {
  (eventName: 'loadStart', callback: (isPreviousDataInvalid: boolean, fetchParams: FetchParams) => void): void;
  (eventName: 'emptyNamespaces', callback: (fetchParams: FetchParams) => void): void;
  (eventName: 'fetchError', callback: (errorMessage: string | null, fetchParams: FetchParams) => void): void;
  (
    eventName: 'fetchSuccess',
    callback: (
      graphTimestamp: TimeInSeconds,
      graphDuration: DurationInSeconds,
      graphData: DecoratedGraphElements,
      fetchParams: FetchParams
    ) => void
  ): void;
};

export default class GraphDataSource {
  public graphDuration: DurationInSeconds;
  public graphTimestamp: TimeInSeconds;

  private _errorMessage: string | null;
  private _fetchParams: FetchParams;
  private _isError: boolean;
  private _isLoading: boolean;

  private eventEmitter: EventEmitter;
  private graphElements: GraphElements;
  private promiseRegistry: PromisesRegistry;
  private decoratedData = createSelector(
    (graphData: GraphElements) => graphData,
    graphData => decorateGraphData(graphData)
  );

  // Public methods

  constructor() {
    this.graphElements = EMPTY_GRAPH_DATA;
    this.graphDuration = 0;
    this.graphTimestamp = 0;

    this.eventEmitter = new EventEmitter();
    this.promiseRegistry = new PromisesRegistry();

    this._errorMessage = null;
    this._fetchParams = {
      duration: 0,
      edgeLabelMode: EdgeLabelMode.NONE,
      graphType: GraphType.VERSIONED_APP,
      includeHealth: true,
      injectServiceNodes: true,
      namespaces: [],
      showIdleEdges: false,
      showIdleNodes: false,
      showOperationNodes: false,
      showSecurity: false
    };
    this._isError = this._isLoading = false;
  }

  public fetchGraphData = (fetchParams: FetchParams) => {
    const previousFetchParams = this.fetchParameters;

    // Copy fetch parameters to a local attribute
    this._fetchParams = { ...fetchParams };

    if (fetchParams.namespaces.length === 0) {
      this._isLoading = this._isError = false;
      this.graphElements = EMPTY_GRAPH_DATA;
      this.graphDuration = 0;
      this.graphTimestamp = 0;
      this.emit('emptyNamespaces', fetchParams);
      return;
    }

    const restParams: any = {
      duration: fetchParams.duration + 's',
      graphType: fetchParams.graphType,
      includeIdleEdges: fetchParams.showIdleEdges,
      injectServiceNodes: fetchParams.injectServiceNodes
    };

    if (fetchParams.graphType === GraphType.APP || fetchParams.graphType === GraphType.VERSIONED_APP) {
      restParams.groupBy = GroupByType.APP;
    }

    if (fetchParams.queryTime) {
      restParams.queryTime = String(Math.floor(fetchParams.queryTime / 1000));
    }

    // Some appenders are expensive so only specify an appender if needed.
    let appenders: AppenderString = 'deadNode,sidecarsCheck,serviceEntry,istio';

    if (fetchParams.showOperationNodes) {
      appenders += ',aggregateNode';
    }

    if (!fetchParams.node && fetchParams.showIdleNodes) {
      // note we only use the idleNode appender if this is NOT a drilled-in node graph and
      // the user specifically requests to see idle nodes.
      appenders += ',idleNode';
    }

    if (fetchParams.showSecurity) {
      appenders += ',securityPolicy';
    }

    switch (fetchParams.edgeLabelMode) {
      case EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE:
        appenders += ',responseTime';
        break;

      case EdgeLabelMode.REQUEST_RATE:
      case EdgeLabelMode.REQUEST_DISTRIBUTION:
      case EdgeLabelMode.NONE:
      default:
        break;
    }
    restParams.appenders = appenders;

    this._isLoading = true;
    this._isError = false;

    const isPreviousDataInvalid =
      previousFetchParams.namespaces.map(ns => ns.name).join() !==
        this.fetchParameters.namespaces.map(ns => ns.name).join() ||
      previousFetchParams.node !== this.fetchParameters.node ||
      previousFetchParams.graphType !== this.fetchParameters.graphType ||
      previousFetchParams.includeHealth !== this.fetchParameters.includeHealth ||
      previousFetchParams.injectServiceNodes !== this.fetchParameters.injectServiceNodes ||
      previousFetchParams.showOperationNodes !== this.fetchParameters.showOperationNodes ||
      previousFetchParams.showIdleNodes !== this.fetchParameters.showIdleNodes;

    if (isPreviousDataInvalid) {
      // Reset the graph data
      this.graphElements = EMPTY_GRAPH_DATA;
      this.graphDuration = 0;
      this.graphTimestamp = 0;
    }

    this.emit('loadStart', isPreviousDataInvalid, fetchParams);
    if (fetchParams.node) {
      this.fetchDataForNode(restParams);
    } else {
      this.fetchDataForNamespaces(restParams);
    }
  };

  public on: OnEvents = (eventName: any, callback: any) => {
    this.eventEmitter.on(eventName, callback);
  };

  public removeListener: OnEvents = (eventName: any, callback: any) => {
    this.eventEmitter.removeListener(eventName, callback);
  };

  // Some helpers

  public fetchForApp = (duration: DurationInSeconds, namespace: string, app: string) => {
    const params = this.fetchForAppParams(duration, namespace, app);
    this.fetchGraphData(params);
  };

  public fetchForAppParams = (duration: DurationInSeconds, namespace: string, app: string): FetchParams => {
    const params = GraphDataSource.defaultFetchParams(duration, namespace);
    params.graphType = GraphType.APP;
    params.node!.nodeType = NodeType.APP;
    params.node!.app = app;
    return params;
  };

  public fetchForWorkload = (duration: DurationInSeconds, namespace: string, workload: string) => {
    const params = this.fetchForWorkloadParams(duration, namespace, workload);
    this.fetchGraphData(params);
  };

  public fetchForWorkloadParams = (duration: DurationInSeconds, namespace: string, workload: string): FetchParams => {
    const params = GraphDataSource.defaultFetchParams(duration, namespace);
    params.graphType = GraphType.WORKLOAD;
    params.node!.nodeType = NodeType.WORKLOAD;
    params.node!.workload = workload;
    return params;
  };

  public fetchForService = (duration: DurationInSeconds, namespace: string, service: string) => {
    const params = this.fetchForServiceParams(duration, namespace, service);
    this.fetchGraphData(params);
  };

  public fetchForServiceParams = (duration: DurationInSeconds, namespace: string, service: string): FetchParams => {
    const params = GraphDataSource.defaultFetchParams(duration, namespace);
    params.graphType = GraphType.WORKLOAD;
    params.node!.nodeType = NodeType.SERVICE;
    params.node!.service = service;
    return params;
  };

  public fetchForNamespace = (duration: DurationInSeconds, namespace: string) => {
    const params = this.fetchForNamespaceParams(duration, namespace);
    this.fetchGraphData(params);
  };

  public fetchForNamespaceParams = (duration: DurationInSeconds, namespace: string): FetchParams => {
    const params = GraphDataSource.defaultFetchParams(duration, namespace);
    params.graphType = GraphType.WORKLOAD;
    params.showSecurity = true;
    return params;
  };

  // Private methods

  private static defaultFetchParams(duration: DurationInSeconds, namespace: string): FetchParams {
    return {
      namespaces: [{ name: namespace }],
      duration: duration,
      graphType: GraphType.WORKLOAD,
      includeHealth: true,
      injectServiceNodes: true,
      edgeLabelMode: EdgeLabelMode.NONE,
      showIdleEdges: false,
      showIdleNodes: false,
      showOperationNodes: false,
      showSecurity: false,
      node: {
        app: '',
        namespace: { name: namespace },
        nodeType: NodeType.UNKNOWN,
        service: '',
        version: '',
        workload: ''
      }
    };
  }

  private emit: EmitEvents = (eventName: any, ...args) => {
    this.eventEmitter.emit(eventName, ...args);
  };

  private fetchDataForNamespaces = (restParams: any) => {
    restParams.namespaces = this.fetchParameters.namespaces.map(namespace => namespace.name).join(',');
    this.promiseRegistry.register(PROMISE_KEY, API.getGraphElements(restParams)).then(
      response => {
        const responseData: any = response.data;
        this.graphElements = responseData && responseData.elements ? responseData.elements : EMPTY_GRAPH_DATA;
        this.graphTimestamp = responseData && responseData.timestamp ? responseData.timestamp : 0;
        this.graphDuration = responseData && responseData.duration ? responseData.duration : 0;
        const decoratedGraphElements = this.graphData;
        if (this.fetchParameters.includeHealth) {
          this.fetchHealth(decoratedGraphElements);
        } else {
          this._isLoading = this._isError = false;
          this.emit(
            'fetchSuccess',
            this.graphTimestamp,
            this.graphDuration,
            decoratedGraphElements,
            this.fetchParameters
          );
        }
      },
      error => {
        this._isLoading = false;
        if (error.isCanceled) {
          return;
        }

        this._isError = true;
        this._errorMessage = API.getErrorString(error);
        AlertUtils.addError('Cannot load the graph', error);
        this.emit('fetchError', `Cannot load the graph: ${this.errorMessage}`, this.fetchParameters);
      }
    );
  };

  private fetchDataForNode = (restParams: any) => {
    this.promiseRegistry.register(PROMISE_KEY, API.getNodeGraphElements(this.fetchParameters.node!, restParams)).then(
      response => {
        const responseData: any = response.data;
        this.graphElements = responseData && responseData.elements ? responseData.elements : EMPTY_GRAPH_DATA;
        this.graphTimestamp = responseData && responseData.timestamp ? responseData.timestamp : 0;
        this.graphDuration = responseData && responseData.duration ? responseData.duration : 0;
        const decoratedGraphElements = this.graphData;
        if (this.fetchParameters.includeHealth) {
          this.fetchHealth(decoratedGraphElements);
        } else {
          this._isLoading = this._isError = false;
          this.emit(
            'fetchSuccess',
            this.graphTimestamp,
            this.graphDuration,
            decoratedGraphElements,
            this.fetchParameters
          );
        }
      },
      error => {
        this._isLoading = false;
        if (error.isCanceled) {
          return;
        }

        this._isError = true;
        this._errorMessage = API.getErrorString(error);
        AlertUtils.addError('Cannot load the graph', error);
        this.emit('fetchError', this.errorMessage, this.fetchParameters);
      }
    );
  };

  // Limit health fetches to only the necessary namespaces for the necessary types
  private fetchHealth = (decoratedGraphElements: DecoratedGraphElements) => {
    if (!decoratedGraphElements.nodes || decoratedGraphElements.nodes.length === 0) {
      this._isLoading = false;
      this.emit('fetchSuccess', this.graphTimestamp, this.graphDuration, decoratedGraphElements, this.fetchParameters);

      return;
    }

    const duration = this.fetchParameters.duration;
    const appNamespacePromises = new Map<string, Promise<NamespaceAppHealth>>();
    const serviceNamespacePromises = new Map<string, Promise<NamespaceServiceHealth>>();
    const workloadNamespacePromises = new Map<string, Promise<NamespaceWorkloadHealth>>();

    const promiseToNode = new Map<Promise<NamespaceHealth>, NodeHealth[]>();

    // Asynchronously fetch health
    for (const node of decoratedGraphElements.nodes) {
      // ignore nodes that can not have health calculated due lack of access or lack of info
      // note: UNKNOWN node is already marked inaccessible
      if (node.data.isInaccessible) {
        continue;
      }
      const namespace = node.data.namespace;
      const nodeType = node.data.nodeType;
      const workload = node.data.workload;
      const workloadOk = workload && workload !== '' && workload !== UNKNOWN;
      // use workload health when workload is set and valid (workload nodes or versionApp nodes)
      const useWorkloadHealth = nodeType === NodeType.WORKLOAD || (nodeType === NodeType.APP && workloadOk);

      if (useWorkloadHealth) {
        let promise = workloadNamespacePromises.get(namespace);
        const nodeHealth = { node: node, key: node.data.workload! };
        if (!promise) {
          promise = API.getNamespaceWorkloadHealth(namespace, duration);
          workloadNamespacePromises.set(namespace, promise);
          promiseToNode.set(promise, [nodeHealth]);
        } else {
          const nodeHealths = promiseToNode.get(promise);
          nodeHealths!.push(nodeHealth);
        }
      } else if (nodeType === NodeType.APP) {
        let promise = appNamespacePromises.get(namespace);
        const nodeHealth = { node: node, key: node.data.app! };
        if (!promise) {
          promise = API.getNamespaceAppHealth(namespace, duration);
          appNamespacePromises.set(namespace, promise);
          promiseToNode.set(promise, [nodeHealth]);
        } else {
          const nodeHealths = promiseToNode.get(promise);
          nodeHealths!.push(nodeHealth);
        }
      } else if (nodeType === NodeType.SERVICE) {
        let promise = serviceNamespacePromises.get(namespace);
        const nodeHealth = { node: node, key: node.data.service! };
        if (!promise) {
          promise = API.getNamespaceServiceHealth(namespace, duration);
          serviceNamespacePromises.set(namespace, promise);
          promiseToNode.set(promise, [nodeHealth]);
        } else {
          const nodeHealths = promiseToNode.get(promise);
          nodeHealths!.push(nodeHealth);
        }
      }
    }

    let healthPromises: Promise<NamespaceHealth>[] = Array.from(appNamespacePromises.values());
    healthPromises = healthPromises.concat(Array.from(serviceNamespacePromises.values()));
    healthPromises = healthPromises.concat(Array.from(workloadNamespacePromises.values()));

    new PromisesRegistry().registerAll('HEALTH_PROMISES', healthPromises).then(
      nsHealths => {
        nsHealths.forEach((nsHealth, i) => {
          promiseToNode.get(healthPromises[i])!.forEach(nh => {
            const health = nsHealth[nh.key];
            if (health) {
              nh.node.data.health = health;
              nh.node.data.healthStatus = health.getGlobalStatus().name;
            } else {
              nh.node.data.healthStatus = NA.name;
              console.debug(`No health found for [${nh.node.data.nodeType}] [${nh.key}]`);
            }
          });
        });

        this._isLoading = false;
        this.emit(
          'fetchSuccess',
          this.graphTimestamp,
          this.graphDuration,
          decoratedGraphElements,
          this.fetchParameters
        );
      },
      error => {
        this._isLoading = false;
        if (error.isCanceled) {
          return;
        }

        this._isError = true;
        this._errorMessage = API.getErrorString(error);
        AlertUtils.addError('Cannot load the graph [health]', error);
        this.emit('fetchError', this.errorMessage, this.fetchParameters);
      }
    );
  };

  // Getters and setters
  public get graphData(): DecoratedGraphElements {
    return this.decoratedData(this.graphElements);
  }

  public get graphDefinition(): GraphDefinition {
    return {
      duration: this.graphDuration,
      elements: this.graphElements,
      timestamp: this.graphTimestamp,
      graphType: this.fetchParameters.graphType
    };
  }

  public get errorMessage(): string | null {
    return this._errorMessage;
  }

  public get fetchParameters(): FetchParams {
    return this._fetchParams;
  }

  public get isError(): boolean {
    return this._isError;
  }

  public get isLoading(): boolean {
    return this._isLoading;
  }
}
