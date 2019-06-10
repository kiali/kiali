import React from 'react';
import { style } from 'typestyle';

const secondaryMastheadStyle = style({
  padding: '5px 5px',
  borderBottom: '1px solid #ccc;',
  height: '42px',
  position: 'sticky',
  zIndex: 10,
  marginLeft: 0,
  marginRight: 0
});

export default class SecondaryMasthead extends React.PureComponent {
  render() {
    return (
      <div id="global-namespace-selector" className={`container-fluid ${secondaryMastheadStyle}`}>
        {this.props.children}
      </div>
    );
  }
}
