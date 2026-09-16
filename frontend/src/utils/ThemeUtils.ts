import { useKialiSelector } from 'hooks/redux';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';
import { isParentKiosk } from 'components/Kiosk/KioskActions';
import {
  ContrastMode,
  KIALI_COLOR_SCHEME,
  KIALI_CONTRAST_MODE,
  KIALI_THEME,
  PF_THEME_DARK,
  PF_THEME_FELT,
  PF_THEME_GLASS,
  PF_THEME_HIGH_CONTRAST,
  Theme,
  ThemeVariant
} from 'types/Common';

export type DocumentThemeClasses = {
  contrastMode: ContrastMode;
  theme: ThemeVariant;
};

const LEGACY_COLOR_SCHEME_SYSTEM = 'System';

const isValidColorScheme = (colorScheme: string | null | undefined): colorScheme is Theme => {
  return colorScheme === Theme.LIGHT || colorScheme === Theme.DARK;
};

const isValidContrastMode = (contrastMode: string | null | undefined): contrastMode is ContrastMode => {
  return (
    contrastMode === ContrastMode.TRADITIONAL ||
    contrastMode === ContrastMode.GLASS ||
    contrastMode === ContrastMode.HIGH_CONTRAST
  );
};

const isValidThemeVariant = (theme: string | null | undefined): theme is ThemeVariant => {
  return theme === ThemeVariant.DEFAULT || theme === ThemeVariant.FELT;
};

const migrateLegacyAppearanceStorage = (): void => {
  const legacyTheme = localStorage.getItem(KIALI_THEME);

  if (legacyTheme === Theme.LIGHT || legacyTheme === Theme.DARK) {
    if (!localStorage.getItem(KIALI_COLOR_SCHEME)) {
      localStorage.setItem(KIALI_COLOR_SCHEME, legacyTheme);
    }
    localStorage.removeItem(KIALI_THEME);
  } else if (legacyTheme === LEGACY_COLOR_SCHEME_SYSTEM) {
    localStorage.removeItem(KIALI_THEME);
  }
};

migrateLegacyAppearanceStorage();

const getStoredColorScheme = (): Theme | undefined => {
  migrateLegacyAppearanceStorage();
  const stored = localStorage.getItem(KIALI_COLOR_SCHEME) as Theme | null;

  return isValidColorScheme(stored) ? stored : undefined;
};

const getStoredTheme = (): ThemeVariant | undefined => {
  migrateLegacyAppearanceStorage();
  const stored = localStorage.getItem(KIALI_THEME);

  return isValidThemeVariant(stored) ? stored : undefined;
};

export const getKialiColorScheme = (): Theme => {
  const stored = getStoredColorScheme() || (store.getState().globalState.colorScheme as Theme) || undefined;

  if (isValidColorScheme(stored)) {
    return stored;
  }

  return getDefaultColorScheme();
};

export const getKialiContrastMode = (): ContrastMode => {
  const stored =
    (localStorage.getItem(KIALI_CONTRAST_MODE) as ContrastMode) ||
    (store.getState().globalState.contrastMode as ContrastMode) ||
    undefined;

  if (isValidContrastMode(stored)) {
    return stored;
  }

  return getDefaultContrastMode();
};

export const getKialiTheme = (): ThemeVariant => {
  const stored = getStoredTheme() || (store.getState().globalState.theme as ThemeVariant) || undefined;

  if (isValidThemeVariant(stored)) {
    return stored;
  }

  return ThemeVariant.DEFAULT;
};

export const isFeltTheme = (theme: ThemeVariant): boolean => {
  return theme === ThemeVariant.FELT;
};

export const useKialiColorScheme = (): string => {
  return useKialiSelector(state => state.globalState.colorScheme) || getDefaultColorScheme();
};

export const useKialiContrastMode = (): string => {
  return useKialiSelector(state => state.globalState.contrastMode) || getDefaultContrastMode();
};

export const useKialiTheme = (): string => {
  return useKialiSelector(state => state.globalState.theme) || ThemeVariant.DEFAULT;
};

