import React from 'react';
import { kialiStyle } from 'styles/StyleUtils';

const marginStyle = kialiStyle({
  margin: '10px 20px 0 0'
});
const secondaryMastheadStyle = kialiStyle({
  position: 'sticky',
  zIndex: 10,
  marginLeft: 0,
  marginRight: 0
});

export class SecondaryMasthead extends React.Component<{ title: boolean }> {
  render() {
    let secondaryMastheadStyleHeight = kialiStyle({ height: '42px' });
    if (this.props.title) {
      secondaryMastheadStyleHeight = kialiStyle({ height: 'unset' });
    }
    return (
      <div
        id="global-namespace-selector"
        className={`container-fluid ${secondaryMastheadStyle} ${secondaryMastheadStyleHeight}`}
      >
        <div className={marginStyle}>{this.props.children}</div>
      </div>
    );
  }
}
