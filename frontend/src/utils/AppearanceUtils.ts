import * as React from 'react';
import { useKialiSelector } from 'hooks/redux';
import { store } from 'store/ConfigStore';
import type { KialiAppState } from 'store/Store';
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

export type DocumentAppearanceClasses = {
  contrastMode: ContrastMode;
  theme: Theme;
};

export type ResolvedColorScheme = ColorScheme.LIGHT | ColorScheme.DARK;
export type ResolvedContrastMode = ContrastMode.DEFAULT | ContrastMode.GLASS | ContrastMode.HIGH_CONTRAST;

export const isColorScheme = (colorScheme: string | null | undefined): colorScheme is ColorScheme => {
  return colorScheme === ColorScheme.LIGHT || colorScheme === ColorScheme.DARK || colorScheme === ColorScheme.SYSTEM;
};

export const isContrastMode = (contrastMode: string | null | undefined): contrastMode is ContrastMode => {
  return (
    contrastMode === ContrastMode.DEFAULT ||
    contrastMode === ContrastMode.GLASS ||
    contrastMode === ContrastMode.HIGH_CONTRAST ||
    contrastMode === ContrastMode.SYSTEM
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
  }
};

migrateLegacyAppearanceStorage();

/**
 * True when an embedder (e.g. OSSMC) shares this window and owns appearance classes on <html>.
 * Uses the live URL kiosk param when present; otherwise sessionStorage from the initial
 * OSSMC load (SPA navigations drop the param). Cleared on full page loads without a parent
 * kiosk URL so a prior OSSMC visit cannot block standalone appearance control in the same tab.
 */
export const PARENT_KIOSK_SESSION_KEY = 'KIALI_PARENT_KIOSK';

export const clearStaleParentKioskSession = (): void => {
  const urlKiosk = new URLSearchParams(window.location.search).get('kiosk') ?? '';

  if (!isParentKiosk(urlKiosk)) {
    sessionStorage.removeItem(PARENT_KIOSK_SESSION_KEY);
  }
};

clearStaleParentKioskSession();

const getSystemColorScheme = (): ResolvedColorScheme => {
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return ColorScheme.DARK;
  }

  return ColorScheme.LIGHT;
};

const getSystemContrastMode = (): ResolvedContrastMode => {
  if (window.matchMedia?.('(prefers-contrast: more)').matches) {
    return ContrastMode.HIGH_CONTRAST;
  }

  return ContrastMode.DEFAULT;
};

export const resolveColorScheme = (colorScheme: string | null | undefined): ResolvedColorScheme => {
  if (colorScheme === ColorScheme.DARK || colorScheme === ColorScheme.LIGHT) {
    return colorScheme;
  }

  return getSystemColorScheme();
};

export const resolveContrastMode = (contrastMode: string | null | undefined): ResolvedContrastMode => {
  if (
    contrastMode === ContrastMode.DEFAULT ||
    contrastMode === ContrastMode.GLASS ||
    contrastMode === ContrastMode.HIGH_CONTRAST
  ) {
    return contrastMode;
  }

  return getSystemContrastMode();
};

const getStoredColorScheme = (): ColorScheme | undefined => {
  migrateLegacyAppearanceStorage();
  const stored = localStorage.getItem(KIALI_COLOR_SCHEME);

  return isColorScheme(stored) ? stored : undefined;
};

const getStoredContrastMode = (): ContrastMode | undefined => {
  migrateLegacyAppearanceStorage();
  const stored = localStorage.getItem(KIALI_CONTRAST_MODE);

  return isContrastMode(stored) ? stored : undefined;
};

const getStoredTheme = (): Theme | undefined => {
  migrateLegacyAppearanceStorage();
  const stored = localStorage.getItem(KIALI_THEME);

  return isValidTheme(stored) ? stored : undefined;
};

export const getKialiColorScheme = (): ColorScheme => {
  const stored = getStoredColorScheme() || (store.getState().globalState.colorScheme as ColorScheme) || undefined;

  if (isColorScheme(stored)) {
    return stored;
  }

  return ColorScheme.SYSTEM;
};

