import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

export const panelStyle = kialiStyle({
  marginBottom: '1.5rem',
  border: `1px solid ${PFColors.BorderColor100}`,
  borderRadius: '1px',
  '-webkit-box-shadow': '0 1px 1px rgba(0, 0, 0, 0.05)',
  boxShadow: '0 1px 1px rgba(0, 0, 0, 0.05)'
});

export const panelHeadingStyle = kialiStyle({
  padding: '0.5rem 1rem',
  borderBottom: `1px solid ${PFColors.BorderColor100}`,
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0
});

export const panelBodyStyle = kialiStyle({
  padding: '1rem',
  $nest: {
    '&:after, &:before': {
      display: 'table',
      content: ' '
    },

    '&:after': {
      clear: 'both'
    },

    '& pre': {
      whiteSpace: 'pre-wrap'
    }
  }
});
