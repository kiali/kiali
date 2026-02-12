import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { BreadcrumbView } from '../../BreadcrumbView/BreadcrumbView';
import { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { isKiosk } from '../../Kiosk/KioskActions';
import { PFColors } from 'components/Pf/PfColors';

const containerStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100,
  paddingBottom: '1rem'
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

// Positioned absolutely to align with the tabs row below
const actionsToolbarStyle = kialiStyle({
  position: 'absolute',
  right: '3rem',
  zIndex: 1
});

type ReduxProps = {
  kiosk: string;
};

type RenderHeaderProps = ReduxProps & {
  actionsToolbar?: React.ReactNode;
  children?: React.ReactNode;
  rightToolbar?: React.ReactNode;
};

const RenderHeaderComponent: React.FC<RenderHeaderProps> = (props: RenderHeaderProps) => {
  // RenderHeader is used only in the detail pages
  // On kiosk mode, it should be hidden
  return isKiosk(props.kiosk) ? null : (
    <>
      <div className={containerStyle}>
        <div className={headerRowStyle}>
          <BreadcrumbView />

          {props.rightToolbar && <div className={rightToolbarStyle}>{props.rightToolbar}</div>}
        </div>

        {props.children}
      </div>

      {props.actionsToolbar && <div className={actionsToolbarStyle}>{props.actionsToolbar}</div>}
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

export const RenderHeader = connect(mapStateToProps)(RenderHeaderComponent);
