import { useKialiSelector } from 'hooks/redux';
import { store } from 'store/ConfigStore';
import { KIALI_THEME, Theme } from 'types/Common';

export const getKialiTheme = (): Theme => {
  return (
    (localStorage.getItem(KIALI_THEME) as Theme) || (store.getState().globalState.theme as Theme) || getDefaultTheme()
  );
};

export const useKialiTheme = (): string => {
  return useKialiSelector(state => state.globalState.theme) || getDefaultTheme();
};

// Get default theme from system settings
const getDefaultTheme = (): Theme => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return Theme.DARK;
  }

  return Theme.LIGHT;
};
