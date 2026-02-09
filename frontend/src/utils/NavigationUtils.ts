import { router } from '../app/History';
import { store } from '../store/ConfigStore';
import { isParentKiosk, kioskContextMenuAction } from '../components/Kiosk/KioskActions';

/**
 * Navigate to a URL in a way that is compatible with both standalone Kiali
 * and OSSMC (OpenShift Service Mesh Console) kiosk mode.
 *
 * When running in kiosk mode with a parent (OSSMC), this sends a postMessage
 * to the parent window instead of using the router directly.
 *
 * @param url - The URL path to navigate to (e.g., '/namespaces' or '/mesh?meshHide=...')
 * @param replace - If true, replaces the current history entry instead of pushing a new one
 */
export const kialiNavigate = (url: string, replace?: boolean): void => {
  const kiosk = store.getState().globalState.kiosk;

  if (isParentKiosk(kiosk)) {
    kioskContextMenuAction(url);
  } else {
    router.navigate(url, { replace });
  }
};
