import * as React from 'react';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { glassHighContrastSurfaceNest } from 'styles/ThemeSurfaces';

const contentStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100,
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0,
  $nest: glassHighContrastSurfaceNest({
    highContrast: {
      // Content area relies on child borders; avoid forcing an outer border here.
      border: 'none'
    }
  })
});

export class RenderContent extends React.Component {
  render(): React.ReactNode {
    return <div className={contentStyle}>{this.props.children}</div>;
  }
}
