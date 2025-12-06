import * as React from 'react';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { RenderComponentScroll } from './RenderComponentScroll';

const divStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100
});

export class RenderContent extends React.Component<{ needScroll?: boolean }> {
  render(): React.ReactNode {
    const content = <div className={divStyle}>{this.props.children}</div>;
    return this.props.needScroll ? <RenderComponentScroll>{content}</RenderComponentScroll> : <div>{content}</div>;
  }
}
