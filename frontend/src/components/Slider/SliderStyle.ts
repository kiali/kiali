import type * as React from 'react';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

export const sliderStyle = (maxWidth?: string): string =>
  kialiStyle({
    alignItems: 'center',
    display: 'flex',
    flex: '1 1 100%',
    width: '100%',
    $nest: {
      '& .pf-v6-c-slider': {
        flex: '1 1 auto',
        minWidth: 0,
        width: '100%'
      },

      // Match legacy bootstrap-slider layout: cap rail width only, not the % input / action buttons.
      '& .pf-v6-c-slider__main': {
        flex: '1 1 auto',
        maxWidth: maxWidth,
        minWidth: '4rem'
      }
    }
  });

const mirroredSliderFill = {
  '--pf-v6-c-slider__rail-track--before--fill--BackgroundColor': PFColors.Purple20
} as React.CSSProperties;

const replaySliderFill = {
  '--pf-v6-c-slider__rail-track--before--fill--BackgroundColor': PFColors.Replay
} as React.CSSProperties;

export const sliderMirroredStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-slider__thumb': {
      backgroundColor: PFColors.Purple20
    },

    '& .pf-v6-c-slider': mirroredSliderFill
  }
});

export const sliderReplayStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-slider': replaySliderFill
  }
});
