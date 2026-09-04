import { useKialiSelector } from 'hooks/redux';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';
import { isParentKiosk } from 'components/Kiosk/KioskActions';
import { getKioskMode } from 'utils/SearchParamUtils';
import {
  ContrastMode,
  KIALI_CONTRAST_MODE,
  KIALI_THEME,
  KIALI_THEME_FELT,
  PF_THEME_DARK,
  PF_THEME_FELT,
  PF_THEME_GLASS,
  PF_THEME_HIGH_CONTRAST,
  Theme
} from 'types/Common';

export type DocumentThemeClasses = {
  contrastMode: ContrastMode;
  themeFelt: boolean;
};

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

export const getKialiThemeFelt = (): boolean => {
  const stored = localStorage.getItem(KIALI_THEME_FELT);

  if (stored !== null) {
    return stored === 'true';
  }

  return store.getState().globalState.themeFelt;
};

export const useKialiTheme = (): string => {
  return useKialiSelector(state => state.globalState.theme) || getDefaultTheme();
};

export const useKialiContrastMode = (): string => {
  return useKialiSelector(state => state.globalState.contrastMode) || getDefaultContrastMode();
};

export const useKialiThemeFelt = (): boolean => {
  return useKialiSelector(state => state.globalState.themeFelt);
};

/** Read color scheme from PatternFly classes on <html> (set by OpenShift Console in OSSMC). */
export const readDocumentTheme = (): Theme => {
  return document.documentElement.classList.contains(PF_THEME_DARK) ? Theme.DARK : Theme.LIGHT;
};

/** Read felt variant from PatternFly classes on <html>. */
export const readDocumentThemeFelt = (): boolean => {
  return document.documentElement.classList.contains(PF_THEME_FELT);
};

/** Read contrast mode from PatternFly classes on <html> (set by OpenShift Console in OSSMC). */
export const readDocumentContrastMode = (): ContrastMode => {
  if (document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)) {
    return ContrastMode.HIGH_CONTRAST;
  }

  if (document.documentElement.classList.contains(PF_THEME_GLASS)) {
    return ContrastMode.GLASS;
  }

  return ContrastMode.TRADITIONAL;
};

export const readDocumentThemeClasses = (): DocumentThemeClasses => {
  return {
    contrastMode: readDocumentContrastMode(),
    themeFelt: readDocumentThemeFelt()
  };
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
export const syncReduxThemeFromDocument = (): DocumentThemeClasses & { theme: Theme } => {
  const theme = readDocumentTheme();
  const { contrastMode, themeFelt } = readDocumentThemeClasses();
  store.dispatch(GlobalActions.setTheme(theme));
  store.dispatch(GlobalActions.setContrastMode(contrastMode));
  store.dispatch(GlobalActions.setThemeFelt(themeFelt));

  return { contrastMode, theme, themeFelt };
};

/**
 * Applies PatternFly contrast mode and felt classes on <html>.
 * High contrast disables glass (never both active). Felt stacks with any contrast mode.
 * Do not call this when isParentOwnedTheme() is true.
 */
export const applyDocumentContrastMode = (contrastMode: ContrastMode, themeFelt: boolean): void => {
  const glass = contrastMode === ContrastMode.GLASS;
  const highContrast = contrastMode === ContrastMode.HIGH_CONTRAST;

  document.documentElement.classList.toggle(PF_THEME_FELT, themeFelt);
  document.documentElement.classList.toggle(PF_THEME_GLASS, glass);
  document.documentElement.classList.toggle(PF_THEME_HIGH_CONTRAST, highContrast);
};

/**
 * Applies PatternFly light/dark and optional contrast/felt classes on <html>.
 * Do not call this when isParentOwnedTheme() is true (OSSMC / OpenShift Console owns classes).
 */
export const applyDocumentTheme = (theme: Theme, contrastMode?: ContrastMode, themeFelt?: boolean): void => {
  document.documentElement.classList.toggle(PF_THEME_DARK, theme === Theme.DARK);

  if (contrastMode !== undefined) {
    applyDocumentContrastMode(contrastMode, themeFelt ?? false);
  } else if (themeFelt !== undefined) {
    document.documentElement.classList.toggle(PF_THEME_FELT, themeFelt);
  }
};

/**
 * Watch <html> class changes (OpenShift Console theme switcher) and invoke callback.
 * Returns an unsubscribe function.
 */
export const observeDocumentTheme = (onChange: () => void): (() => void) => {
  const root = document.documentElement;
  let lastClasses = readDocumentThemeClasses();
  let lastTheme = readDocumentTheme();

  const notifyIfChanged = (): void => {
    const theme = readDocumentTheme();
    const classes = readDocumentThemeClasses();

    if (
      theme !== lastTheme ||
      classes.contrastMode !== lastClasses.contrastMode ||
      classes.themeFelt !== lastClasses.themeFelt
    ) {
      lastTheme = theme;
      lastClasses = classes;
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

const getDefaultContrastMode = (): ContrastMode => {
  if (window.matchMedia?.('(prefers-contrast: more)').matches) {
    return ContrastMode.HIGH_CONTRAST;
  }

  return ContrastMode.TRADITIONAL;
};
