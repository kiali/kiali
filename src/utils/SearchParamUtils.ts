export const isKioskMode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('kiosk') === 'true';
};
