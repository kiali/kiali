import { ActionType, createAction, createStandardAction } from 'typesafe-actions';

enum JaegerActionKeys {
  SET_URL = 'SET_URL',
  SERVICE_REQUEST_STARTED = 'SERVICE_REQUEST_STARTED',
  SERVICE_SUCCESS = 'SERVICE_SUCCESS',
  SERVICE_FAILED = 'SERVICE_FAILED',
  SET_SERVICE = 'SET_SERVICE',
  SET_NAMESPACE = 'SET_NAMESPACE',
  SET_LOOKBACK = 'SET_LOOKBACK',
  SET_LOOKBACK_CUSTOM = 'SET_LOOKBACK_CUSTOM',
  SET_SEARCH_REQUEST = 'SET_SEARCH_REQUEST',
  SET_TAGS = 'SET_TAGS',
  SET_LIMIT = 'SET_LIMIT',
  SET_DURATIONS = 'SET_DURATIONS',

  // ENABLE INTEGRAION WITH JAEGER
  SET_ENABLE_INTEGRATION = 'SET_ENABLE_INTEGRATION',
  // RESULTS VISUALZIATION OPTIONS
  SET_SEARCH_GRAPH_TO_HIDE = 'SET_SEARCH_GRAPH_TO_HIDE',

  // TRACE VISUALIZATION OPTIONS
  SET_TRACE_MINIMAP_TO_SHOW = 'SET_TRACE_MINIMAP_TO_SHOW',
  SET_TRACE_DETAILS_TO_SHOW = 'SET_TRACE_DETAILS_TO_SHOW'
}

// synchronous action creators
export const JaegerActions = {
  setUrl: createAction(JaegerActionKeys.SET_URL, resolve => (url: string) =>
    resolve({
      url: url
    })
  ),
  requestStarted: createAction(JaegerActionKeys.SERVICE_REQUEST_STARTED),
  requestFailed: createAction(JaegerActionKeys.SERVICE_FAILED),
  receiveList: createAction(JaegerActionKeys.SERVICE_SUCCESS, resolve => (newList: string[]) =>
    resolve({
      list: newList
    })
  ),
  setEnableIntegration: createStandardAction(JaegerActionKeys.SET_ENABLE_INTEGRATION)<boolean>(),
  setService: createStandardAction(JaegerActionKeys.SET_SERVICE)<string>(),
  setNamespace: createStandardAction(JaegerActionKeys.SET_NAMESPACE)<string>(),
  setLookback: createStandardAction(JaegerActionKeys.SET_LOOKBACK)<number>(),
  setTags: createStandardAction(JaegerActionKeys.SET_TAGS)<string>(),
  setLimit: createStandardAction(JaegerActionKeys.SET_LIMIT)<number>(),
  setSearchRequest: createStandardAction(JaegerActionKeys.SET_SEARCH_REQUEST)<string>(),
  setSearchGraphToHide: createStandardAction(JaegerActionKeys.SET_SEARCH_GRAPH_TO_HIDE)<boolean>(),
  setMinimapToShow: createStandardAction(JaegerActionKeys.SET_TRACE_MINIMAP_TO_SHOW)<boolean>(),
  setDetailsToShow: createStandardAction(JaegerActionKeys.SET_TRACE_DETAILS_TO_SHOW)<boolean>(),
  setCustomLookback: createAction(JaegerActionKeys.SET_LOOKBACK_CUSTOM, resolve => (start: string, end: string) =>
    resolve({
      start: start,
      end: end
    })
  ),
  setDurations: createAction(JaegerActionKeys.SET_DURATIONS, resolve => (min: string, max: string) =>
    resolve({
      min: min,
      max: max
    })
  )
};

export type JaegerAction = ActionType<typeof JaegerActions>;
