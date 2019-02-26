import deepFreeze from 'deep-freeze';

const jaegerQueryConfig = {
  path: '/search',
  options: {
    startTime: 'start',
    endTime: 'end',
    limitTraces: 'limit',
    lookback: 'lookback',
    maxDuration: 'maxDuration',
    minDuration: 'minDuration',
    serviceSelector: 'service',
    tags: 'tags'
  },
  embed: {
    uiEmbed: 'uiEmbed',
    uiSearchHideGraph: 'uiSearchHideGraph',
    uiTraceCollapseTitle: 'uiTimelineCollapseTitle',
    uiTraceHideMinimap: 'uiTimelineHideMinimap',
    uiTraceHideSummary: 'uiTimelineHideSummary',
    version: 'v0'
  }
};

export const jaegerQuery = () => {
  return deepFreeze(jaegerQueryConfig) as typeof jaegerQueryConfig;
};
