import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferencesModalComponent } from '../Masthead/PreferencesModal';
import {
  ColorScheme,
  ContrastMode,
  KIALI_COLOR_SCHEME,
  KIALI_CONTRAST_MODE,
  KIALI_THEME,
  Language,
  PF_THEME_DARK,
  PF_THEME_FELT,
  PF_THEME_GLASS,
  PF_THEME_HIGH_CONTRAST,
  Theme
} from 'types/Common';
import { serverConfig, setServerConfig } from 'config/ServerConfig';
import { store } from 'store/ConfigStore';
import { GlobalActions } from 'actions/GlobalActions';

const preferencesServerConfig = Object.assign({}, serverConfig);

const resetAppearanceState = (): void => {
  document.documentElement.className = '';
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  store.dispatch(GlobalActions.setColorScheme(ColorScheme.LIGHT));
  store.dispatch(GlobalActions.setContrastMode(ContrastMode.DEFAULT));
  store.dispatch(GlobalActions.setTheme(Theme.DEFAULT));
  store.dispatch(GlobalActions.setKiosk(''));
};

const renderPreferences = (
  props: Partial<React.ComponentProps<typeof PreferencesModalComponent>> = {}
): ReturnType<typeof render> => {
  return render(
    <PreferencesModalComponent
      colorScheme={ColorScheme.LIGHT}
      contrastMode={ContrastMode.DEFAULT}
      isOpen={true}
      language={Language.ENGLISH}
      onClose={() => {}}
      theme={Theme.DEFAULT}
      {...props}
    />
  );
};

const selectPreferenceOption = async (selectId: string, optionLabel: string): Promise<void> => {
  await userEvent.click(screen.getByTestId(selectId));
  await userEvent.click(screen.getByRole('option', { name: new RegExp(`^${optionLabel}`) }));
  await waitFor(() => {
    expect(screen.getByTestId(selectId)).toHaveAttribute('aria-expanded', 'false');
  });
};

describe('PreferencesModal renders', () => {
  beforeEach(() => {
    resetAppearanceState();
  });

  it('shows preferences title', () => {
    renderPreferences();

    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();
    expect(screen.getByTestId('preferences-modal')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderPreferences({ isOpen: false });

    expect(screen.queryByTestId('preferences-modal')).not.toBeInTheDocument();
  });
});

describe('PreferencesModal changes', () => {
  beforeEach(() => {
    resetAppearanceState();
  });

  it('to dark color scheme', async () => {
    renderPreferences();

    await selectPreferenceOption('color-scheme-select', 'Dark');

    await waitFor(() => {
      expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
      expect(store.getState().globalState.colorScheme).toBe(ColorScheme.DARK);
      expect(localStorage.getItem(KIALI_COLOR_SCHEME)).toBe(ColorScheme.DARK);
    });
  });

  it('to light color scheme', async () => {
    renderPreferences({ colorScheme: ColorScheme.DARK });

    await selectPreferenceOption('color-scheme-select', 'Light');

    await waitFor(() => {
      expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(false);
      expect(store.getState().globalState.colorScheme).toBe(ColorScheme.LIGHT);
      expect(localStorage.getItem(KIALI_COLOR_SCHEME)).toBe(ColorScheme.LIGHT);
    });
  });

  it('to glass contrast mode', async () => {
    renderPreferences();

    await selectPreferenceOption('contrast-mode-select', 'Glass');

    await waitFor(() => {
      expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
      expect(store.getState().globalState.contrastMode).toBe(ContrastMode.GLASS);
    });
  });

  it('to default contrast mode', async () => {
    renderPreferences({ contrastMode: ContrastMode.GLASS });

    await selectPreferenceOption('contrast-mode-select', 'Default');

    await waitFor(() => {
      expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
      expect(store.getState().globalState.contrastMode).toBe(ContrastMode.DEFAULT);
      expect(localStorage.getItem(KIALI_CONTRAST_MODE)).toBe(ContrastMode.DEFAULT);
    });
  });

  it('to felt with glass contrast mode', async () => {
    renderPreferences({ contrastMode: ContrastMode.GLASS });

    await selectPreferenceOption('theme-select', 'Project Felt');

    await waitFor(() => {
      expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(true);
      expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(true);
      expect(store.getState().globalState.theme).toBe(Theme.FELT);
      expect(localStorage.getItem(KIALI_THEME)).toBe(Theme.FELT);
    });
  });

  it('off felt theme', async () => {
    renderPreferences({ contrastMode: ContrastMode.GLASS, theme: Theme.FELT });

    await selectPreferenceOption('theme-select', 'Default');

    await waitFor(() => {
      expect(document.documentElement.classList.contains(PF_THEME_FELT)).toBe(false);
      expect(store.getState().globalState.theme).toBe(Theme.DEFAULT);
      expect(localStorage.getItem(KIALI_THEME)).toBe(Theme.DEFAULT);
    });
  });

  it('to high contrast mode', async () => {
    renderPreferences({ contrastMode: ContrastMode.GLASS });

    await selectPreferenceOption('contrast-mode-select', 'High contrast');

    await waitFor(() => {
      expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
      expect(document.documentElement.classList.contains(PF_THEME_GLASS)).toBe(false);
      expect(store.getState().globalState.contrastMode).toBe(ContrastMode.HIGH_CONTRAST);
      expect(localStorage.getItem(KIALI_CONTRAST_MODE)).toBe(ContrastMode.HIGH_CONTRAST);
    });
  });

  it('to system color scheme', async () => {
    window.matchMedia = rstest.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    renderPreferences({ colorScheme: ColorScheme.LIGHT });

    await selectPreferenceOption('color-scheme-select', 'System');

    await waitFor(() => {
      expect(document.documentElement.classList.contains(PF_THEME_DARK)).toBe(true);
      expect(store.getState().globalState.colorScheme).toBe(ColorScheme.SYSTEM);
      expect(localStorage.getItem(KIALI_COLOR_SCHEME)).toBe(ColorScheme.SYSTEM);
    });
  });

  it('to system contrast mode', async () => {
    window.matchMedia = rstest.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-contrast: more)',
      addEventListener: rstest.fn(),
      removeEventListener: rstest.fn()
    })) as typeof window.matchMedia;
    renderPreferences({ contrastMode: ContrastMode.DEFAULT });

    await selectPreferenceOption('contrast-mode-select', 'System');

    await waitFor(() => {
      expect(document.documentElement.classList.contains(PF_THEME_HIGH_CONTRAST)).toBe(true);
      expect(store.getState().globalState.contrastMode).toBe(ContrastMode.SYSTEM);
      expect(localStorage.getItem(KIALI_CONTRAST_MODE)).toBe(ContrastMode.SYSTEM);
    });
  });
});

