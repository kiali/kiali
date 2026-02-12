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

export const statusLabelStyle = kialiStyle({
  height: '1.25rem',
  backgroundColor: 'var(--pf-v6-c-label--m-outline--BackgroundColor, transparent)',
  borderColor: 'var(--pf-v6-c-label--m-outline--BorderColor, transparent)',
  borderStyle: 'solid',
  borderWidth: '1px',
  $nest: {
    '& .pf-v6-c-label__icon': {
      marginRight: '0.25rem'
    },
    '& .pf-v6-c-label__content': {
      color: 'var(--pf-t--global--text--color--primary--default)'
    }
  }
});

export const noUnderlineStyle = kialiStyle({
  textDecoration: 'none',
  $nest: {
    '&, &:hover, &:focus, &:active': {
      textDecoration: 'none'
    }
  }
});
