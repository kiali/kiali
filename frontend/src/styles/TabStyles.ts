import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from './StyleUtils';

export const basicTabStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-tabs': {
      flexShrink: 0
    },
    '& .pf-v6-c-tab-content:not([hidden])': {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      minHeight: 0,
      overflowY: 'auto'
    }
  }
});

export const subTabStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0,
  $nest: {
    '& > .pf-v6-c-tabs': {
      flexShrink: 0
    },
    '& > .pf-v6-c-tab-content:not([hidden])': {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      minHeight: 0,
      overflowY: 'auto'
    },
    '& .pf-v6-c-tabs__list': {
      borderBottom: `1px solid ${PFColors.BorderColor100}`
    }
  }
});
