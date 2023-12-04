import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

export const targetPanelStyle = kialiStyle({
  marginBottom: '23px',
  border: `1px solid ${PFColors.BorderColor100}`,
  borderRadius: '1px',
  '-webkit-box-shadow': '0 1px 1px rgba(0, 0, 0, 0.05)',
  boxShadow: '0 1px 1px rgba(0, 0, 0, 0.05)'
});

export const targetPanelHeadingStyle = kialiStyle({
  padding: '10px 15px',
  borderBottom: '1px solid transparent',
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderColor: PFColors.BorderColor100
});

export const targetPanelBodyStyle = kialiStyle({
  padding: '15px',
  $nest: {
    '&:after, &:before': {
      display: 'table',
      content: ' '
    },

    '&:after': {
      clear: 'both'
    }
  }
});
