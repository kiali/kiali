import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

export const healthIndicatorStyle = kialiStyle({
  $nest: {
    '& .pf-c-tooltip__content': {
      borderWidth: '1px',
      textAlign: 'left'
    },

    '& .pf-c-content ul': {
      marginBottom: 'var(--pf-c-content--ul--MarginTop)',
      marginTop: 0,
      color: PFColors.Color100
    }
  }
});
