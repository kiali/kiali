import { useKialiSelector } from 'hooks/redux';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';
import { isParentKiosk } from 'components/Kiosk/KioskActions';
import {
  ColorScheme,
  ContrastMode,
  KIALI_COLOR_SCHEME,
  KIALI_CONTRAST_MODE,
  KIALI_THEME,
  PF_THEME_DARK,
  PF_THEME_FELT,
  PF_THEME_GLASS,
  PF_THEME_HIGH_CONTRAST,
  Theme
} from 'types/Common';

export type DocumentThemeClasses = {
  contrastMode: ContrastMode;
  theme: Theme;
};

const LEGACY_COLOR_SCHEME_SYSTEM = 'System';

const LEGACY_CONTRAST_MODE_VALUES: Record<string, ContrastMode> = {
  Glass: ContrastMode.GLASS,
  'High contrast': ContrastMode.HIGH_CONTRAST,
  Traditional: ContrastMode.DEFAULT
};

const isValidColorScheme = (colorScheme: string | null | undefined): colorScheme is ColorScheme => {
  return colorScheme === ColorScheme.LIGHT || colorScheme === ColorScheme.DARK;
};

const isValidContrastMode = (contrastMode: string | null | undefined): contrastMode is ContrastMode => {
  return (
    contrastMode === ContrastMode.DEFAULT ||
    contrastMode === ContrastMode.GLASS ||
    contrastMode === ContrastMode.HIGH_CONTRAST
  );
};

const isValidTheme = (theme: string | null | undefined): theme is Theme => {
  return theme === Theme.DEFAULT || theme === Theme.FELT;
};

const migrateLegacyAppearanceStorage = (): void => {
  const legacyTheme = localStorage.getItem(KIALI_THEME);

  if (legacyTheme === ColorScheme.LIGHT || legacyTheme === ColorScheme.DARK) {
    if (!localStorage.getItem(KIALI_COLOR_SCHEME)) {
      localStorage.setItem(KIALI_COLOR_SCHEME, legacyTheme);
    }
    localStorage.removeItem(KIALI_THEME);
  } else if (legacyTheme === LEGACY_COLOR_SCHEME_SYSTEM) {
    localStorage.removeItem(KIALI_THEME);
  }

  const legacyContrast = localStorage.getItem(KIALI_CONTRAST_MODE);
  const migratedContrast = legacyContrast ? LEGACY_CONTRAST_MODE_VALUES[legacyContrast] : undefined;

  if (migratedContrast) {
    localStorage.setItem(KIALI_CONTRAST_MODE, migratedContrast);
  }
};

migrateLegacyAppearanceStorage();

/**
 * True when an embedder (e.g. OSSMC) shares this window and owns theme classes on <html>.
 * Uses the live URL kiosk param when present; otherwise sessionStorage from the initial
 * OSSMC load (SPA navigations drop the param). Cleared on full page loads without a parent
 * kiosk URL so a prior OSSMC visit cannot block standalone theme control in the same tab.
 */
export const PARENT_KIOSK_SESSION_KEY = 'KIALI_PARENT_KIOSK';

export const clearStaleParentKioskSession = (): void => {
  const urlKiosk = new URLSearchParams(window.location.search).get('kiosk') ?? '';

  if (!isParentKiosk(urlKiosk)) {
    sessionStorage.removeItem(PARENT_KIOSK_SESSION_KEY);
  }
};

clearStaleParentKioskSession();

const getStoredColorScheme = (): ColorScheme | undefined => {
  migrateLegacyAppearanceStorage();
  const stored = localStorage.getItem(KIALI_COLOR_SCHEME) as ColorScheme | null;

  return isValidColorScheme(stored) ? stored : undefined;
};

const getStoredContrastMode = (): ContrastMode | undefined => {
  migrateLegacyAppearanceStorage();
  const stored = localStorage.getItem(KIALI_CONTRAST_MODE);

  if (isValidContrastMode(stored)) {
    return stored;
  }

  return stored ? LEGACY_CONTRAST_MODE_VALUES[stored] : undefined;
};

const getStoredTheme = (): Theme | undefined => {
  migrateLegacyAppearanceStorage();
  const stored = localStorage.getItem(KIALI_THEME);

  return isValidTheme(stored) ? stored : undefined;
};

export const getKialiColorScheme = (): ColorScheme => {
  const stored = getStoredColorScheme() || (store.getState().globalState.colorScheme as ColorScheme) || undefined;

  if (isValidColorScheme(stored)) {
    return stored;
  }

  return getDefaultColorScheme();
};

export const getKialiContrastMode = (): ContrastMode => {
  const stored = getStoredContrastMode() || (store.getState().globalState.contrastMode as ContrastMode) || undefined;

  if (isValidContrastMode(stored)) {
    return stored;
  }

  return getDefaultContrastMode();
};

export const getKialiTheme = (): Theme => {
  const stored = getStoredTheme() || (store.getState().globalState.theme as Theme) || undefined;

  if (isValidTheme(stored)) {
    return stored;
  }

  return Theme.DEFAULT;
};

export const isFeltTheme = (theme: Theme): boolean => {
  return theme === Theme.FELT;
};

export const useKialiColorScheme = (): string => {
  const reduxColorScheme = useKialiSelector(state => state.globalState.colorScheme);

  if (isValidColorScheme(reduxColorScheme)) {
    return reduxColorScheme;
  }

  return getKialiColorScheme();
};

