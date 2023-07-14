import { kialiStyle } from 'styles/StyleUtils';
import { NestedCSSProperties } from 'typestyle/lib/types';

const slider: NestedCSSProperties = {
  marginRight: '10px',
  $nest: {
    '&:last-child': {
      margin: 0
    }
  }
};

const sliderHandle: NestedCSSProperties = {
  width: '16px',
  height: '16px',
  border: '1px solid #bbb'
};

const sliderTick: NestedCSSProperties = {
  backgroundColor: 'transparent !important',
  backgroundImage: 'radial-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3) 2px, transparent 0) !important',
  '-webkit-box-shadow': 'none',
  boxShadow: 'none'
};

export const sliderStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  $nest: {
    '*': slider,
    '.slider': {
      width: 'auto',
      flex: '1 1 100%'
    },
    '.slider-handle': sliderHandle,
    '.slider-tick': sliderTick
  }
});

export const sliderMirroredStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  $nest: {
    '*': slider,
    '.slider': {
      width: 'auto',
      flex: '1 1 100%',
      $nest: {
        '.slider-track': {
          $nest: {
            '.slider-selection': {
              backgroundImage: 'linear-gradient(to bottom, #703fec 0%, #7144e7 100%)'
            }
          }
        }
      }
    },
    '.slider-handle': sliderHandle,
    '.slider-tick': sliderTick
  }
});
