import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

export const sliderRailFillCssVar = '--pf-v6-c-slider__rail-track--before--fill--BackgroundColor';

const sliderRailFillVars = (color: string): Record<string, string> => ({
  [sliderRailFillCssVar]: color
});

const mirroredThumbRing = `0 0 0 2px var(--pf-t--global--background--color--primary--default), 0 0 0 3px ${PFColors.Mirroring}`;

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
        ...(railTrackFill ? sliderRailFillVars(railTrackFill) : {})
      },

      // Limit rail width; end actions (% input, lock/mirror buttons) stay outside this cap.
      '& .pf-v6-c-slider__main': {
        flex: '1 1 auto',
        maxWidth: maxWidth,
        minWidth: '4rem'
      },

      '& .pf-v6-c-slider:not(.pf-m-disabled) .pf-v6-c-slider__main, & .pf-v6-c-slider:not(.pf-m-disabled) .pf-v6-c-slider__rail, & .pf-v6-c-slider:not(.pf-m-disabled) .pf-v6-c-slider__thumb':
        {
          cursor: 'pointer'
        }
    }
  });

export const sliderMirroredStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-slider': sliderRailFillVars(PFColors.Mirroring),

    '& .pf-v6-c-slider__thumb': {
      backgroundColor: PFColors.Mirroring,
      boxShadow: mirroredThumbRing
    }
  }
});