export const useKialiContrastMode = (): string => {
  const reduxContrastMode = useKialiSelector(state => state.globalState.contrastMode);

  if (isValidContrastMode(reduxContrastMode)) {
    return reduxContrastMode;
  }

  return getKialiContrastMode();
};

export const useKialiTheme = (): string => {
  const reduxTheme = useKialiSelector(state => state.globalState.theme);

  if (isValidTheme(reduxTheme)) {
    return reduxTheme;
  }

  return getKialiTheme();
};

/** Read color scheme from PatternFly classes on <html> (set by OpenShift Console in OSSMC). */
export const readDocumentColorScheme = (): ColorScheme => {
  return document.documentElement.classList.contains(PF_THEME_DARK) ? ColorScheme.DARK : ColorScheme.LIGHT;
};

/** Read theme from PatternFly classes on <html>. */
export const readDocumentTheme = (): Theme => {
  return document.documentElement.classList.contains(PF_THEME_FELT) ? Theme.FELT : Theme.DEFAULT;
};

/** Read contrast mode from PatternFly classes on <html> (set by OpenShift Console in OSSMC). */
export const readDocumentContrastMode = (): ContrastMode => {
  if (document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)) {
    return ContrastMode.HIGH_CONTRAST;
  }

  if (document.documentElement.classList.contains(PF_THEME_GLASS)) {
    return ContrastMode.GLASS;
  }

  return ContrastMode.DEFAULT;
};

export const readDocumentThemeClasses = (): DocumentThemeClasses => {
  return {
    contrastMode: readDocumentContrastMode(),
    theme: readDocumentTheme()
  };
};

export const persistKialiThemePreferences = (
  colorScheme: ColorScheme,
  contrastMode: ContrastMode,
  theme: Theme
): void => {
  localStorage.setItem(KIALI_COLOR_SCHEME, colorScheme);
  localStorage.setItem(KIALI_CONTRAST_MODE, contrastMode);
  localStorage.setItem(KIALI_THEME, theme);
};

export const isParentOwnedTheme = (): boolean => {
  if (window.top !== window.self) {
    return false;
  }

  const urlKiosk = new URLSearchParams(window.location.search).get('kiosk') ?? '';

  if (isParentKiosk(urlKiosk)) {
    sessionStorage.setItem(PARENT_KIOSK_SESSION_KEY, urlKiosk);
    return true;
  }

  const sessionKiosk = sessionStorage.getItem(PARENT_KIOSK_SESSION_KEY) ?? '';
  return isParentKiosk(sessionKiosk);
};

/** Update Redux from current <html> theme classes without modifying the document. */
export const syncReduxThemeFromDocument = (): DocumentThemeClasses & { colorScheme: ColorScheme } => {
  const colorScheme = readDocumentColorScheme();
  const { contrastMode, theme } = readDocumentThemeClasses();
  store.dispatch(GlobalActions.setColorScheme(colorScheme));
  store.dispatch(GlobalActions.setContrastMode(contrastMode));
  store.dispatch(GlobalActions.setTheme(theme));
  persistKialiThemePreferences(colorScheme, contrastMode, theme);

  return { colorScheme, contrastMode, theme };
};

/**
 * Applies PatternFly contrast mode and theme classes on <html>.
 * High contrast disables glass (never both active). Felt stacks with any contrast mode.
 * Do not call this when isParentOwnedTheme() is true.
 */
export const applyDocumentContrastMode = (contrastMode: ContrastMode, theme: Theme): void => {
  const glass = contrastMode === ContrastMode.GLASS;
  const highContrast = contrastMode === ContrastMode.HIGH_CONTRAST;

  document.documentElement.classList.toggle(PF_THEME_FELT, isFeltTheme(theme));
  document.documentElement.classList.toggle(PF_THEME_GLASS, glass);
  document.documentElement.classList.toggle(PF_THEME_HIGH_CONTRAST, highContrast);
};

/**
 * Applies PatternFly light/dark, contrast mode, and theme classes on <html>.
 * Do not call this when isParentOwnedTheme() is true (OSSMC / OpenShift Console owns classes).
 */
export const applyDocumentTheme = (colorScheme: ColorScheme, contrastMode: ContrastMode, theme: Theme): void => {
  document.documentElement.classList.toggle(PF_THEME_DARK, colorScheme === ColorScheme.DARK);
  applyDocumentContrastMode(contrastMode, theme);
};

/**
 * Watch <html> class changes (OpenShift Console theme switcher) and invoke callback.
 * Returns an unsubscribe function.
 */
export const observeDocumentTheme = (onChange: () => void): (() => void) => {
  const root = document.documentElement;
  let lastClasses = readDocumentThemeClasses();
  let lastColorScheme = readDocumentColorScheme();

  const notifyIfChanged = (): void => {
    const colorScheme = readDocumentColorScheme();
    const classes = readDocumentThemeClasses();

    if (
      colorScheme !== lastColorScheme ||
      classes.contrastMode !== lastClasses.contrastMode ||
      classes.theme !== lastClasses.theme
    ) {
      lastColorScheme = colorScheme;
      lastClasses = classes;
      onChange();
    }
  };

  const observer = new MutationObserver(notifyIfChanged);
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });

  return () => observer.disconnect();
};

const getDefaultColorScheme = (): ColorScheme => {
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return ColorScheme.DARK;
  }

  return ColorScheme.LIGHT;
};

const getDefaultContrastMode = (): ContrastMode => {
  return ContrastMode.DEFAULT;
};
