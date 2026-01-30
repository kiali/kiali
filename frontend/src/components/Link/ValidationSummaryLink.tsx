import * as React from 'react';
import { Link } from 'react-router-dom-v5-compat';
import { IstioConfigListLink } from './IstioConfigListLink';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskIstioConfigAction } from '../Kiosk/KioskActions';
import { naTextStyle } from 'styles/HealthStyle';

type ReduxProps = {
  kiosk: string;
};

type Props = ReduxProps & {
  children: React.ReactNode;
  errors: number;
  namespace: string;
  objectCount?: number;
  warnings: number;
};

export const ValidationSummaryLinkComponent: React.FC<Props> = (props: Props) => {
  let link: React.ReactElement = <div className={naTextStyle}>n/a</div>;

  if (props.objectCount && props.objectCount > 0) {
    // Kiosk actions are used when the kiosk specifies a parent,
    // otherwise the kiosk=true will keep the links inside Kiali
    link = isParentKiosk(props.kiosk) ? (
      <Link to={''} onClick={() => kioskIstioConfigAction(props.namespace)}>
        {props.children}
      </Link>
    ) : (
      <IstioConfigListLink
        namespaces={[props.namespace]}
        warnings={props.warnings > 0}
        errors={props.errors > 0}
        issues={props.warnings || props.errors ? props.warnings + props.errors : undefined}
      >
        {props.children}
      </IstioConfigListLink>
    );
  }

  return link;
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

export const ValidationSummaryLink = connect(mapStateToProps)(ValidationSummaryLinkComponent);
