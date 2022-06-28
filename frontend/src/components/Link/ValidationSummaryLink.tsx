import * as React from 'react';
import { Link } from 'react-router-dom';
import IstioConfigListLink from './IstioConfigListLink';
import {KialiAppState} from "../../store/Store";
import {connect} from "react-redux";
import {isParentKiosk, kioskIstioConfigAction} from "../Kiosk/KioskActions";

type ReduxProps = {
  kiosk: string;
}

type Props = ReduxProps & {
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
      // Kiosk actions are used when the kiosk specifies a parent,
      // otherwise the kiosk=true will keep the links inside Kiali
      link = isParentKiosk(this.props.kiosk) ? (
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
  kiosk: state.globalState.kiosk,
});

const ValidationSummaryLinkContainer = connect(mapStateToProps)(ValidationSummaryLink)
export default ValidationSummaryLinkContainer;
