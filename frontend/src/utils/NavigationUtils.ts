import { location, router } from '../app/History';
import { store } from '../store/ConfigStore';
import { isParentKiosk, kioskNavigateAction } from '../components/Kiosk/KioskActions';

export const OSSM_CONSOLE = 'ossmconsole';

interface NavigateOptions {
  relative?: 'route' | 'path';
  replace?: boolean;
  state?: unknown;
}

/**
 * Navigate to a URL in a way that is compatible with both standalone Kiali
 * and OSSMC (OpenShift Service Mesh Console) kiosk mode.
 *
 * When running in kiosk mode with a parent (OSSMC), this sends a postMessage
 * to the parent window instead of using the router directly.
 *
 * @param url - The URL path to navigate to (e.g., '/namespaces' or '/mesh?meshHide=...')
 * @param options - Navigation options (replace, state, relative)
 */
export const kialiNavigate = (url: string, options?: NavigateOptions): void => {
  const kiosk = store.getState().globalState.kiosk;

  if (isParentKiosk(kiosk)) {
    kioskNavigateAction(url);
  } else {
    router.navigate(url, options);
  }
};

const pathSegments = (pathname: string): string[] => pathname.split('/').filter(Boolean);

/**
 * True when this frontend is running inside OpenShift Service Mesh Console.
 * Matches both plugin routes (`/ossmconsole/troubleshooting`) and Console
 * resource tabs (`/k8s/ns/.../ossmconsole`).
 */
export const isOSSMC = (): boolean => {
  const routerPath = location.getPathname() ?? '';
  const windowPath = typeof window !== 'undefined' ? (window.location?.pathname ?? '') : '';
  return [routerPath, windowPath].some(path => pathSegments(path).includes(OSSM_CONSOLE));
};

/**
 * Get the page path from the current URL. In OSSMC, the plugin prefix must be removed.
 *
 * @returns The page path without the plugin prefix (e.g., 'overview', 'applications', 'services')
 */
export const getPagePath = (): string => {
  let pathname = location.getPathname() ?? '';

  // Remove leading slash first to normalize the path
  if (pathname.startsWith('/')) {
    pathname = pathname.substring(1);
  }

  // Remove the plugin prefix for OSSMC
  if (pathname.startsWith(`${OSSM_CONSOLE}/`)) {
    pathname = pathname.substring(OSSM_CONSOLE.length + 1);
  }

  return pathname;
};
