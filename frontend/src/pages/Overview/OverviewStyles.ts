import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';

// Common card styles
export const cardStyle = kialiStyle({
  height: '100%'
});

export const cardBodyStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  flex: 1
});

// Common link and icon styles
export const linkStyle = kialiStyle({
  color: PFColors.Link
});

export const iconStyle = kialiStyle({
  marginLeft: '0.25rem'
});

// Common stats display styles
export const statsContainerStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  fontSize: '1.5rem'
});

export const statItemStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  $nest: {
    '& svg': {
      margin: '0.125rem 0 0 1rem',
      width: '1rem',
      height: '1rem'
    }
  }
});
