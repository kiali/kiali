import axios from 'axios';
import axiosMockAdapter from 'axios-mock-adapter';
import { GraphDataSource, EMPTY_GRAPH_DATA } from '../GraphDataSource';
import { DefaultTrafficRates, GraphType } from '../../types/Graph';
import MockAdapter from 'axios-mock-adapter';

const GRAPH_EMPTY_RESPONSE = {
  timestamp: 1581459185,
  duration: 60,
  graphType: 'versionedApp',
  elements: {
    nodes: [],
    edges: []
  }
};
const FETCH_PARAMS = {
  duration: 10,
  edgeLabels: [],
  graphType: GraphType.VERSIONED_APP,
  includeHealth: false,
  includeLabels: false,
  injectServiceNodes: false,
  namespaces: [{ name: 'foo' }],
  queryTime: 0,
  showIdleEdges: false,
  showIdleNodes: false,
  showOperationNodes: false,
  showSecurity: false,
  showVirtualServices: false,
  showWaypoints: false,
  trafficRates: DefaultTrafficRates
};

describe('GraphDataSource', () => {
  let axiosMock: MockAdapter;

  beforeAll(() => {
    // Mock axios just to avoid any network trip.
    axiosMock = new axiosMockAdapter(axios);
  });

  afterEach(() => {
    axiosMock.reset();
  });

  afterAll(() => {
    axiosMock.restore();
  });

  it('has an initial well known state', () => {
    const ds = new GraphDataSource();

    expect(ds.errorMessage).toBeFalsy();
    expect(ds.isError).toBeFalsy();
    expect(ds.isLoading).toBeFalsy();
    expect(ds.graphData).toEqual(EMPTY_GRAPH_DATA);
    expect(ds.graphDuration).toBe(0);
    expect(ds.graphTimestamp).toBe(0);
  });

  it('informs data loading is starting', () => {
    axiosMock.onGet('/api/namespaces/graph').reply(200, GRAPH_EMPTY_RESPONSE);
    const ds = new GraphDataSource();

    const mockLoadStartCallback = jest.fn();
    ds.on('loadStart', mockLoadStartCallback);

    ds.fetchGraphData(FETCH_PARAMS);

    expect(ds.isLoading).toBeTruthy();
    expect(mockLoadStartCallback).toHaveBeenCalledWith(true, FETCH_PARAMS);
  });

  it('informs data loading succeeded', done => {
    axiosMock.onGet('/api/namespaces/graph').reply(200, GRAPH_EMPTY_RESPONSE);
    const ds = new GraphDataSource();

    ds.on('fetchSuccess', (graphTimestamp, graphDuration, graphData, FETCH_PARAMS) => {
      expect(ds.isLoading).toBeFalsy();
      expect(ds.isError).toBeFalsy();
      expect(ds.errorMessage).toBeFalsy();
      expect(ds.graphTimestamp).toEqual(GRAPH_EMPTY_RESPONSE.timestamp);
      expect(ds.graphDuration).toEqual(GRAPH_EMPTY_RESPONSE.duration);
      expect(ds.graphData).toEqual(GRAPH_EMPTY_RESPONSE.elements);

      expect(ds.graphTimestamp).toEqual(graphTimestamp);
      expect(ds.graphDuration).toEqual(graphDuration);
      expect(ds.graphData).toEqual(graphData);
      expect(ds.fetchParameters).toEqual(FETCH_PARAMS);

      done();
    });

    ds.fetchGraphData(FETCH_PARAMS);
  });

  it('informs data loading failed', done => {
    axiosMock.onGet('/api/namespaces/graph').reply(500, { error: 'foo bar', FETCH_PARAMS });
    const ds = new GraphDataSource();

    ds.on('fetchError', errorMsg => {
      expect(ds.isLoading).toBeFalsy();
      expect(ds.isError).toBeTruthy();
      expect(ds.errorMessage).toEqual('foo bar');
      expect(errorMsg).toEqual('Cannot load the graph: foo bar');
      expect(ds.fetchParameters).toEqual(FETCH_PARAMS);

      done();
    });

    ds.fetchGraphData(FETCH_PARAMS);
  });
});
