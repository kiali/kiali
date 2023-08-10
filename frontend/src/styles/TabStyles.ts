import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from './StyleUtils';

export const basicTabStyle = kialiStyle({
  $nest: {
    '& .pf-c-tabs__list': {
      marginLeft: '20px'
    },

    '& .pf-c-tab-content': {
      overflowY: 'auto',
      height: '600px'
    }
  }
});

export const traceTabStyle = kialiStyle({
  $nest: {
    '& .pf-c-tabs__list': {
      backgroundColor: PFColors.BackgroundColor100,
      borderBottom: `1px solid ${PFColors.BorderColor100}`
    }
  }
});
