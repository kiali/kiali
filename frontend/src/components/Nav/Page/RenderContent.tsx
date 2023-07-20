import React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../Pf/PfColors';
import { RenderComponentScroll } from './RenderComponentScroll';

const containerPadding = kialiStyle({ padding: '30px 20px 0 20px' });
const containerWhite = kialiStyle({ backgroundColor: PFColors.White });

export class RenderContent extends React.Component<{ needScroll?: boolean; theme?: string }> {
  render() {
    return (
      <RenderComponentScroll className={containerPadding}>
        <div className={containerWhite}>{this.props.children}</div>
      </RenderComponentScroll>
    );
  }
}
