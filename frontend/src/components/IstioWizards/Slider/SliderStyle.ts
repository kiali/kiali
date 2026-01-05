import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

export const sliderStyle = (maxWidth?: string): string =>
  kialiStyle({
    display: 'flex',
    alignItems: 'center',
    $nest: {
      '& .slider': {
        width: 'auto',
        flex: '1 1 100%',
        marginRight: '10px',
        maxWidth: maxWidth
      },

      '& .slider-handle': {
        cursor: 'pointer',
        width: '16px',
        height: '16px'
      },

      '& .slider-tick': {
        backgroundColor: 'transparent !important',
        backgroundImage: `radial-gradient(${PFColors.Color200}, ${PFColors.Color200} 2px, transparent 0) !important`,
        '-webkit-box-shadow': 'none',
        boxShadow: 'none'
      },

      // Make sure slider tooltips are below datepicker popper but above secondary masthead
      '& .tooltip': {
        zIndex: 10
      }
    }
  });

export const sliderMirroredStyle = kialiStyle({
  $nest: {
    '& .slider': {
      $nest: {
        '& .slider-handle, & .slider-track .slider-selection': {
          backgroundColor: PFColors.Purple200
        }
      }
    }
  }
});