describe('PreferencesModal language', () => {
  beforeAll(() => {
    setServerConfig({
      ...preferencesServerConfig,
      kialiFeatureFlags: {
        ...preferencesServerConfig.kialiFeatureFlags,
        uiDefaults: {
          ...preferencesServerConfig.kialiFeatureFlags.uiDefaults,
          i18n: {
            ...preferencesServerConfig.kialiFeatureFlags.uiDefaults.i18n,
            showSelector: true
          }
        }
      }
    });
  });

  beforeEach(() => {
    resetAppearanceState();
    store.dispatch(GlobalActions.setLanguage(Language.ENGLISH));
  });

  it('hides language selector when showSelector is false', () => {
    setServerConfig({
      ...preferencesServerConfig,
      kialiFeatureFlags: {
        ...preferencesServerConfig.kialiFeatureFlags,
        uiDefaults: {
          ...preferencesServerConfig.kialiFeatureFlags.uiDefaults,
          i18n: {
            ...preferencesServerConfig.kialiFeatureFlags.uiDefaults.i18n,
            showSelector: false
          }
        }
      }
    });
    renderPreferences();

    expect(screen.queryByTestId('language-select')).not.toBeInTheDocument();

    setServerConfig({
      ...preferencesServerConfig,
      kialiFeatureFlags: {
        ...preferencesServerConfig.kialiFeatureFlags,
        uiDefaults: {
          ...preferencesServerConfig.kialiFeatureFlags.uiDefaults,
          i18n: {
            ...preferencesServerConfig.kialiFeatureFlags.uiDefaults.i18n,
            showSelector: true
          }
        }
      }
    });
  });

  it('changes to spanish language', async () => {
    renderPreferences();

    await selectPreferenceOption('language-select', 'Español');

    await waitFor(() => {
      expect(store.getState().globalState.language).toBe(Language.SPANISH);
    });
  });

  it('changes to chinese language', async () => {
    renderPreferences();

    await selectPreferenceOption('language-select', '中文');

    await waitFor(() => {
      expect(store.getState().globalState.language).toBe(Language.CHINESE);
    });
  });

  it('changes to korean language', async () => {
    renderPreferences();

    await selectPreferenceOption('language-select', '한국어');

    await waitFor(() => {
      expect(store.getState().globalState.language).toBe(Language.KOREAN);
    });
  });

  it('changes to system language', async () => {
    renderPreferences({ language: Language.SPANISH });

    await selectPreferenceOption('language-select', 'System');

    await waitFor(() => {
      expect(store.getState().globalState.language).toBe(Language.SYSTEM);
    });
  });
});
