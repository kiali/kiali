import { HistoryManager, URLParam } from '../app/History';

export const getKioskMode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const kioskParam = urlParams.get('kiosk');
  if (kioskParam) {
    return kioskParam;
  }
  return '';
};

export const isKioskMode = () => {
  return getKioskMode() !== '';
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

export const getSpanId = () => {
  return new URLSearchParams(window.location.search).get(URLParam.TRACING_SPAN_ID) || undefined;
};

export const getTraceId = () => {
  return new URLSearchParams(window.location.search).get(URLParam.TRACING_TRACE_ID) || undefined;
};

export const getClusterName = () => {
  return new URLSearchParams(window.location.search).get(URLParam.CLUSTERNAME) || undefined;
};

export const setTraceId = (traceId?: string) => {
  if (traceId) {
    HistoryManager.setParam(URLParam.TRACING_TRACE_ID, traceId);
  } else {
    HistoryManager.deleteParam(URLParam.TRACING_TRACE_ID);
  }
};

export const getParamsSeparator = (url: string): string => {
  return url.includes('?') ? '&' : '?';
};
