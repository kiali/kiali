import { HistoryManager, URLParam } from '../app/History';

export const getKioskMode = (): string => {
  const urlParams = new URLSearchParams(window.location.search);
  const kioskParam = urlParams.get('kiosk');

  if (kioskParam) {
    return kioskParam;
  }

  return '';
};

export const isKioskMode = (): boolean => {
  return getKioskMode() !== '';
};

export const getFocusSelector = (): string | undefined => {
  return new URLSearchParams(window.location.search).get(URLParam.FOCUS_SELECTOR) || undefined;
};

export const unsetFocusSelector = (): void => {
  HistoryManager.deleteParam(URLParam.FOCUS_SELECTOR);
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

export const getSpanId = (): string | undefined => {
  return new URLSearchParams(window.location.search).get(URLParam.TRACING_SPAN_ID) || undefined;
};

export const getTraceId = (): string | undefined => {
  return new URLSearchParams(window.location.search).get(URLParam.TRACING_TRACE_ID) || undefined;
};

export const getClusterName = (): string | undefined => {
  return new URLSearchParams(window.location.search).get(URLParam.CLUSTERNAME) || undefined;
};

export const setTraceId = (traceId?: string): void => {
  if (traceId) {
    HistoryManager.setParam(URLParam.TRACING_TRACE_ID, traceId);
  } else {
    HistoryManager.deleteParam(URLParam.TRACING_TRACE_ID);
  }
};

export const getParamsSeparator = (url: string): string => {
  return url.includes('?') ? '&' : '?';
};
