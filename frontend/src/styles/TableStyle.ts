import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from './StyleUtils';

export const tableStyle = kialiStyle({
  width: '100%',
  maxWidth: '100%',
  // marginBottom: '0.5rem',
  $nest: {
    // eslint-disable-next-line no-multi-str
    '& > thead > tr > th, \
     & > tbody > tr > td, \
     & > tfoot > tr > td': {
      padding: '0.5rem'
      // lineHeight: 1.66667,
      // verticalAlign: 'top'
      // borderTop: `1px solid ${PFColors.BorderColor100}`
    },

    '& > thead > tr > th': {
      // verticalAlign: 'bottom',
      borderBottom: `2px solid ${PFColors.BorderColor100}`
    }

    // eslint-disable-next-line no-multi-str
    // '& > thead:first-child > tr:first-child > td, \
    //  & > thead:first-child > tr:first-child > th': {
    //   borderTop: 0
    // }
  }
});
