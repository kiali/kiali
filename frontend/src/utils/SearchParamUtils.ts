import { HistoryManager, URLParam } from '../app/History';
// Direct store import is needed because kiosk detection is used in non-React
// contexts (class components, utility helpers) where hooks are unavailable.
import { store } from 'store/ConfigStore';

// In OSSMC the kiosk URL parameter is set once during the initial iframe load
// and subsequent SPA navigations lose it. The Redux store preserves the value
// set by AuthenticationController.setDocLayout, so we fall back to it when the
// URL parameter is absent.
export const getKioskMode = (): string => {
  const urlParams = new URLSearchParams(window.location.search);
  const kioskParam = urlParams.get('kiosk');

  if (kioskParam) {
    return kioskParam;
  }

  return store?.getState()?.globalState?.kiosk ?? '';
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
