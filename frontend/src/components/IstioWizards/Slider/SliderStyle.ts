import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

export const sliderStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  $nest: {
    '.slider': {
      width: 'auto',
      flex: '1 1 100%',
      marginRight: '10px'
    },

    '.slider-handle': {
      width: '16px',
      height: '16px',
      border: `1px solid ${PFColors.BorderColor200}`
    },

    '.slider-tick': {
      backgroundColor: 'transparent !important',
      backgroundImage: `radial-gradient(${PFColors.Color200}, ${PFColors.Color200} 2px, transparent 0) !important`,
      '-webkit-box-shadow': 'none',
      boxShadow: 'none'
    },

    // Make sure slider tooltips are below datepicker popper but above secondary masthead
    '.tooltip': {
      zIndex: 10
    }
  }
});

export const sliderMirroredStyle = kialiStyle({
  $nest: {
    '.slider .slider-track .slider-selection': {
      backgroundImage: 'linear-gradient(to bottom, #703fec 0%, #7144e7 100%)'
    }
  }
});
