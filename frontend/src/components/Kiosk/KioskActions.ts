import { store } from '../../store/ConfigStore';
import { DurationInSeconds, IntervalInMilliseconds, Show, TimeRange } from '../../types/Common';

export const kioskNavigateAction = (href: string): void => {
  const showInParent = href;
  sendParentMessage(showInParent);
};

export const kioskOverviewAction = (
  showType: Show,
  namespace: string,
  duration: DurationInSeconds,
  refreshInterval: IntervalInMilliseconds
): void => {
  let showInParent = 'overview';
  switch (showType) {
    case Show.GRAPH:
      showInParent = `/graph/namespaces?namespaces=${namespace}`;
      break;
    case Show.ISTIO_CONFIG:
      showInParent = `/istio?namespaces=${namespace}`;
      break;
  }
  showInParent += `&duration=${duration}&refresh=${refreshInterval}`;
  sendParentMessage(showInParent);
};

export const kioskDurationAction = (duration: DurationInSeconds): void => {
  const showInParent = `duration=${duration}`;
  sendParentMessage(showInParent);
};

export const kioskTimeRangeAction = (timeRange: TimeRange): void => {
  const showInParent = `timeRange=${JSON.stringify(timeRange)}`;
  sendParentMessage(showInParent);
};

export const kioskRefreshAction = (refreshInterval: IntervalInMilliseconds): void => {
  const showInParent = `refresh=${refreshInterval}`;
  sendParentMessage(showInParent);
};

// Encode parameters to prevent query-string injection in parent message parsing.
export const kioskTracingAction = (url?: string, traceID?: string): void => {
  const showInParent = `/tracing/namespaces?trace=${encodeURIComponent(traceID ?? '')}&url=${encodeURIComponent(
    url ?? ''
  )}`;
  sendParentMessage(showInParent);
};

export const isKiosk = (kiosk: string): boolean => {
  return kiosk.length > 0;
};

export const isParentKiosk = (kiosk: string): boolean => {
  return kiosk.length > 0 && kiosk !== 'true';
};

// Send a message to the parent context so it can handle navigation.
// In an iframe the target is window.top; otherwise (e.g. OSSMC dynamic plugin
// running in the same window) the target is window itself.
// This is safe even if kiosk holds an attacker-supplied origin: the browser's
// postMessage origin check will reject delivery when targetOrigin doesn't match
// the recipient window's actual origin.
const sendParentMessage = (msg: string): void => {
  const targetOrigin = store.getState().globalState.kiosk;
  if (!isParentKiosk(targetOrigin)) {
    return;
  }

  const isEmbeddedInIframe = window.top !== window.self;
  const target = isEmbeddedInIframe ? window.top : window;
  target?.postMessage(msg, targetOrigin);
};
