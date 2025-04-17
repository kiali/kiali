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
    const content = <div className={divStyle}>{this.props.children}</div>;
    return this.props.needScroll ? (
      <RenderComponentScroll className={containerStyle}>{content}</RenderComponentScroll>
    ) : (
      <div className={containerStyle}>{content}</div>
    );
  }
}
