import React from 'react';
import { style } from 'typestyle';
import { PFColors } from '../../Pf/PfColors';
import BreadcrumbView from '../../BreadcrumbView/BreadcrumbView';
import {KialiAppState} from "../../../store/Store";
import {connect} from "react-redux";

const containerPadding = style({ padding: '0 20px 28px 20px' });
const containerWhite = style({ backgroundColor: PFColors.White });
// This magic style tries to adjust Breadcrumb with Namespace selector
// to give impression that both components are placed in the same location
const breadcrumbMargin = style({ padding: '10px 0 4px 0' });

const breadcrumbStyle = style({
  display: 'flex',
  flexWrap: 'wrap'
});

const rightToolbarStyle = style({
  marginLeft: 'auto'
});

const actionsToolbarStyle = style({
  float: 'right',
  backgroundColor: '#fff',
  padding: '0px 20px 22px 5px',
  marginTop: '-19px',
  borderBottom: '1px solid #d2d2d2'
});

interface RenderHeaderProps {
  isKiosk: boolean;
  location?: {
    pathname: string;
    search: string;
  };
  rightToolbar?: JSX.Element;
  actionsToolbar?: JSX.Element;
}

export class RenderHeader extends React.Component<RenderHeaderProps> {
  render() {
    // RenderHeader is used only in the detail pages
    // On kiosk mode, it should be hidden
    return this.props.isKiosk ? (null) : (
      <>
        <div className={`${containerPadding} ${containerWhite}`}>
          {this.props.location && (
            <>
              <div className={breadcrumbMargin}>
                <div className={breadcrumbStyle}>
                  <BreadcrumbView location={this.props.location} />
                  {this.props.rightToolbar && <div className={rightToolbarStyle}>{this.props.rightToolbar}</div>}
                </div>
              </div>
            </>
          )}
          {this.props.children}
        </div>
        {this.props.actionsToolbar && <div className={actionsToolbarStyle}>{this.props.actionsToolbar}</div>}
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  isKiosk: state.globalState.isKiosk,
});

const RenderHeaderContainer = connect(mapStateToProps)(RenderHeader);
export default RenderHeaderContainer;
