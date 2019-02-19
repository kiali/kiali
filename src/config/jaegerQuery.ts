import deepFreeze from 'deep-freeze';

const jaegerQuery = {
  PATH: '/search',
  OPTIONS: {
    START_TIME: 'start',
    END_TIME: 'end',
    LIMIT_TRACES: 'limit',
    LOOKBACK: 'lookback',
    MAX_DURATION: 'maxDuration',
    MIN_DURATION: 'minDuration',
    SERVICE_SELECTOR: 'service',
    TAGS: 'tags'
  },
  EMBED: {
    UI_EMBED: 'uiEmbed',
    UI_SEARCH_HIDE_GRAPH: 'uiSearchHideGraph',
    UI_TRACE_COLLAPSE_TITLE: 'uiTimelineCollapseTitle',
    UI_TRACE_HIDE_MINIMAP: 'uiTimelineHideMinimap',
    UI_TRACE_HIDE_SUMMARY: 'uiTimelineHideSummary',
    VERSION: 'v0'
  }
};

export const JAEGER_QUERY = () => {
  return deepFreeze(jaegerQuery) as typeof jaegerQuery;
};
