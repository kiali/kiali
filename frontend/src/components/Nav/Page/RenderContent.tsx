import * as React from 'react';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

const contentStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100,
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0
});

export class RenderContent extends React.Component {
  render(): React.ReactNode {
    return <div className={contentStyle}>{this.props.children}</div>;
  }
}
