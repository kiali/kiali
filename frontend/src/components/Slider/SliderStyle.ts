import type * as React from 'react';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

const railTrackFillVar = (color: string): React.CSSProperties =>
  ({
    '--pf-v6-c-slider__rail-track--before--fill--BackgroundColor': color
  }) as React.CSSProperties;

export const sliderStyle = (maxWidth?: string, railTrackFill?: string): string =>
  kialiStyle({
    alignItems: 'center',
    display: 'flex',
    flex: '1 1 100%',
    width: '100%',
    $nest: {
      '& .pf-v6-c-slider': {
        flex: '1 1 auto',
        minWidth: 0,
        width: '100%',
        ...(railTrackFill ? railTrackFillVar(railTrackFill) : {})
      },

      // Match legacy bootstrap-slider layout: cap rail width only, not the % input / action buttons.
      '& .pf-v6-c-slider__main': {
        flex: '1 1 auto',
        maxWidth: maxWidth,
        minWidth: '4rem'
      }
    }
  });

export const sliderMirroredStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-slider__thumb': {
      backgroundColor: PFColors.Purple20
    },

    '& .pf-v6-c-slider': railTrackFillVar(PFColors.Purple20)
  }
});
