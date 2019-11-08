import React from 'react';
import { style } from 'typestyle';
import { PfColors } from '../../Pf/PfColors';

const containerPadding = style({ padding: '30px 20px 0 20px' });
const containerWhite = style({ backgroundColor: PfColors.White });

export class RenderContent extends React.Component {
  render() {
    return (
      <div className={containerPadding}>
        <div className={containerWhite}>{this.props.children}</div>
      </div>
    );
  }
}
