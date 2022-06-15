import {store} from "../../store/ConfigStore";
import {Show} from "../../pages/Overview/OverviewPage";
import {DurationInSeconds, IntervalInMilliseconds} from "../../types/Common";
import {HEALTHY} from "../../types/Health";

// Specific actions that should be communicated to the parent of the Kiosk
// These actions have Kiali semantic, the parent of the Kiosk should translate them to their specific domain
// No parent kiosk domain logic should be added here

export const kioskGraphAction = (namespace: string, healthStatus: string, duration: DurationInSeconds, refreshInterval: IntervalInMilliseconds) => {
  let showInParent = '/graph/namespaces?namespaces=' + namespace;
  if (healthStatus === HEALTHY.name) {
    showInParent += '&graphFind=healthy';
  } else {
    showInParent += '&graphFind=!healthy';
  }
  showInParent += '&duration=' + duration + '&refresh=' + refreshInterval;
  sendParentMessage(showInParent);
}

export const kioskIstioConfigAction = (namespace: string) => {
  const showInParent = '/istio?namespaces=' + namespace;
  sendParentMessage(showInParent);
}

export const kioskOverviewAction = (showType: Show, namespace: string, duration: DurationInSeconds, refreshInterval: IntervalInMilliseconds) => {
  let showInParent = 'overview';
  switch (showType) {
    case Show.GRAPH:
      showInParent = '/graph/namespaces?namespaces=' + namespace;
      break;
    case Show.ISTIO_CONFIG:
      showInParent = '/istio?namespaces=' + namespace;
      break;
  }
  showInParent += '&duration=' + duration + '&refresh=' + refreshInterval;
  sendParentMessage(showInParent);
};


// Message has no format, parent should parse it for its needs
const sendParentMessage = (msg: string): void => {
  // Kiosk parameter will capture the parent target; this will enable iframe -> parent communication
  const targetOrigin = store.getState().globalState.kiosk;
  window.top.postMessage(msg, targetOrigin);
}
