import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from './StyleUtils';

export const basicTabStyle = kialiStyle({
  $nest: {
    '& .pf-v5-c-tabs__list': {
      marginLeft: '1.25rem'
    },

    '& .pf-v5-c-tab-content': {
      overflowY: 'auto',
      height: '600px'
    }
  }
});

export const subTabStyle = kialiStyle({
  $nest: {
    '& .pf-v5-c-tabs__list': {
      backgroundColor: PFColors.BackgroundColor100,
      borderBottom: `1px solid ${PFColors.BorderColor100}`
    }
  }
});
