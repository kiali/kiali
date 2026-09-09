import type { NestedCSSProperties } from 'typestyle/lib/types';

import { PFColors } from 'components/Pf/PfColors';
import { PF_THEME_GLASS, PF_THEME_HIGH_CONTRAST } from 'types/Common';

export type ContrastNestOverrides = {
  glass?: NestedCSSProperties;
  highContrast?: NestedCSSProperties;
};

/**
 * Floating overlays (graph/mesh legends, side panels) under OpenShift contrast modes.
 * Glass: opaque sticky fill + elevation shadow. High contrast: solid fill, no shadow, border.
 * Same-key fields in overrides replace defaults; new keys are added.
 */
export const contrastOverlayNest = (overrides?: ContrastNestOverrides): NestedCSSProperties['$nest'] => ({
  [`html.${PF_THEME_GLASS} &`]: {
    backgroundColor: PFColors.BackgroundColorSticky,
    backdropFilter: 'none',
    boxShadow: 'var(--pf-t--global--box-shadow--glass--default)',
    ...overrides?.glass
  },
  [`html.${PF_THEME_HIGH_CONTRAST} &`]: {
    backgroundColor: PFColors.BackgroundColorSticky,
    backdropFilter: 'none',
    boxShadow: 'none',
    border: `1px solid ${PFColors.BorderDefault}`,
    ...overrides?.highContrast
  }
});

/**
 * In-page content surfaces (RenderContent, header, tabs, toolbars, VirtualList) under
 * contrast modes — as opposed to floating overlays. Glass: transparent so the Console
 * glass page shows through. High contrast: solid sticky, no outer border.
 */
export const contrastContentNest = (overrides?: ContrastNestOverrides): NestedCSSProperties['$nest'] => ({
  [`html.${PF_THEME_GLASS} &`]: {
    backgroundColor: 'transparent',
    backdropFilter: 'none',
    boxShadow: 'none',
    border: 'none',
    ...overrides?.glass
  },
  [`html.${PF_THEME_HIGH_CONTRAST} &`]: {
    backgroundColor: PFColors.BackgroundColorSticky,
    backdropFilter: 'none',
    boxShadow: 'none',
    border: 'none',
    ...overrides?.highContrast
  }
});

/**
 * Soft-shadowed inner panels under high contrast (replace elevation with a border).
 */
export const contrastPanelNest = (): NestedCSSProperties['$nest'] => ({
  [`html.${PF_THEME_HIGH_CONTRAST} &`]: {
    boxShadow: 'none',
    '-webkit-box-shadow': 'none',
    border: `1px solid ${PFColors.BorderDefault}`
  }
});
