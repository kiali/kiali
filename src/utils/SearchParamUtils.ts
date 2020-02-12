import { HistoryManager, URLParam } from '../app/History';

export const isKioskMode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('kiosk') === 'true';
};

export const getFocusSelector = () => {
  return new URLSearchParams(window.location.search).get(URLParam.FOCUS_SELECTOR) || undefined;
};

export const unsetFocusSelector = () => {
  HistoryManager.deleteParam(URLParam.FOCUS_SELECTOR, true);
};
