import React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { BreadcrumbView } from '../../BreadcrumbView/BreadcrumbView';
import { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { isKiosk } from '../../Kiosk/KioskActions';
import { PFColors } from 'components/Pf/PfColors';

const containerStyle = kialiStyle({
  padding: '0 20px 28px 20px',
  backgroundColor: PFColors.BackgroundColor100
});

// This magic style tries to adjust Breadcrumb with Namespace selector
// to give impression that both components are placed in the same location
const breadcrumbMargin = kialiStyle({ padding: '10px 0 4px 0' });

const breadcrumbStyle = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap'
});

const rightToolbarStyle = kialiStyle({
  marginLeft: 'auto'
});

const actionsToolbarStyle = kialiStyle({
  float: 'right',
  padding: '0px 20px 22px 5px',
  marginTop: '-16px',
  backgroundColor: PFColors.BackgroundColor100,
  borderBottom: `1px solid ${PFColors.BorderColor100}`
});

type ReduxProps = {
  kiosk: string;
};

type RenderHeaderProps = ReduxProps & {
  location?: {
    pathname: string;
    search: string;
  };
  rightToolbar?: JSX.Element;
  actionsToolbar?: JSX.Element;
};

class RenderHeaderComponent extends React.Component<RenderHeaderProps> {
  render() {
    // RenderHeader is used only in the detail pages
    // On kiosk mode, it should be hidden
    return isKiosk(this.props.kiosk) ? null : (
      <>
        <div className={containerStyle}>
          {this.props.location && (
            <div className={breadcrumbMargin}>
              <div className={breadcrumbStyle}>
                <BreadcrumbView location={this.props.location} />
                {this.props.rightToolbar && <div className={rightToolbarStyle}>{this.props.rightToolbar}</div>}
              </div>
            </div>
          )}
          {this.props.children}
        </div>
        {this.props.actionsToolbar && <div className={actionsToolbarStyle}>{this.props.actionsToolbar}</div>}
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  kiosk: state.globalState.kiosk
});

export const RenderHeader = connect(mapStateToProps)(RenderHeaderComponent);
