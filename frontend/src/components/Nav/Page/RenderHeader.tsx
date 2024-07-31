import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { BreadcrumbView } from '../../BreadcrumbView/BreadcrumbView';
import { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { isKiosk } from '../../Kiosk/KioskActions';
import { PFColors } from 'components/Pf/PfColors';

const containerStyle = kialiStyle({
  padding: '0 1.25rem 1.75rem 1.25rem',
  backgroundColor: PFColors.BackgroundColor100
});

// This magic style tries to adjust Breadcrumb with Namespace selector
// to give impression that both components are placed in the same location
const breadcrumbMargin = kialiStyle({ padding: '0.75rem 0 0.25rem 0' });

const breadcrumbStyle = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap'
});

const rightToolbarStyle = kialiStyle({
  marginLeft: 'auto'
});

const actionsToolbarStyle = kialiStyle({
  float: 'right',
  padding: '0 1.25rem 1.375rem 0.25rem',
  marginTop: '-1rem',
  backgroundColor: PFColors.BackgroundColor100,
  borderBottom: `1px solid ${PFColors.BorderColor100}`
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
        <div className={breadcrumbMargin}>
          <div className={breadcrumbStyle}>
            <BreadcrumbView />

            {props.rightToolbar && <div className={rightToolbarStyle}>{props.rightToolbar}</div>}
          </div>
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
