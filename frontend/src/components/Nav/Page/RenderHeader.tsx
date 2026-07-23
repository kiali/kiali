import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { BreadcrumbView } from '../../BreadcrumbView/BreadcrumbView';
import type { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { isKiosk } from '../../Kiosk/KioskActions';
import { PFColors } from 'components/Pf/PfColors';
import { glassHighContrastSurfaceNest } from 'styles/ThemeSurfaces';

const containerStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100,
  flexShrink: 0,
  paddingBottom: '0.5rem',
  $nest: glassHighContrastSurfaceNest({
    highContrast: {
      border: 'none',
      borderBottom: `1px solid ${PFColors.BorderDefault}`
    }
  })
});

const headerRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

const rightToolbarStyle = kialiStyle({
  display: 'flex',
  gap: '0.5rem',
  marginLeft: 'auto'
});

type ReduxProps = {
  kiosk: string;
};

type RenderHeaderProps = ReduxProps & {
  children?: React.ReactNode;
  rightToolbar?: React.ReactNode;
};

const RenderHeaderComponent: React.FC<RenderHeaderProps> = (props: RenderHeaderProps) => {
  return isKiosk(props.kiosk) ? null : (
    <div className={containerStyle}>
      <div className={headerRowStyle}>
        <BreadcrumbView />

        {props.rightToolbar && <div className={rightToolbarStyle}>{props.rightToolbar}</div>}
      </div>

      {props.children}
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

export const RenderHeader = connect(mapStateToProps)(RenderHeaderComponent);
