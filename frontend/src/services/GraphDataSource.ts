import { AppenderString, DurationInSeconds, TimeInMilliseconds, TimeInSeconds } from '../types/Common';
import {
  DecoratedGraphElements,
  EdgeLabelMode,
  GraphDefinition,
  GraphElements,
  GraphType,
  BoxByType,
  NodeParamsType,
  NodeType,
  TrafficRate,
  DefaultTrafficRates,
  GraphElementsQuery
} from '../types/Graph';
import { Namespace } from '../types/Namespace';
import * as AlertUtils from '../utils/AlertUtils';
import { PromisesRegistry } from '../utils/CancelablePromises';
import * as API from './Api';
import { decorateGraphData } from '../store/Selectors/GraphData';
import EventEmitter from 'eventemitter3';
import { createSelector } from 'reselect';
import { isMultiCluster } from '../config';

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

export interface FetchParams {
  boxByCluster?: boolean;
  boxByNamespace?: boolean;
  duration: DurationInSeconds;
  edgeLabels: EdgeLabelMode[];
  graphType: GraphType;
  includeHealth: boolean;
  includeLabels: boolean;
  injectServiceNodes: boolean;
  namespaces: Namespace[];
  node?: NodeParamsType;
  queryTime?: TimeInMilliseconds; // default now
  showIdleEdges: boolean;
  showIdleNodes: boolean;
  showOperationNodes: boolean;
  showSecurity: boolean;
  showWaypoint: boolean;
  trafficRates: TrafficRate[];
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

export class GraphDataSource {
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
    (graphData: { graphDuration: number; graphElements: GraphElements }) => graphData.graphElements,
    (graphData: { graphDuration: number; graphElements: GraphElements }) => graphData.graphDuration,
    (graphData, duration) => decorateGraphData(graphData, duration)
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
      edgeLabels: [],
      graphType: GraphType.VERSIONED_APP,
      includeHealth: true,
      includeLabels: false,
      injectServiceNodes: true,
      namespaces: [],
      showIdleEdges: false,
      showIdleNodes: false,
      showOperationNodes: false,
      showSecurity: false,
      showWaypoint: false,
      trafficRates: []
    };
    this._isError = this._isLoading = false;
  }

  public fetchGraphData = (fetchParams: FetchParams): void => {
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

    const restParams: GraphElementsQuery = {
      duration: `${fetchParams.duration}s`,
      graphType: fetchParams.graphType,
      includeIdleEdges: fetchParams.showIdleEdges,
      injectServiceNodes: fetchParams.injectServiceNodes
    };

    const boxBy: string[] = [];

    if (fetchParams.boxByCluster) {
      boxBy.push(BoxByType.CLUSTER);
    }

    if (fetchParams.boxByNamespace) {
      boxBy.push(BoxByType.NAMESPACE);
    }

    if (fetchParams.graphType === GraphType.APP || fetchParams.graphType === GraphType.VERSIONED_APP) {
      boxBy.push(BoxByType.APP);
    }

    if (boxBy.length > 0) {
      restParams.boxBy = boxBy.join(',');
    }

    if (fetchParams.queryTime) {
      restParams.queryTime = String(Math.floor(fetchParams.queryTime / 1000));
    }

    // Some appenders are expensive so only specify an appender if needed.
    let appenders: AppenderString = 'deadNode,istio,serviceEntry,meshCheck,workloadEntry';

    if (fetchParams.includeHealth) {
      appenders += ',health';
    }

    if (fetchParams.showOperationNodes) {
      appenders += ',aggregateNode';
    }

    if (!fetchParams.node && fetchParams.showIdleNodes) {
      // note we only use the idleNode appender if this is NOT a drilled-in node graph and
      // the user specifically requests to see idle nodes.
      appenders += ',idleNode';
    }

    if (!fetchParams.node && !fetchParams.showWaypoint) {
      // note we only use the idleNode appender if this is NOT a drilled-in node graph and
      // the user specifically requests to see idle nodes.
      appenders += ',hideWaypoint';
    }

    if (fetchParams.includeLabels) {
      appenders += ',labeler';
    }

    if (fetchParams.showSecurity) {
      appenders += ',securityPolicy';
    }

    fetchParams.edgeLabels.forEach(edgeLabel => {
      switch (edgeLabel) {
        case EdgeLabelMode.RESPONSE_TIME_AVERAGE:
          appenders += ',responseTime';
          restParams.responseTime = 'avg';
          break;
        case EdgeLabelMode.RESPONSE_TIME_P50:
          appenders += ',responseTime';
          restParams.responseTime = '50';
          break;
        case EdgeLabelMode.RESPONSE_TIME_P95:
          appenders += ',responseTime';
          restParams.responseTime = '95';
          break;
        case EdgeLabelMode.RESPONSE_TIME_P99:
          appenders += ',responseTime';
          restParams.responseTime = '99';
          break;
        case EdgeLabelMode.THROUGHPUT_REQUEST:
          appenders += ',throughput';
          restParams.throughputType = 'request';
          break;
        case EdgeLabelMode.THROUGHPUT_RESPONSE:
          appenders += ',throughput';
          restParams.throughputType = 'response';
          break;
        case EdgeLabelMode.TRAFFIC_DISTRIBUTION:
        case EdgeLabelMode.TRAFFIC_RATE:
        default:
          break;
      }
    });

    restParams.appenders = appenders;

    restParams.rateGrpc = 'none';
    restParams.rateHttp = 'none';
    restParams.rateTcp = 'none';

    fetchParams.trafficRates.forEach(trafficRate => {
      switch (trafficRate) {
        case TrafficRate.GRPC_RECEIVED:
          restParams.rateGrpc = 'received';
          break;
        case TrafficRate.GRPC_REQUEST:
          restParams.rateGrpc = 'requests';
          break;
        case TrafficRate.GRPC_SENT:
          restParams.rateGrpc = 'sent';
          break;
        case TrafficRate.GRPC_TOTAL:
          restParams.rateGrpc = 'total';
          break;
        case TrafficRate.HTTP_REQUEST:
          restParams.rateHttp = 'requests';
          break;
        case TrafficRate.TCP_RECEIVED:
          restParams.rateTcp = 'received';
          break;
        case TrafficRate.TCP_SENT:
          restParams.rateTcp = 'sent';
          break;
        case TrafficRate.TCP_TOTAL:
          restParams.rateTcp = 'total';
          break;
        default:
          break;
      }
    });

    let cluster: string | undefined;

    if (fetchParams.node?.cluster && isMultiCluster) {
      cluster = fetchParams.node.cluster;
    }

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
      previousFetchParams.showIdleNodes !== this.fetchParameters.showIdleNodes ||
      previousFetchParams.showWaypoint !== this.fetchParameters.showWaypoint;

    if (isPreviousDataInvalid) {
      // Reset the graph data
      this.graphElements = EMPTY_GRAPH_DATA;
      this.graphDuration = 0;
      this.graphTimestamp = 0;
    }

    this.emit('loadStart', isPreviousDataInvalid, fetchParams);

    if (fetchParams.node) {
      this.fetchDataForNode(restParams, cluster);
    } else {
      this.fetchDataForNamespaces(restParams);
    }
  };

  public on: OnEvents = (eventName: any, callback: any): void => {
    this.eventEmitter.on(eventName, callback);
  };

  public removeListener: OnEvents = (eventName: any, callback: any): void => {
    this.eventEmitter.removeListener(eventName, callback);
  };

  // Some helpers

  public fetchForApp = (duration: DurationInSeconds, namespace: string, app: string, cluster?: string): void => {
    const params = this.fetchForAppParams(duration, namespace, app, cluster);
    params.showSecurity = true;
    this.fetchGraphData(params);
  };

  public fetchForAppParams = (
    duration: DurationInSeconds,
    namespace: string,
    app: string,
    cluster?: string
  ): FetchParams => {
    const params = GraphDataSource.defaultFetchParams(duration, namespace);
    params.graphType = GraphType.APP;
    params.node!.nodeType = NodeType.APP;
    params.node!.app = app;

    if (cluster) {
      params.node!.cluster = cluster;
    }

    return params;
  };

  public fetchForVersionedApp = (
    duration: DurationInSeconds,
    namespace: string,
    app: string,
    cluster?: string
  ): void => {
    const params = this.fetchForVersionedAppParams(duration, namespace, app, cluster);
    params.showSecurity = true;
    this.fetchGraphData(params);
  };

  public fetchForVersionedAppParams = (
    duration: DurationInSeconds,
    namespace: string,
    app: string,
    cluster?: string
  ): FetchParams => {
    const params = GraphDataSource.defaultFetchParams(duration, namespace);

    params.edgeLabels = [
      EdgeLabelMode.RESPONSE_TIME_GROUP,
      EdgeLabelMode.RESPONSE_TIME_P95,
      EdgeLabelMode.THROUGHPUT_GROUP,
      EdgeLabelMode.THROUGHPUT_REQUEST,
      EdgeLabelMode.TRAFFIC_DISTRIBUTION,
      EdgeLabelMode.TRAFFIC_RATE
    ];

    params.graphType = GraphType.VERSIONED_APP;
    params.node!.nodeType = NodeType.APP;
    params.node!.app = app;

    if (cluster) {
      params.node!.cluster = cluster;
    }

    return params;
  };

  public fetchForWorkload = (
    duration: DurationInSeconds,
    namespace: string,
    workload: string,
    cluster?: string
  ): void => {
    const params = this.fetchForWorkloadParams(duration, namespace, workload, cluster);
    params.showSecurity = true;
    this.fetchGraphData(params);
  };

  public fetchForWorkloadParams = (
    duration: DurationInSeconds,
    namespace: string,
    workload: string,
    cluster?: string
  ): FetchParams => {
    const params = GraphDataSource.defaultFetchParams(duration, namespace);

    params.edgeLabels = [
      EdgeLabelMode.RESPONSE_TIME_GROUP,
      EdgeLabelMode.RESPONSE_TIME_P95,
      EdgeLabelMode.THROUGHPUT_GROUP,
      EdgeLabelMode.THROUGHPUT_REQUEST,
      EdgeLabelMode.TRAFFIC_DISTRIBUTION,
      EdgeLabelMode.TRAFFIC_RATE
    ];

    params.graphType = GraphType.WORKLOAD;
    params.node!.nodeType = NodeType.WORKLOAD;
    params.node!.workload = workload;

    if (cluster) {
      params.node!.cluster = cluster;
    }

    return params;
  };

  public fetchForService = (
    duration: DurationInSeconds,
    namespace: string,
    service: string,
    cluster?: string
  ): void => {
    const params = this.fetchForServiceParams(duration, namespace, service, cluster);
    params.showSecurity = true;
    this.fetchGraphData(params);
  };

  public fetchForServiceParams = (
    duration: DurationInSeconds,
    namespace: string,
    service: string,
    cluster?: string
  ): FetchParams => {
    const params = GraphDataSource.defaultFetchParams(duration, namespace);

    params.edgeLabels = [
      EdgeLabelMode.RESPONSE_TIME_GROUP,
      EdgeLabelMode.RESPONSE_TIME_P95,
      EdgeLabelMode.THROUGHPUT_GROUP,
      EdgeLabelMode.THROUGHPUT_REQUEST,
      EdgeLabelMode.TRAFFIC_DISTRIBUTION,
      EdgeLabelMode.TRAFFIC_RATE
    ];

    params.graphType = GraphType.WORKLOAD;
    params.node!.nodeType = NodeType.SERVICE;
    params.node!.service = service;

    if (cluster) {
      params.node!.cluster = cluster;
    }

    return params;
  };

  public fetchForNamespace = (duration: DurationInSeconds, namespace: string): void => {
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
    // queryTime defaults to server's 'now', leave unset
    return {
      boxByCluster: false, // not the main graph default, the helpers are for detail graphs
      boxByNamespace: false, // not the main graph default, the helpers are for detail graphs
      duration: duration,
      edgeLabels: [],
      graphType: GraphType.WORKLOAD,
      includeHealth: true,
      includeLabels: false,
      injectServiceNodes: true,
      namespaces: [{ name: namespace }],
      node: {
        app: '',
        namespace: { name: namespace },
        nodeType: NodeType.UNKNOWN,
        service: '',
        version: '',
        workload: ''
      },
      showIdleEdges: false,
      showIdleNodes: false,
      showOperationNodes: false,
      showSecurity: false,
      showWaypoint: false,
      trafficRates: DefaultTrafficRates
    };
  }

  private emit: EmitEvents = (eventName: string, ...args: unknown[]) => {
    this.eventEmitter.emit(eventName, ...args);
  };

  private fetchDataForNamespaces = (restParams: GraphElementsQuery): void => {
    restParams.namespaces = this.fetchParameters.namespaces.map(namespace => namespace.name).join(',');

    this.promiseRegistry.register(PROMISE_KEY, API.getGraphElements(restParams)).then(
      response => {
        const responseData: any = response.data;
        this.graphElements = responseData && responseData.elements ? responseData.elements : EMPTY_GRAPH_DATA;
        this.graphTimestamp = responseData && responseData.timestamp ? responseData.timestamp : 0;
        this.graphDuration = responseData && responseData.duration ? responseData.duration : 0;
        const decoratedGraphElements = this.graphData;
        this._isLoading = this._isError = false;

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
        AlertUtils.addError('Cannot load the graph', error);
        this.emit('fetchError', `Cannot load the graph: ${this.errorMessage}`, this.fetchParameters);
      }
    );
  };

  private fetchDataForNode = (restParams: GraphElementsQuery, cluster?: string): void => {
    this.promiseRegistry
      .register(PROMISE_KEY, API.getNodeGraphElements(this.fetchParameters.node!, restParams, cluster))
      .then(
        response => {
          const responseData: any = response.data;
          this.graphElements = responseData && responseData.elements ? responseData.elements : EMPTY_GRAPH_DATA;
          this.graphTimestamp = responseData && responseData.timestamp ? responseData.timestamp : 0;
          this.graphDuration = responseData && responseData.duration ? responseData.duration : 0;
          const decoratedGraphElements = this.graphData;
          this._isLoading = this._isError = false;

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
          AlertUtils.addError('Cannot load the graph', error);
          this.emit('fetchError', this.errorMessage, this.fetchParameters);
        }
      );
  };

  // Getters and setters
  public get graphData(): DecoratedGraphElements {
    return this.decoratedData({ graphElements: this.graphElements, graphDuration: this.graphDuration });
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
