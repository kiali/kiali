const escapeCssAttrValue = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * In OSSMC kiosk mode, KialiLink renders <button data-href> instead of <a href>.
 * This selector matches both so tests work in standalone Kiali and OSSMC.
 */
export const linkSelector = (hrefPattern?: string, match: 'contains' | 'endsWith' | 'exact' = 'contains'): string => {
  if (!hrefPattern) {
    return 'a, button[data-href]';
  }
  const escaped = escapeCssAttrValue(hrefPattern);
  const op = match === 'exact' ? '' : match === 'endsWith' ? '$' : '*';
  return `a[href${op}="${escaped}"], button[data-href${op}="${escaped}"]`;
};
