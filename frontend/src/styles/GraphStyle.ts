import { kialiStyle } from './StyleUtils';

export const toolbarActiveStyle = kialiStyle({
  top: '0.25rem',
  $nest: {
    '& svg': {
      width: '1.25rem',
      height: '1.25rem'
    }
  }
});
