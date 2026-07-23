import { useKialiSelector } from 'hooks/redux';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';
import { isParentKiosk } from 'components/Kiosk/KioskActions';
import { getKioskMode } from 'utils/SearchParamUtils';
import {
  ContrastMode,
  KIALI_CONTRAST_MODE,
  KIALI_THEME,
  PF_THEME_DARK,
  PF_THEME_GLASS,
  PF_THEME_HIGH_CONTRAST,
  Theme
} from 'types/Common';

export const getKialiTheme = (): Theme => {
  return (
    (localStorage.getItem(KIALI_THEME) as Theme) || (store.getState().globalState.theme as Theme) || getDefaultTheme()
  );
};

export const getKialiContrastMode = (): ContrastMode => {
  return (
    (localStorage.getItem(KIALI_CONTRAST_MODE) as ContrastMode) ||
    (store.getState().globalState.contrastMode as ContrastMode) ||
    getDefaultContrastMode()
  );
};

export const useKialiTheme = (): string => {
  return useKialiSelector(state => state.globalState.theme) || getDefaultTheme();
};

export const useKialiContrastMode = (): string => {
  return useKialiSelector(state => state.globalState.contrastMode) || getDefaultContrastMode();
};

/** Read color scheme from PatternFly classes on <html> (set by OpenShift Console in OSSMC). */
export const readDocumentTheme = (): Theme => {
  return document.documentElement.classList.contains(PF_THEME_DARK) ? Theme.DARK : Theme.LIGHT;
};

/** Read contrast mode from PatternFly classes on <html>. High contrast wins over glass. */
export const readDocumentContrastMode = (): ContrastMode => {
  const classes = document.documentElement.classList;

  if (classes.contains(PF_THEME_HIGH_CONTRAST)) {
    return ContrastMode.HIGH_CONTRAST;
  }

  if (classes.contains(PF_THEME_GLASS)) {
    return ContrastMode.GLASS;
  }

  return ContrastMode.DEFAULT;
};

/**
 * True when an embedder (e.g. OSSMC) shares this window and owns theme classes on <html>.
 * In that case Kiali must sync Redux from the document and must not overwrite classes.
 */
export const isParentOwnedTheme = (): boolean => {
  return isParentKiosk(getKioskMode()) && window.top === window.self;
};

/** Update Redux from current <html> theme classes without modifying the document. */
export const syncReduxThemeFromDocument = (): { contrastMode: ContrastMode; theme: Theme } => {
  const theme = readDocumentTheme();
  const contrastMode = readDocumentContrastMode();

  store.dispatch(GlobalActions.setTheme(theme));
  store.dispatch(GlobalActions.setContrastMode(contrastMode));

  return { contrastMode, theme };
};

/**
 * Applies PatternFly theme classes on <html>.
 * Color scheme (light/dark) and contrast mode (default/glass/high-contrast) are orthogonal,
 * except glass and high contrast must never both be active — high contrast wins.
 *
 * Do not call this when isParentOwnedTheme() is true (OSSMC / OpenShift Console owns classes).
 */
export const applyDocumentTheme = (theme: Theme, contrastMode: ContrastMode): void => {
  const root = document.documentElement;

  root.classList.toggle(PF_THEME_DARK, theme === Theme.DARK);

  // High contrast disables glass for accessibility (PatternFly requirement).
  const effectiveContrast =
    contrastMode === ContrastMode.HIGH_CONTRAST
      ? ContrastMode.HIGH_CONTRAST
      : contrastMode === ContrastMode.GLASS && !prefersReducedTransparency()
        ? ContrastMode.GLASS
        : ContrastMode.DEFAULT;

  root.classList.toggle(PF_THEME_GLASS, effectiveContrast === ContrastMode.GLASS);
  root.classList.toggle(PF_THEME_HIGH_CONTRAST, effectiveContrast === ContrastMode.HIGH_CONTRAST);
};

/**
 * Watch <html> class changes (OpenShift Console theme switcher) and invoke callback.
 * Returns an unsubscribe function.
 */
export const observeDocumentTheme = (onChange: () => void): (() => void) => {
  const root = document.documentElement;
  let lastTheme = readDocumentTheme();
  let lastContrast = readDocumentContrastMode();

  const notifyIfChanged = (): void => {
    const theme = readDocumentTheme();
    const contrastMode = readDocumentContrastMode();

    if (theme !== lastTheme || contrastMode !== lastContrast) {
      lastTheme = theme;
      lastContrast = contrastMode;
      onChange();
    }
  };

  const observer = new MutationObserver(notifyIfChanged);
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });

  return () => observer.disconnect();
};

const prefersReducedTransparency = (): boolean => {
  return window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches ?? false;
};

// Get default color scheme from system settings
const getDefaultTheme = (): Theme => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return Theme.DARK;
  }

  return Theme.LIGHT;
};

// Prefer high contrast when the OS requests more contrast or forced colors.
const getDefaultContrastMode = (): ContrastMode => {
  if (
    window.matchMedia &&
    (window.matchMedia('(prefers-contrast: more)').matches || window.matchMedia('(forced-colors: active)').matches)
  ) {
    return ContrastMode.HIGH_CONTRAST;
  }

  return ContrastMode.DEFAULT;
};
