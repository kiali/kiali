import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

export const sliderRailFillCssVar = '--pf-v6-c-slider__rail-track--before--fill--BackgroundColor';

const sliderRailFillNest = (color: string): Record<string, string> => ({
  [sliderRailFillCssVar]: color
});

const mirroredThumbRing = `0 0 0 2px var(--pf-t--global--background--color--primary--default), 0 0 0 3px ${PFColors.Mirroring}`;

const pfSliderInteractiveCursor = {
  '& .pf-v6-c-slider:not(.pf-m-disabled) .pf-v6-c-slider__main, & .pf-v6-c-slider:not(.pf-m-disabled) .pf-v6-c-slider__rail, & .pf-v6-c-slider:not(.pf-m-disabled) .pf-v6-c-slider__thumb':
    {
      cursor: 'pointer'
    }
};

export const sliderRailFillStyle = (color: string): string =>
  kialiStyle({
    $nest: {
      '& .pf-v6-c-slider': sliderRailFillNest(color)
    }
  });

export const sliderStyle = (maxWidth?: string): string =>
  kialiStyle({
    alignItems: 'center',
    display: 'flex',
    flex: '1 1 auto',
    minWidth: 0,
    width: '100%',
    $nest: {
      '& .pf-v6-c-slider': {
        flex: '1 1 auto',
        minWidth: 0,
        width: '100%'
      },

      // Limit rail width; end actions (% input, lock/mirror buttons) stay outside this cap.
      '& .pf-v6-c-slider__main': {
        flex: '1 1 auto',
        maxWidth,
        minWidth: '4rem'
      },

      ...pfSliderInteractiveCursor,

      '& .pf-v6-c-slider__steps': {
        height: 0,
        overflow: 'hidden'
      }
    }
  });

export const sliderMirroredStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-slider__thumb': {
      backgroundColor: PFColors.Mirroring,
      boxShadow: mirroredThumbRing
    }
  }
});
