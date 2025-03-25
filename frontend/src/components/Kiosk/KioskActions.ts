import { store } from '../../store/ConfigStore';
import { Show } from '../../pages/Overview/OverviewPage';
import { DurationInSeconds, IntervalInMilliseconds, TimeRange } from '../../types/Common';
import { HEALTHY } from '../../types/Health';

// Specific actions that should be communicated to the parent of the Kiosk
// These actions have Kiali semantic, the parent of the Kiosk should translate them to their specific domain
// No parent kiosk domain logic should be added here

export const kioskGraphAction = (
  namespace: string,
  healthStatus: string,
  duration: DurationInSeconds,
  refreshInterval: IntervalInMilliseconds,
  targetPage: string
): void => {
  let showInParent = `/graph/namespaces?namespaces=${namespace}`;
  if (healthStatus === HEALTHY.name) {
    showInParent += '&graphFind=healthy';
  } else {
    showInParent += '&graphFind=!healthy';
  }
  showInParent += `&duration=${duration}&refresh=${refreshInterval}`;
  switch (targetPage) {
    case 'applications':
      showInParent += '&graphType=versionedApp';
      break;
    case 'services':
      showInParent += '&graphType=service';
      break;
    case 'workloads':
      showInParent += '&graphType=workload';
      break;
  }
  sendParentMessage(showInParent);
};

export const kioskContextMenuAction = (href: string): void => {
  const showInParent = href;
  sendParentMessage(showInParent);
};

export const kioskIstioConfigAction = (namespace: string): void => {
  const showInParent = `/istio?namespaces=${namespace}`;
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

export const kioskTracingAction = (url: string, traceID?: string): void => {
  const showInParent = `/tracing/namespaces?trace=${traceID}&url=${url}`;
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
  // this will enable parent communication
  const targetOrigin = store.getState().globalState.kiosk;
  if (isParentKiosk(targetOrigin)) {
    window.top?.postMessage(msg, targetOrigin);
  }
};
