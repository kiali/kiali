import * as React from 'react';
import { Paths } from '../../config';
import { Link } from 'react-router-dom';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { TooltipPosition } from '@patternfly/react-core';
import { connect } from "react-redux";
import { isParentKiosk, kioskContextMenuAction } from "../Kiosk/KioskActions";
import { KialiAppState } from "../../store/Store";

type ReduxProps = {
  kiosk: string;
}

type Props = {
  name: string;
  namespace: string;
  query?: string;
}

type ServiceProps = ReduxProps & Props & {
};

export const getServiceURL = (name: string, namespace: string, query?: string): string => {
  let to = '/namespaces/' + namespace + '/' + Paths.SERVICES;

  to = to + '/' + name;

  if (!!query) {
    to = to + '?' + query;
  }

  return to;
};

export class ServiceLink extends React.Component<Props> {
  render() {
    const { name, namespace, query } = this.props;

    return (
      <>
        <PFBadge badge={PFBadges.Service} position={TooltipPosition.top} />
        <ServiceLinkContainer name={name} namespace={namespace} query={query} />
      </>
    );
  }
}

class ServiceLinkItem extends React.Component<ServiceProps> {
  render() {
    const { name, namespace, query } = this.props;
    const href = getServiceURL(name, namespace, query);
    return isParentKiosk(this.props.kiosk) ? (
      <Link
        to={''}
        onClick={() => {
          kioskContextMenuAction(href);
        }}
      >{namespace}/{name}</Link>
    ) : (
      <Link to={getServiceURL(name, namespace, query)} data-test={'service-' + namespace + '-' + name}>
        {namespace}/{name}
      </Link>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk,
});

const ServiceLinkContainer = connect(mapStateToProps)(ServiceLinkItem);
export default ServiceLinkContainer;
