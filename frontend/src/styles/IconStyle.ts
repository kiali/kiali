import { kialiStyle } from 'styles/StyleUtils';

// info icon placement that triggers tooltip on hover
// TODO replace by helpIconStyle when tooltip is migrated to popover
export const infoStyle = kialiStyle({ marginLeft: '0.375rem' });

// question mark (help) icon in display menu: no background or border
export const helpIconStyle = kialiStyle({
  marginLeft: '0.375rem',
  background: 'none',
  border: 'none'
});

// section title help icon in display menu: always visible, smaller, vertical align (color via KialiIcon color prop)
export const helpIconStyleSectionTitle = kialiStyle({
  marginLeft: '0.375rem',
  background: 'none',
  border: 'none',
  fontSize: '0.75rem',
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'center',
  lineHeight: 1
});
