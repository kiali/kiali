import React from 'react';
import { style } from 'typestyle';
import { PfColors } from '../../Pf/PfColors';

const containerPadding = style({ padding: '0 20px 20px 20px' });
const containerWhite = style({ backgroundColor: PfColors.White });

export class RenderHeader extends React.Component {
  render() {
    return <div className={`${containerPadding} ${containerWhite}`}>{this.props.children}</div>;
  }
}
