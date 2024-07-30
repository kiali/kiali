import * as React from 'react';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { RenderComponentScroll } from './RenderComponentScroll';

const containerStyle = kialiStyle({
  padding: '30px 20px 0 20px'
});

const divStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100
});

export class RenderContent extends React.Component<{ needScroll?: boolean }> {
  render(): React.ReactNode {
    return (
      <RenderComponentScroll className={containerStyle}>
        <div className={divStyle}>{this.props.children}</div>
      </RenderComponentScroll>
    );
  }
}
