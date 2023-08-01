import React from 'react';
import { kialiStyle } from 'styles/StyleUtils';

const marginStyle = kialiStyle({
  margin: '10px 20px 0 0'
});

const secondaryMastheadStyle = kialiStyle({
  position: 'sticky',
  zIndex: 10,
  marginLeft: 0,
  marginRight: 0,
  paddingRight: '20px',
  paddingLeft: '20px'
});

export class SecondaryMasthead extends React.Component {
  render() {
    return (
      <div id="global-namespace-selector" className={secondaryMastheadStyle}>
        <div className={marginStyle}>{this.props.children}</div>
      </div>
    );
  }
}
