import { HistoryManager, URLParam } from '../app/History';

export const isKioskMode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('kiosk') === 'true';
};

export const getFocusSelector = () => {
  return new URLSearchParams(window.location.search).get(URLParam.FOCUS_SELECTOR) || undefined;
};

export const unsetFocusSelector = () => {
  HistoryManager.deleteParam(URLParam.FOCUS_SELECTOR, true);
};

export const getExperimentalFlags = (): string[] => {
  const flags = HistoryManager.getParam(URLParam.EXPERIMENTAL_FLAGS);
  if (!flags) {
    return [];
  }
  return flags.split(',');
};

export const hasExperimentalFlag = (flag: string): boolean => {
  return getExperimentalFlags().includes(flag);
};

export const getTraceId = () => {
  return new URLSearchParams(window.location.search).get(URLParam.JAEGER_TRACE_ID) || undefined;
};

export const setTraceId = (traceId?: string) => {
  if (traceId) {
    HistoryManager.setParam(URLParam.JAEGER_TRACE_ID, traceId);
  } else {
    HistoryManager.deleteParam(URLParam.JAEGER_TRACE_ID);
  }
};
