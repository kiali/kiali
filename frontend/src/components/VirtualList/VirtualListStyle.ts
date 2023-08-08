import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

export const virtualItemLinkStyle = kialiStyle({
  color: PFColors.Blue400,
  $nest: {
    '&:hover': {
      color: PFColors.Blue500
    }
  }
});
