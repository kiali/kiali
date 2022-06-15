import * as React from 'react';
import { Link } from 'react-router-dom';
import IstioConfigListLink from './IstioConfigListLink';
import {KialiAppState} from "../../store/Store";
import {connect} from "react-redux";
import {kioskIstioConfigAction} from "../Kiosk/KioskActions";

interface Props {
  isKiosk: boolean;
  namespace: string;
  errors: number;
  warnings: number;
  objectCount?: number;
  children: React.ReactNode;
}

class ValidationSummaryLink extends React.Component<Props> {
  hasIstioObjects = () => {
    return this.props.objectCount && this.props.objectCount > 0;
  };

  render() {
    let link: any = <div style={{ display: 'inline-block', marginLeft: '5px' }}>N/A</div>;

    if (this.hasIstioObjects()) {
      link = this.props.isKiosk ? (
          <Link to={''} onClick={() => kioskIstioConfigAction(this.props.namespace)}>
            {this.props.children}
          </Link>
        ) : (
        <IstioConfigListLink
          namespaces={[this.props.namespace]}
          warnings={this.props.warnings > 0}
          errors={this.props.errors > 0}
        >
          {this.props.children}
        </IstioConfigListLink>
      );
    }

    return link;
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  isKiosk: state.globalState.isKiosk,
});

const ValidationSummaryLinkContainer = connect(mapStateToProps)(ValidationSummaryLink)
export default ValidationSummaryLinkContainer;
