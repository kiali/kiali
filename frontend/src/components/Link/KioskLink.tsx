import * as React from 'react';
import { Link } from 'react-router-dom';
import { isParentKiosk, kioskContextMenuAction } from '../Kiosk/KioskActions';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';

type ReduxProps = {
  kiosk: string;
};

type KioskLinkProps = {
  dataTest: string;
  href: string;
  linkName: string;
};

type KioskLinkItemProps = ReduxProps & KioskLinkProps;

const KioskLinkItem: React.FC<KioskLinkItemProps> = (props: KioskLinkItemProps) => {
  return isParentKiosk(props.kiosk) ? (
    <Link
      to=""
      onClick={() => {
        kioskContextMenuAction(props.href);
      }}
    >
      {props.linkName}
    </Link>
  ) : (
    <Link to={props.href} data-test={props.dataTest}>
      {props.linkName}
    </Link>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

const KioskLinkContainer = connect(mapStateToProps)(KioskLinkItem);

export const KioskLink: React.FC<KioskLinkProps> = (props: KioskLinkProps) => {
  const { linkName, href, dataTest } = props;

  return <KioskLinkContainer linkName={linkName} href={href} dataTest={dataTest} />;
};
