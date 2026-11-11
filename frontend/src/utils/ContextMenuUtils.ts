/**
 * Dismiss an open topology graph context menu when Menu onSelect does not run because
 * menu chrome and items resolved different @patternfly/react-core instances (e.g. OSSMC
 * console federation). Topology Popper registers Escape with capture when the menu is open.
 */
export const dismissContextMenu = (): void => {
  requestAnimationFrame(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
};
