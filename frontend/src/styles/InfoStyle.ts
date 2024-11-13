import { kialiStyle } from 'styles/StyleUtils';
import { NestedCSSProperties } from 'typestyle/lib/types';

export const infoStyleProps: NestedCSSProperties = {
  marginLeft: '0.375rem'
};

// info icon placement should be to the right of the component being described
export const infoStyle = kialiStyle({ ...infoStyleProps });
