import JaegerState, { converToTimestamp } from '../JaegerState';
import { JaegerActions } from '../../actions/JaegerActions';

const initialState = {
  toolbar: {
    services: [],
    isFetchingService: false
  },
  search: {
    serviceSelected: '',
    namespaceSelected: '',
    hideGraph: false,
    limit: 20,
    start: '',
    end: '',
    minDuration: '',
    maxDuration: '',
    lookback: '1h',
    url: '',
    tags: ''
  },
  trace: {
    collapseTitle: false,
    hideSummary: false,
    hideMinimap: false
  },
  jaegerURL: ''
};

describe('JaegerState reducer', () => {
  let expectedState;
  beforeEach(() => {
    expectedState = initialState;
  });
  it('should set url', () => {
    const url = 'https://jaeger-query-istio-system.127.0.0.1.nip.io';
    expectedState.jaegerURL = url;
    expect(JaegerState(initialState, JaegerActions.setUrl(url))).toEqual(expectedState);
  });

  it('should start request', () => {
    expectedState.toolbar.isFetchingService = true;
    expect(JaegerState(initialState, JaegerActions.requestStarted())).toEqual(expectedState);
  });

  it('should receiveList', () => {
    const services = ['details', 'productpage'];
    expectedState.toolbar.isFetchingService = false;
    expectedState.toolbar.services = services;
    expect(JaegerState(initialState, JaegerActions.receiveList(services))).toEqual(expectedState);
  });

  it('should failed request', () => {
    expectedState.toolbar.isFetchingService = false;
    expect(JaegerState(initialState, JaegerActions.requestFailed())).toEqual(expectedState);
  });

  it('should set namespace', () => {
    const ns = 'bookinfo';
    expectedState.search.namespaceSelected = ns;
    expect(JaegerState(initialState, JaegerActions.setNamespace(ns))).toEqual(expectedState);
  });

  it('should set service', () => {
    const service = 'details';
    expectedState.search.serviceSelected = service;
    expect(JaegerState(initialState, JaegerActions.setService(service))).toEqual(expectedState);
  });

  it('should set tags', () => {
    const tags = 'error=true';
    expectedState.search.tags = tags;
    expect(JaegerState(initialState, JaegerActions.setTags(tags))).toEqual(expectedState);
  });

  it('should set limit', () => {
    const limit = 10;
    expectedState.search.limit = limit;
    expect(JaegerState(initialState, JaegerActions.setLimit(limit))).toEqual(expectedState);
  });

  describe('should set Lookback', () => {
    it('method converToTimestamp', () => {
      const useCases = ['1h', '2h', '3h', '6h', '12h', '24h', '2d'];
      const multiplier = 60 * 60 * 1000 * 1000;
      useCases.forEach(c => {
        let mul = multiplier;
        if (c.slice(-1) === 'd') {
          mul *= 24;
        }
        expect(converToTimestamp(c)).toEqual(Number(c.slice(0, -1)) * mul);
      });
    });

    it('lookback with custom', () => {
      const lookback = 'custom';
      expectedState.search.lookback = lookback;
      expect(JaegerState(initialState, JaegerActions.setLookback(lookback))).toEqual(expectedState);
    });
  });

  it('should set SearchRequest', () => {
    const url =
      'https://jaeger-query-istio-system.127.0.0.1.nip.io/search?end=1548834181189000&limit=20&lookback=1h&maxDuration&minDuration&service=productpage&start=1548830581189000';
    expectedState.search.url = url;
    expect(JaegerState(initialState, JaegerActions.setSearchRequest(url))).toEqual(expectedState);
  });

  it('should set SearchGraphToHide', () => {
    const hideGraph = true;
    expectedState.search.hideGraph = hideGraph;
    expect(JaegerState(initialState, JaegerActions.setSearchGraphToHide(hideGraph))).toEqual(expectedState);
  });

  it('should set CustomLookback', () => {
    const start = '1548834422023000';
    const end = '1548830822023000';
    expectedState.search.start = start;
    expectedState.search.end = end;
    expect(JaegerState(initialState, JaegerActions.setCustomLookback(start, end))).toEqual(expectedState);
  });

  it('should set Durations', () => {
    const min = '1ms';
    const max = '1m';
    expectedState.search.minDuration = min;
    expectedState.search.maxDuration = max;
    expect(JaegerState(initialState, JaegerActions.setDurations(min, max))).toEqual(expectedState);
  });

  it('should set DetailsToShow', () => {
    const hideSummary = true;
    expectedState.trace.hideSummary = hideSummary;
    expect(JaegerState(initialState, JaegerActions.setDetailsToShow(hideSummary))).toEqual(expectedState);
  });

  it('should set MinimapToShow', () => {
    const hideMinimap = true;
    expectedState.trace.hideMinimap = hideMinimap;
    expect(JaegerState(initialState, JaegerActions.setMinimapToShow(hideMinimap))).toEqual(expectedState);
  });
});
