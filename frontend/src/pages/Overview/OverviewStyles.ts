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
  gap: '2rem',
  fontSize: '1.5rem'
});

export const statItemStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  $nest: {
    '& svg': {
      margin: '0.125rem 0 0 1rem',
      width: '1.25rem',
      height: '1.25rem'
    }
  }
});

export const clickableStyle = kialiStyle({
  cursor: 'pointer'
});

// Common popover styles
export const popoverHeaderStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem'
});

export const popoverItemStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem 0',
  borderBottom: `1px solid ${PFColors.BorderColor100}`
});

export const popoverItemStatusStyle = kialiStyle({
  marginLeft: 'auto'
});

export const popoverFooterStyle = kialiStyle({
  marginTop: '1rem'
});
