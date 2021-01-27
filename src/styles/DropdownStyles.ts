import { PfColors } from 'components/Pf/PfColors';
import { style } from 'typestyle';

export const containerStyle = style({
  overflow: 'auto'
});

// this emulates Select component .pf-c-select__menu
export const menuStyle = style({
  fontSize: '14px'
});

// this emulates Select component .pf-c-select__menu
export const menuEntryStyle = style({
  cursor: 'not-allowed',
  display: 'inline-block',
  width: '15.5em'
});

// this emulates Select component .pf-c-select__menu-group-title but with less bottom padding to conserve space
export const titleStyle = style({
  padding: '8px 16px 2px 16px',
  fontWeight: 700,
  color: PfColors.Black600
});

// this emulates Select component .pf-c-select__menu-item but with less vertical padding to conserve space
export const itemStyleWithoutInfo = style({
  alignItems: 'center',
  whiteSpace: 'nowrap',
  margin: 0,
  padding: '6px 16px'
});

// this emulates Select component .pf-c-select__menu-item but with less vertical padding to conserve space
export const itemStyleWithInfo = style({
  alignItems: 'center',
  whiteSpace: 'nowrap',
  margin: 0,
  padding: '6px 0px 6px 16px'
});

export const infoStyle = style({
  margin: '0px 16px 2px 4px'
});

// this emulates Select component .pf-c-select__menu-item but with less vertical padding to conserve space
export const itemStyle = (hasInfo: boolean) =>
  style({
    alignItems: 'center',
    whiteSpace: 'nowrap',
    margin: 0,
    padding: hasInfo ? '6px 0px 6px 16px' : '6px 16px'
  });