/** Read color scheme from PatternFly classes on <html> (set by OpenShift Console in OSSMC). */
export const readDocumentTheme = (): Theme => {
  return document.documentElement.classList.contains(PF_THEME_DARK) ? Theme.DARK : Theme.LIGHT;
};

/** Read theme variant from PatternFly classes on <html>. */
export const readDocumentThemeVariant = (): ThemeVariant => {
  return document.documentElement.classList.contains(PF_THEME_FELT) ? ThemeVariant.FELT : ThemeVariant.DEFAULT;
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
    theme: readDocumentThemeVariant()
  };
};

/**
 * True when an embedder (e.g. OSSMC) shares this window and owns theme classes on <html>.
 * In that case Kiali must sync Redux from the document and must not overwrite classes
 * (including glass / high-contrast classes applied by OCP Console).
 */
const PARENT_KIOSK_SESSION_KEY = 'KIALI_PARENT_KIOSK';

export const persistKialiThemePreferences = (
  colorScheme: Theme,
  contrastMode: ContrastMode,
  theme: ThemeVariant
): void => {
  localStorage.setItem(KIALI_COLOR_SCHEME, colorScheme);
  localStorage.setItem(KIALI_CONTRAST_MODE, contrastMode);
  localStorage.setItem(KIALI_THEME, theme);
};

/**
 * True when an embedder (e.g. OSSMC) shares this window and owns theme classes on <html>.
 * Uses the live URL kiosk param when present; otherwise sessionStorage from the initial
 * OSSMC load (SPA navigations drop the param). Does not use redux-persist alone, so a
 * prior OSSMC session cannot make standalone Kiali think the parent owns the theme.
 */
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
export const syncReduxThemeFromDocument = (): DocumentThemeClasses & { colorScheme: Theme } => {
  const colorScheme = readDocumentTheme();
  const { contrastMode, theme } = readDocumentThemeClasses();
  store.dispatch(GlobalActions.setColorScheme(colorScheme));
  store.dispatch(GlobalActions.setContrastMode(contrastMode));
  store.dispatch(GlobalActions.setTheme(theme));
  persistKialiThemePreferences(colorScheme, contrastMode, theme);

  return { colorScheme, contrastMode, theme };
};

/**
 * Applies PatternFly contrast mode and theme variant classes on <html>.
 * High contrast disables glass (never both active). Felt stacks with any contrast mode.
 * Do not call this when isParentOwnedTheme() is true.
 */
export const applyDocumentContrastMode = (contrastMode: ContrastMode, theme: ThemeVariant): void => {
  const glass = contrastMode === ContrastMode.GLASS;
  const highContrast = contrastMode === ContrastMode.HIGH_CONTRAST;

  document.documentElement.classList.toggle(PF_THEME_FELT, isFeltTheme(theme));
  document.documentElement.classList.toggle(PF_THEME_GLASS, glass);
  document.documentElement.classList.toggle(PF_THEME_HIGH_CONTRAST, highContrast);
};

/**
 * Applies PatternFly light/dark and optional contrast/theme classes on <html>.
 * Do not call this when isParentOwnedTheme() is true (OSSMC / OpenShift Console owns classes).
 */
export const applyDocumentTheme = (colorScheme: Theme, contrastMode?: ContrastMode, theme?: ThemeVariant): void => {
  document.documentElement.classList.toggle(PF_THEME_DARK, colorScheme === Theme.DARK);

  if (contrastMode !== undefined) {
    applyDocumentContrastMode(contrastMode, theme ?? ThemeVariant.DEFAULT);
  } else if (theme !== undefined) {
    document.documentElement.classList.toggle(PF_THEME_FELT, isFeltTheme(theme));
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
    const colorScheme = readDocumentTheme();
    const classes = readDocumentThemeClasses();

    if (
      colorScheme !== lastTheme ||
      classes.contrastMode !== lastClasses.contrastMode ||
      classes.theme !== lastClasses.theme
    ) {
      lastTheme = colorScheme;
      lastClasses = classes;
      onChange();
    }
  };

  const observer = new MutationObserver(notifyIfChanged);
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });

  return () => observer.disconnect();
};

const getDefaultColorScheme = (): Theme => {
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
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
