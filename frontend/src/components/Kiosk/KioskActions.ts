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

// Message has no format, parent should parse it for its needs
const sendParentMessage = (msg: string): void => {
  // Kiosk parameter will send the parent target when kiosk !== "true"
  // this will enable parent communication.
  // Guard: only send if actually embedded in a parent frame. Without this check,
  // a direct visit with ?kiosk=https://attacker.com would attempt postMessage to
  // window.top (which equals window itself), allowing origin confusion.
  const targetOrigin = store.getState().globalState.kiosk;
  if (isParentKiosk(targetOrigin) && window.top !== window.self) {
    window.top?.postMessage(msg, targetOrigin);
  }
};
