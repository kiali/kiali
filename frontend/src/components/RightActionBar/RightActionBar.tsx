import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';

export const actionBarStyle = kialiStyle({
  position: 'absolute',
  marginTop: -60,
  right: 18,
  zIndex: 1,
  display: 'flex'
});

export const RightActionBar: React.FunctionComponent = props => {
  return <span className={actionBarStyle}>{props.children}</span>;
};
