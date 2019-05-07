export const isKioskMode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('kiosk') === 'true';
};

export const getFocusSelector = () => {
  return new URLSearchParams(window.location.search).get('focusSelector') || undefined;
};
