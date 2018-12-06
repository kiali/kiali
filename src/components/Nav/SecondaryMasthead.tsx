import React from 'react';
import { style } from 'typestyle';

const secondaryMastheadStyle = style({
  borderBottom: '1px solid #d1d1d1',
  padding: '10px 15px'
});

export default class SecondaryMasthead extends React.PureComponent {
  render() {
    return <div className={`container-fluid ${secondaryMastheadStyle}`}>{this.props.children}</div>;
  }
}
