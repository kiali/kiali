import { kialiStyle } from 'styles/StyleUtils';

export const virtualItemLinkStyle = kialiStyle({
  color: '#0066cc',
  $nest: {
    '&:hover': {
      color: '#004080'
    }
  }
});
