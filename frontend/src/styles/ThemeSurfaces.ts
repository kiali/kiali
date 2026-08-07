import type { NestedCSSProperties } from 'typestyle/lib/types';
import { PFColors } from 'components/Pf/PfColors';
import { PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST } from 'types/Common';

/**
 * Nested selectors for Kiali surfaces under OpenShift contrast modes (glass / high-contrast).
 * Use inside kialiStyle({ ...base, $nest: contrastSurfaceNest() }).
 *
 * Glass (OSSMC/OCP 5.0): keep an opaque primary fill. PatternFly forbids glass-on-glass
 * layering; dense Kiali UI (tables, legends, detail panels) must stay readable over the
 * Console's page glass background.
 * High contrast: solid fill, no soft shadows, stronger border (glass is disabled).
 */
export const contrastSurfaceNest = (overrides?: {
  contrast?: NestedCSSProperties;
  glass?: NestedCSSProperties;
}): NestedCSSProperties['$nest'] => ({
  [`html.${PF_THEME_GLASS} &`]: {
    backgroundColor: PFColors.BackgroundColor100,
    backdropFilter: 'none',
    borderColor: 'var(--pf-t--global--border--color--glass--default)',
    boxShadow: 'var(--pf-t--global--box-shadow--glass--default)',
    ...overrides?.glass
  },
  [`html.${PF_THEME_HIGH_CONTRAST} &`]: {
    backgroundColor: PFColors.BackgroundColor100,
    backdropFilter: 'none',
    boxShadow: 'none',
    border: `1px solid ${PFColors.BorderDefault}`,
    ...overrides?.contrast
  }
});

/** Soft panel shadows that should disappear under high contrast. */
export const contrastNoShadowNest = (): NestedCSSProperties['$nest'] => ({
  [`html.${PF_THEME_HIGH_CONTRAST} &`]: {
    boxShadow: 'none',
    '-webkit-box-shadow': 'none',
    border: `1px solid ${PFColors.BorderDefault}`
  }
});
