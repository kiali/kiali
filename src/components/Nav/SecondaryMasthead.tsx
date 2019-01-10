import React from 'react';
import { style } from 'typestyle';

const secondaryMastheadStyle = style({
  padding: '5px 5px',
  boxShadow: '0 2px 4px 0 #0000002B',
  height: '42px'
});

export default class SecondaryMasthead extends React.PureComponent {
  render() {
    return <div className={`container-fluid ${secondaryMastheadStyle}`}>{this.props.children}</div>;
  }
}
