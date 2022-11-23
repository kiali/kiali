import * as React from 'react';
import { Link } from 'react-router-dom';
import { isParentKiosk, kioskContextMenuAction } from "../Kiosk/KioskActions";
import {KialiAppState} from "../../store/Store";
import {connect} from "react-redux";

type ReduxProps = {
  kiosk: string;
}

type Props = {
  linkName: string;
  href: string;
  dataTest: string;
}

type KioskProps = ReduxProps & Props;

export class KioskLink extends React.Component<Props> {
  render() {
    const { linkName, href, dataTest } = this.props;

    return (
      <>
        <KioskLinkContainer linkName={linkName} href={href} dataTest={dataTest} />
      </>
    );
  }
}

class KioskLinkItem extends React.Component<KioskProps> {
  render() {
    return isParentKiosk(this.props.kiosk) ? (
      <Link
        to={''}
        onClick={() => {
          kioskContextMenuAction(this.props.href);
        }}
      >{this.props.linkName}</Link>
    ) : (
      <Link to={this.props.href} data-test={this.props.dataTest}>
        {this.props.linkName}
      </Link>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk,
});

const KioskLinkContainer = connect(mapStateToProps)(KioskLinkItem);
