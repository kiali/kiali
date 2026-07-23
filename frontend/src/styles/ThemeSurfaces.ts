import type { NestedCSSProperties } from 'typestyle/lib/types';
import { PFColors } from 'components/Pf/PfColors';
import { PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST } from 'types/Common';

/**
 * Nested selectors for Kiali surfaces that must adapt under PatternFly glass
 * and high-contrast modes. Use inside kialiStyle({ ...base, $nest: glassHighContrastSurfaceNest() }).
 *
 * Glass: translucent fill + blur so PF background imagery can show through.
 * High contrast: solid fill, no soft shadows, stronger border (glass is disabled).
 */
export const glassHighContrastSurfaceNest = (overrides?: {
  glass?: NestedCSSProperties;
  highContrast?: NestedCSSProperties;
}): NestedCSSProperties['$nest'] => ({
  [`html.${PF_THEME_GLASS} &`]: {
    backgroundColor: PFColors.BackgroundColorGlass,
    backdropFilter: 'blur(var(--pf-t--global--background--filter--glass--default))',
    borderColor: 'var(--pf-t--global--border--color--glass--default)',
    boxShadow: 'var(--pf-t--global--box-shadow--glass--default)',
    ...overrides?.glass
  },
  [`html.${PF_THEME_HIGH_CONTRAST} &`]: {
    backgroundColor: PFColors.BackgroundColor100,
    backdropFilter: 'none',
    boxShadow: 'none',
    border: `1px solid ${PFColors.BorderDefault}`,
    ...overrides?.highContrast
  }
});

/** Soft panel shadows that should disappear under high contrast. */
export const highContrastNoShadowNest = (): NestedCSSProperties['$nest'] => ({
  [`html.${PF_THEME_HIGH_CONTRAST} &`]: {
    boxShadow: 'none',
    '-webkit-box-shadow': 'none',
    border: `1px solid ${PFColors.BorderDefault}`
  }
});
