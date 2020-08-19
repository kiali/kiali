import * as React from 'react';
import { style } from 'typestyle';

export const actionBarStyle = style({
  position: 'absolute',
  marginTop: -60,
  right: 18,
  zIndex: 1,
  display: 'flex'
});

export const RightActionBar: React.FunctionComponent = props => {
  return <span className={actionBarStyle}>{props.children}</span>;
};
