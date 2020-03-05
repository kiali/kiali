import { AppenderString, DurationInSeconds, TimeInMilliseconds, TimeInSeconds } from '../types/Common';
import {
  DecoratedGraphElements,
  EdgeLabelMode,
  GraphDefinition,
  GraphElements,
  GraphType,
  GroupByType,
  NodeParamsType
} from '../types/Graph';
import Namespace from '../types/Namespace';
import * as AlertUtils from '../utils/AlertUtils';
import { PromisesRegistry } from '../utils/CancelablePromises';
import * as API from './Api';
import { decorateGraphData } from '../store/Selectors/GraphData';
import EventEmitter from 'eventemitter3';
import { createSelector } from 'reselect';

export const EMPTY_GRAPH_DATA = { nodes: [], edges: [] };
const PROMISE_KEY = 'CURRENT_REQUEST';

type EmitEvents = {
  (eventName: 'loadStart', isPreviousDataInvalid: boolean): void;
  (eventName: 'emptyNamespaces'): void;
  (eventName: 'fetchError', errorMessage: string | null): void;
  (
    eventName: 'fetchSuccess',
    graphTimestamp: TimeInSeconds,
    graphDuration: DurationInSeconds,
    graphData: DecoratedGraphElements
  ): void;
};

interface FetchParams {
  duration: DurationInSeconds;
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  injectServiceNodes: boolean;
  namespaces: Namespace[];
  node?: NodeParamsType;
  queryTime?: TimeInMilliseconds;
  showSecurity: boolean;
  showUnusedNodes: boolean;
}

type OnEvents = {
  (eventName: 'loadStart', callback: (isPreviousDataInvalid: boolean) => void): void;
  (eventName: 'emptyNamespaces', callback: () => void): void;
  (eventName: 'fetchError', callback: (errorMessage: string | null) => void): void;
  (
    eventName: 'fetchSuccess',
    callback: (
      graphTimestamp: TimeInSeconds,
      graphDuration: DurationInSeconds,
      graphData: DecoratedGraphElements
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
      injectServiceNodes: true,
      namespaces: [],
      showSecurity: false,
      showUnusedNodes: false
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
      this.emit('emptyNamespaces');
      return;
    }

    const restParams: any = {
      duration: fetchParams.duration + 's',
      graphType: fetchParams.graphType,
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

    if (!fetchParams.node && fetchParams.showUnusedNodes) {
      // note we only use the unusedNode appender if this is NOT a drilled-in node graph and
      // the user specifically requests to see unused nodes.
      appenders += ',unusedNode';
    }

    if (fetchParams.showSecurity) {
      appenders += ',securityPolicy';
    }

    switch (fetchParams.edgeLabelMode) {
      case EdgeLabelMode.RESPONSE_TIME_95TH_PERCENTILE:
        appenders += ',responseTime';
        break;

      case EdgeLabelMode.REQUESTS_PER_SECOND:
      case EdgeLabelMode.REQUESTS_PERCENTAGE:
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
      previousFetchParams.injectServiceNodes !== this.fetchParameters.injectServiceNodes;

    if (isPreviousDataInvalid) {
      // Reset the graph data
      this.graphElements = EMPTY_GRAPH_DATA;
      this.graphDuration = 0;
      this.graphTimestamp = 0;
    }

    this.emit('loadStart', isPreviousDataInvalid);
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

  // Private methods

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
        this._isLoading = this._isError = false;
        this.emit('fetchSuccess', this.graphTimestamp, this.graphDuration, this.graphData);
      },
      error => {
        this._isLoading = false;
        if (error.isCanceled) {
          return;
        }

        this._isError = true;
        this._errorMessage = API.getErrorString(error);
        AlertUtils.addError('Cannot load the graph', error);
        this.emit('fetchError', `Cannot load the graph: ${this.errorMessage}`);
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
        this._isLoading = this._isError = false;
        this.emit('fetchSuccess', this.graphTimestamp, this.graphDuration, this.graphData);
      },
      error => {
        this._isLoading = false;
        if (error.isCanceled) {
          return;
        }

        this._isError = true;
        this._errorMessage = API.getErrorString(error);
        AlertUtils.addError('Cannot load the graph', error);
        this.emit('fetchError', this.errorMessage);
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
