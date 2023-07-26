import { kialiStyle } from './StyleUtils';

export const basicTabStyle = kialiStyle({
  $nest: {
    '.pf-c-tabs__list': {
      marginLeft: '20px'
    },
    '.pf-c-tab-content': {
      overflowY: 'auto',
      height: '600px'
    }
  }
});