export const getKialiContrastMode = (): ContrastMode => {
  const stored = getStoredContrastMode() || (store.getState().globalState.contrastMode as ContrastMode) || undefined;

  if (isContrastMode(stored)) {
    return stored;
  }

  return ContrastMode.SYSTEM;
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

export const registerSystemAppearanceListener = (onChange: () => void): (() => void) => {
  if (!window.matchMedia) {
    return () => {};
  }

  const handler = (): void => {
    const colorScheme = getKialiColorScheme();
    const contrastMode = getKialiContrastMode();

    if (colorScheme === ColorScheme.SYSTEM || contrastMode === ContrastMode.SYSTEM) {
      if (!isParentOwnedAppearance()) {
        applyDocumentAppearance(colorScheme, contrastMode, getKialiTheme());
      }
      // Bump revision so legacy connect() consumers re-resolve System preference on OS changes.
      store.dispatch(GlobalActions.systemAppearanceChanged());
      onChange();
    }
  };

  const colorSchemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const contrastMediaQuery = window.matchMedia('(prefers-contrast: more)');
  colorSchemeMediaQuery.addEventListener('change', handler);
  contrastMediaQuery.addEventListener('change', handler);

  return () => {
    colorSchemeMediaQuery.removeEventListener('change', handler);
    contrastMediaQuery.removeEventListener('change', handler);
  };
};

export const useKialiColorScheme = (): ResolvedColorScheme => {
  const preference = useKialiSelector(state => state.globalState.colorScheme);
  const colorScheme = isColorScheme(preference) ? preference : getKialiColorScheme();
  const [resolvedColorScheme, setResolvedColorScheme] = React.useState(() => resolveColorScheme(colorScheme));

  React.useEffect(() => {
    const update = (): void => {
      setResolvedColorScheme(resolveColorScheme(colorScheme));
    };

    update();

    if (colorScheme === ColorScheme.SYSTEM) {
      return registerSystemAppearanceListener(update);
    }

    return undefined;
  }, [colorScheme]);

  return resolvedColorScheme;
};

export const useKialiContrastMode = (): ResolvedContrastMode => {
  const preference = useKialiSelector(state => state.globalState.contrastMode);
  const contrastMode = isContrastMode(preference) ? preference : getKialiContrastMode();
  const [resolvedContrastMode, setResolvedContrastMode] = React.useState(() => resolveContrastMode(contrastMode));

  React.useEffect(() => {
    const update = (): void => {
      setResolvedContrastMode(resolveContrastMode(contrastMode));
    };

    update();

    if (contrastMode === ContrastMode.SYSTEM) {
      return registerSystemAppearanceListener(update);
    }

    return undefined;
  }, [contrastMode]);

  return resolvedContrastMode;
};

export const useKialiTheme = (): string => {
  const reduxTheme = useKialiSelector(state => state.globalState.theme);

  if (isValidTheme(reduxTheme)) {
    return reduxTheme;
  }

  return getKialiTheme();
};

/** Read color scheme from PatternFly classes on <html> (set by OpenShift Console in OSSMC). */
export const readDocumentColorScheme = (): ResolvedColorScheme => {
  return document.documentElement.classList.contains(PF_THEME_DARK) ? ColorScheme.DARK : ColorScheme.LIGHT;
};

/** Read theme from PatternFly classes on <html>. */
export const readDocumentTheme = (): Theme => {
  return document.documentElement.classList.contains(PF_THEME_FELT) ? Theme.FELT : Theme.DEFAULT;
};

/** Read contrast mode from PatternFly classes on <html> (set by OpenShift Console in OSSMC). */
export const readDocumentContrastMode = (): ResolvedContrastMode => {
  if (document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)) {
    return ContrastMode.HIGH_CONTRAST;
  }

  if (document.documentElement.classList.contains(PF_THEME_GLASS)) {
    return ContrastMode.GLASS;
  }

  return ContrastMode.DEFAULT;
};

export const readDocumentAppearanceClasses = (): DocumentAppearanceClasses => {
  return {
    contrastMode: readDocumentContrastMode(),
    theme: readDocumentTheme()
  };
};

export const persistKialiAppearance = (colorScheme: ColorScheme, contrastMode: ContrastMode, theme: Theme): void => {
  localStorage.setItem(KIALI_COLOR_SCHEME, colorScheme);
  localStorage.setItem(KIALI_CONTRAST_MODE, contrastMode);
  localStorage.setItem(KIALI_THEME, theme);
};

export const isParentOwnedAppearance = (): boolean => {
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

/**
 * Update Redux from current <html> appearance classes without modifying the document.
 * Does not persist to localStorage: parent-owned (OSSMC) values must not overwrite
 * standalone preferences loaded on the next full-page visit.
 */
export const syncReduxAppearanceFromDocument = (): DocumentAppearanceClasses & {
  colorScheme: ResolvedColorScheme;
} => {
  const colorScheme = readDocumentColorScheme();
  const { contrastMode, theme } = readDocumentAppearanceClasses();
  store.dispatch(GlobalActions.setColorScheme(colorScheme));
  store.dispatch(GlobalActions.setContrastMode(contrastMode));
  store.dispatch(GlobalActions.setTheme(theme));

  return { colorScheme, contrastMode, theme };
};

/** Redux props for connect() consumers that resolve color scheme at render time. */
export const mapAppearanceFromState = (
  state: KialiAppState
): { colorScheme: string; systemAppearanceRevision: number } => ({
  colorScheme: state.globalState.colorScheme,
  systemAppearanceRevision: state.globalState.systemAppearanceRevision
});

/**
 * Applies PatternFly color scheme, contrast mode, and theme classes on <html>.
 * High contrast and glass are mutually exclusive; felt stacks with any contrast mode.
 * Do not call this when isParentOwnedAppearance() is true (OSSMC / OpenShift Console owns classes).
 */
export const applyDocumentAppearance = (colorScheme: ColorScheme, contrastMode: ContrastMode, theme: Theme): void => {
  const resolvedColorScheme = resolveColorScheme(colorScheme);
  const resolvedContrastMode = resolveContrastMode(contrastMode);
  const glass = resolvedContrastMode === ContrastMode.GLASS;
  const highContrast = resolvedContrastMode === ContrastMode.HIGH_CONTRAST;

  document.documentElement.classList.toggle(PF_THEME_DARK, resolvedColorScheme === ColorScheme.DARK);
  document.documentElement.classList.toggle(PF_THEME_FELT, isFeltTheme(theme));
  document.documentElement.classList.toggle(PF_THEME_GLASS, glass);
  document.documentElement.classList.toggle(PF_THEME_HIGH_CONTRAST, highContrast);
};

/**
 * Watch <html> class changes (OpenShift Console appearance switcher) and invoke callback.
 * Returns an unsubscribe function.
 */
export const observeDocumentAppearance = (onChange: () => void): (() => void) => {
  const root = document.documentElement;
  let lastClasses = readDocumentAppearanceClasses();
  let lastColorScheme = readDocumentColorScheme();

  const notifyIfChanged = (): void => {
    const colorScheme = readDocumentColorScheme();
    const classes = readDocumentAppearanceClasses();

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
