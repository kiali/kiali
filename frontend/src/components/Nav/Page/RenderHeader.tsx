import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { BreadcrumbView } from '../../BreadcrumbView/BreadcrumbView';
import { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { isKiosk } from '../../Kiosk/KioskActions';
import { PFColors } from 'components/Pf/PfColors';

const containerStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100,
  flexShrink: 0,
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

const actionsToolbarPositionStyle = kialiStyle({
  position: 'absolute',
  right: '3rem',
  top: '9rem',
  zIndex: 1
});

type ReduxProps = {
  kiosk: string;
};

type RenderHeaderProps = ReduxProps & {
  actionsToolbar?: React.ReactNode;
  actionsToolbarTop?: string;
  children?: React.ReactNode;
  rightToolbar?: React.ReactNode;
};

const RenderHeaderComponent: React.FC<RenderHeaderProps> = (props: RenderHeaderProps) => {
  return isKiosk(props.kiosk) ? null : (
    <>
      <div className={containerStyle}>
        <div className={headerRowStyle}>
          <BreadcrumbView />

          {props.rightToolbar && <div className={rightToolbarStyle}>{props.rightToolbar}</div>}
        </div>

        {props.children}
      </div>

      {props.actionsToolbar && (
        <div className={actionsToolbarPositionStyle} style={{ top: props.actionsToolbarTop ?? '9rem' }}>
          {props.actionsToolbar}
        </div>
      )}
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

export const RenderHeader = connect(mapStateToProps)(RenderHeaderComponent);
