import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

export const healthIndicatorStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-tooltip__content': {
      borderWidth: '1px',
      textAlign: 'left'
    },

    '& .pf-v6-c-content ul': {
      marginBottom: 'var(--pf-v6-c-content--ul--MarginTop)',
      marginTop: 0,
      color: PFColors.Color100
    }
  }
});
