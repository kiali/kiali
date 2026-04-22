import * as React from 'react';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { flexFillStyle } from 'styles/FlexStyles';

const contentStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100,
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0
});

export class RenderContent extends React.Component<{ needScroll?: boolean }> {
  render(): React.ReactNode {
    const content = <div className={contentStyle}>{this.props.children}</div>;
    return this.props.needScroll ? <div className={flexFillStyle}>{content}</div> : content;
  }
}
