import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from './StyleUtils';

export const toolbarActiveStyle = kialiStyle({
  top: '0.25rem',
  color: PFColors.Active,
  $nest: {
    '& svg': {
      width: '1.25rem',
      height: '1.25rem'
    }
  }
});
