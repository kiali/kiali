import { JaegerState } from '../store/Store';
import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { JaegerActions } from '../actions/JaegerActions';

export const INITIAL_JAEGER_STATE: JaegerState = {
  toolbar: {
    services: [],
    isFetchingService: false
  },
  search: {
    namespaceSelected: '',
    serviceSelected: '',
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

export const converToTimestamp = (lookback: string): number => {
  let multiplier = 60 * 60 * 1000 * 1000;
  if (lookback.slice(-1) === 'd') {
    multiplier *= 24;
  }
  return Number(lookback.slice(0, -1)) * multiplier;
};

const JaegerState = (state: JaegerState = INITIAL_JAEGER_STATE, action: KialiAppAction): JaegerState => {
  switch (action.type) {
    case getType(JaegerActions.setUrl):
      return updateState(state, {
        jaegerURL: action.payload.url
      });
    case getType(JaegerActions.requestStarted):
      return updateState(state, {
        toolbar: {
          isFetchingService: true,
          services: state.toolbar.services
        }
      });

    case getType(JaegerActions.receiveList):
      return updateState(state, {
        toolbar: {
          services: action.payload.list,
          isFetchingService: false
        }
      });

    case getType(JaegerActions.requestFailed):
      return updateState(state, {
        toolbar: {
          services: state.toolbar.services,
          isFetchingService: false
        }
      });
    case getType(JaegerActions.setNamespace):
      return updateState(state, {
        search: {
          namespaceSelected: action.payload,
          serviceSelected: state.search.serviceSelected,
          hideGraph: state.search.hideGraph,
          limit: state.search.limit,
          start: state.search.start,
          end: state.search.end,
          minDuration: state.search.minDuration,
          maxDuration: state.search.maxDuration,
          lookback: state.search.lookback,
          url: state.search.url,
          tags: state.search.tags
        }
      });
    case getType(JaegerActions.setService):
      return updateState(state, {
        search: {
          namespaceSelected: state.search.namespaceSelected,
          serviceSelected: action.payload,
          hideGraph: state.search.hideGraph,
          limit: state.search.limit,
          start: state.search.start,
          end: state.search.end,
          minDuration: state.search.minDuration,
          maxDuration: state.search.maxDuration,
          lookback: state.search.lookback,
          url: state.search.url,
          tags: state.search.tags
        }
      });
    case getType(JaegerActions.setTags):
      return updateState(state, {
        search: {
          namespaceSelected: state.search.namespaceSelected,
          serviceSelected: state.search.serviceSelected,
          hideGraph: state.search.hideGraph,
          limit: state.search.limit,
          start: state.search.start,
          end: state.search.end,
          minDuration: state.search.minDuration,
          maxDuration: state.search.maxDuration,
          lookback: state.search.lookback,
          url: state.search.url,
          tags: action.payload
        }
      });
    case getType(JaegerActions.setLimit):
      return updateState(state, {
        search: {
          namespaceSelected: state.search.namespaceSelected,
          serviceSelected: state.search.serviceSelected,
          hideGraph: state.search.hideGraph,
          limit: action.payload,
          start: state.search.start,
          end: state.search.end,
          minDuration: state.search.minDuration,
          maxDuration: state.search.maxDuration,
          lookback: state.search.lookback,
          url: state.search.url,
          tags: state.search.tags
        }
      });
    case getType(JaegerActions.setLookback): {
      const nowTime = Date.now() * 1000;
      const endTime = action.payload !== 'custom' ? `${nowTime}` : state.search.start;
      const startTime =
        action.payload !== 'custom' ? `${nowTime - converToTimestamp(action.payload)}` : state.search.end;
      return updateState(state, {
        search: {
          namespaceSelected: state.search.namespaceSelected,
          serviceSelected: state.search.serviceSelected,
          hideGraph: state.search.hideGraph,
          limit: state.search.limit,
          start: startTime,
          end: endTime,
          minDuration: state.search.minDuration,
          maxDuration: state.search.maxDuration,
          lookback: action.payload,
          url: state.search.url,
          tags: state.search.tags
        }
      });
    }
    case getType(JaegerActions.setSearchRequest): {
      return updateState(state, {
        search: {
          namespaceSelected: state.search.namespaceSelected,
          serviceSelected: state.search.serviceSelected,
          hideGraph: state.search.hideGraph,
          limit: state.search.limit,
          start: state.search.start,
          end: state.search.end,
          minDuration: state.search.minDuration,
          maxDuration: state.search.maxDuration,
          lookback: state.search.lookback,
          url: action.payload,
          tags: state.search.tags
        }
      });
    }
    case getType(JaegerActions.setSearchGraphToHide): {
      return updateState(state, {
        search: {
          namespaceSelected: state.search.namespaceSelected,
          serviceSelected: state.search.serviceSelected,
          hideGraph: action.payload,
          limit: state.search.limit,
          start: state.search.start,
          end: state.search.end,
          minDuration: state.search.minDuration,
          maxDuration: state.search.maxDuration,
          lookback: state.search.lookback,
          url: state.search.url,
          tags: state.search.tags
        }
      });
    }
    case getType(JaegerActions.setCustomLookback): {
      return updateState(state, {
        search: {
          namespaceSelected: state.search.namespaceSelected,
          serviceSelected: state.search.serviceSelected,
          hideGraph: state.search.hideGraph,
          limit: state.search.limit,
          start: action.payload.start,
          end: action.payload.end,
          minDuration: state.search.minDuration,
          maxDuration: state.search.maxDuration,
          lookback: state.search.lookback,
          url: state.search.url,
          tags: state.search.tags
        }
      });
    }
    case getType(JaegerActions.setDurations): {
      return updateState(state, {
        search: {
          namespaceSelected: state.search.namespaceSelected,
          serviceSelected: state.search.serviceSelected,
          hideGraph: state.search.hideGraph,
          limit: state.search.limit,
          start: state.search.start,
          end: state.search.end,
          minDuration: action.payload.min,
          maxDuration: action.payload.max,
          lookback: state.search.lookback,
          url: state.search.url,
          tags: state.search.tags
        }
      });
    }
    case getType(JaegerActions.setDetailsToShow): {
      return updateState(state, {
        trace: {
          collapseTitle: state.trace.collapseTitle,
          hideSummary: action.payload,
          hideMinimap: state.trace.hideMinimap
        }
      });
    }
    case getType(JaegerActions.setMinimapToShow): {
      return updateState(state, {
        trace: {
          collapseTitle: state.trace.collapseTitle,
          hideSummary: state.trace.hideSummary,
          hideMinimap: action.payload
        }
      });
    }
    default:
      return state;
  }
};

export default JaegerState;
