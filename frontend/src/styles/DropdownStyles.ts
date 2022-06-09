import { PFColors } from 'components/Pf/PfColors';
import { style } from 'typestyle';
import { NestedCSSProperties } from 'typestyle/lib/types';

export const containerStyle = style({
  overflow: 'auto'
});

// this emulates Select component .pf-c-select__menu
export const menuStyle = style({
  fontSize: 'var(--kiali-global--font-size)',
});

// this emulates Select component .pf-c-select__menu but w/o cursor manipulation
export const menuEntryStyle = style({
  display: 'inline-block',
  width: '100%'
});

// this emulates Select component .pf-c-select__menu-group-title but with less bottom padding to conserve space
export const titleStyle = style({
  padding: '8px 16px 2px 16px',
  fontWeight: 700,
  color: PFColors.Black600
});

const itemStyle: NestedCSSProperties = {
  alignItems: 'center',
  whiteSpace: 'nowrap',
  margin: 0,
  padding: '6px 16px',
  $nest: {
    '& > div > input.pf-c-radio__input': {
      margin: '1px 0 0 0',
    },
    '& > div > input.pf-c-check__input': {
      margin: '1px 0 0 0',
    }
  }
};

// this emulates Select component .pf-c-select__menu-item but with less vertical padding to conserve space
export const itemStyleWithoutInfo = style(itemStyle);

// this emulates Select component .pf-c-select__menu-item but with less vertical padding to conserve space
export const itemStyleWithInfo = style({
  ...itemStyle,
  padding: '6px 0px 6px 16px'
});

export const infoStyle = style({
  margin: '0px 5px 2px 4px'
});
