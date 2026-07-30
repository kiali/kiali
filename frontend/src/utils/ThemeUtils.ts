import { useKialiSelector } from 'hooks/redux';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';
import { isParentKiosk } from 'components/Kiosk/KioskActions';
import { getKioskMode } from 'utils/SearchParamUtils';
import { KIALI_THEME, PF_THEME_DARK, Theme } from 'types/Common';

export const getKialiTheme = (): Theme => {
  return (
    (localStorage.getItem(KIALI_THEME) as Theme) || (store.getState().globalState.theme as Theme) || getDefaultTheme()
  );
};

export const useKialiTheme = (): string => {
  return useKialiSelector(state => state.globalState.theme) || getDefaultTheme();
};

/** Read color scheme from PatternFly classes on <html> (set by OpenShift Console in OSSMC). */
export const readDocumentTheme = (): Theme => {
  return document.documentElement.classList.contains(PF_THEME_DARK) ? Theme.DARK : Theme.LIGHT;
};

/**
 * True when an embedder (e.g. OSSMC) shares this window and owns theme classes on <html>.
 * In that case Kiali must sync Redux from the document and must not overwrite classes
 * (including glass / high-contrast classes applied by OCP Console).
 */
export const isParentOwnedTheme = (): boolean => {
  return isParentKiosk(getKioskMode()) && window.top === window.self;
};

/** Update Redux from current <html> theme classes without modifying the document. */
export const syncReduxThemeFromDocument = (): Theme => {
  const theme = readDocumentTheme();
  store.dispatch(GlobalActions.setTheme(theme));
  return theme;
};

/**
 * Applies PatternFly light/dark class on <html>.
 * Do not call this when isParentOwnedTheme() is true (OSSMC / OpenShift Console owns classes).
 * Glass / high-contrast classes are never applied by Kiali (PatternFly 6.5+ / OCP Console only).
 */
export const applyDocumentTheme = (theme: Theme): void => {
  document.documentElement.classList.toggle(PF_THEME_DARK, theme === Theme.DARK);
};

/**
 * Watch <html> class changes (OpenShift Console theme switcher) and invoke callback.
 * Returns an unsubscribe function.
 */
export const observeDocumentTheme = (onChange: () => void): (() => void) => {
  const root = document.documentElement;
  let lastTheme = readDocumentTheme();

  const notifyIfChanged = (): void => {
    const theme = readDocumentTheme();

    if (theme !== lastTheme) {
      lastTheme = theme;
      onChange();
    }
  };

  const observer = new MutationObserver(notifyIfChanged);
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });

  return () => observer.disconnect();
};

// Get default theme from system settings
const getDefaultTheme = (): Theme => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return Theme.DARK;
  }

  return Theme.LIGHT;
};
