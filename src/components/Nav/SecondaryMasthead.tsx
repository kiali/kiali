import React from 'react';
import { style } from 'typestyle';

const paddingStyle = style({
  margin: '10px 20px 0 10px'
});
const secondaryMastheadStyle = style({
  position: 'sticky',
  zIndex: 10,
  marginLeft: 0,
  marginRight: 0
});

export default class SecondaryMasthead extends React.Component<{ title: boolean }> {
  render() {
    let secondaryMastheadStyleHeight = style({ height: '42px' });
    if (this.props.title) {
      secondaryMastheadStyleHeight = style({ height: 'unset' });
    }
    return (
      <div
        id="global-namespace-selector"
        className={`container-fluid ${secondaryMastheadStyle} ${secondaryMastheadStyleHeight}`}
      >
        <div className={paddingStyle}>{this.props.children}</div>
      </div>
    );
  }
}
