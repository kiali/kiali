import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { NestedCSSProperties } from 'typestyle/lib/types';
import { PFFontSize } from './PfTypography';

export const containerStyle = kialiStyle({
  overflow: 'auto'
});

// this emulates Select component .pf-v6-c-select__menu
export const menuStyle = kialiStyle({
  fontSize: 'var(--kiali-global--font-size)'
});

// this emulates Select component .pf-v6-c-select__menu but w/o cursor manipulation
export const menuEntryStyle = kialiStyle({
  display: 'inline-block',
  width: '100%',
  $nest: {
    '&:hover': {
      backgroundColor: PFColors.BackgroundColor200
    }
  }
});

// this emulates Select component .pf-v6-c-select__menu-group-title but with less bottom padding to conserve space
export const titleStyle = kialiStyle({
  padding: '0.5rem 1rem 0 1rem',
  fontWeight: 700,
  color: PFColors.Color200
});

const itemStyle: NestedCSSProperties = {
  alignItems: 'center',
  whiteSpace: 'nowrap',
  margin: 0,
  padding: '0.375rem 1rem',
  display: 'inline-block'
};

// this emulates Select component .pf-v6-c-select__menu-item but with less vertical padding to conserve space
export const itemStyleWithoutInfo = kialiStyle(itemStyle);

// this emulates Select component .pf-v6-c-select__menu-item but with less vertical padding to conserve space
export const itemStyleWithInfo = kialiStyle({
  ...itemStyle,
  padding: '0.375rem 0 0.375rem 1rem'
});

export const groupMenuStyle = kialiStyle({
  textAlign: 'left'
});

export const kebabToggleStyle = kialiStyle({
  paddingLeft: '0.5rem',
  paddingRight: '0.5rem'
});

// Display menu: row with left content and right-aligned help icon (icon shown only on hover)
export const displayMenuRowStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  boxSizing: 'border-box',
  $nest: {
    '&:hover': {
      backgroundColor: PFColors.BackgroundColor200
    }
  }
});

// Section title row (e.g. "Show Edge Labels"): no hover background, not a menu item, vertical center align with content
export const displayMenuRowStyleNoHover = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: '0.5rem'
});

export const displayMenuRowContentStyle = kialiStyle({
  flex: '1 1 auto',
  minWidth: 0
});

export const displayMenuRowIconStyle = kialiStyle({
  flexShrink: 0,
  marginLeft: 'auto',
  paddingLeft: '0.5rem',
  paddingRight: '0.5rem',
  background: 'none',
  border: 'none',
  display: 'flex',
  alignItems: 'center'
});

// Global toggle section at top of Display menu
export const displayMenuToggleSectionStyle = kialiStyle({
  padding: '0.5rem 1rem',
  borderBottom: `1px solid ${PFColors.BorderColor200}`
});

export const displayMenuToggleDescriptionStyle = kialiStyle({
  fontSize: PFFontSize.small,
  color: PFColors.Color200,
  marginTop: '0.25rem',
  paddingLeft: '1.75rem'
});
