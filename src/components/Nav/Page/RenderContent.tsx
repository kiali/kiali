import React from 'react';
import { style } from 'typestyle';
import { PfColors } from '../../Pf/PfColors';

const containerPadding = style({ padding: '30px 20px 0 20px' });
const containerWhite = style({ backgroundColor: PfColors.White });

export class RenderContent extends React.Component<{ needScroll?: boolean }> {
  render() {
    return (
      <div className={`${containerPadding} ${this.props.needScroll ? 'content-scrollable' : ''}`}>
        <div className={containerWhite}>{this.props.children}</div>
      </div>
    );
  }
}
