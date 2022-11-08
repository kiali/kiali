import * as React from 'react';
import { Paths } from '../../config';
import { Link } from 'react-router-dom';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { TooltipPosition } from '@patternfly/react-core';
import { KialiAppState } from "../../store/Store";
import { connect } from "react-redux";
import { isParentKiosk, kioskContextMenuAction } from "../Kiosk/KioskActions";

type ReduxProps = {
  kiosk: string;
}

type Props = {
  name: string;
  namespace: string;
  query?: string;
}

type WorkloadProps = ReduxProps & Props & {
};

export const getWorkloadLink = (name: string, namespace: string, query?: string): string => {
  let to = '/namespaces/' + namespace + '/' + Paths.WORKLOADS;

  to = to + '/' + name;

  if (!!query) {
    to = to + '?' + query;
  }

  return to;
};

export class WorkloadLink extends React.Component<Props> {
  render() {
    const { name, namespace, query } = this.props;

    return (
      <>
        <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
        <WorkloadLinkContainer namespace={namespace} name={name} query={query} />
      </>
    );
  }
}

class WorkloadLinkItem extends React.Component<WorkloadProps> {
  render() {
    const { name, namespace, query } = this.props;
    const href = getWorkloadLink(name, namespace, query);
    return isParentKiosk(this.props.kiosk) ? (
      <Link
        to={''}
        onClick={() => {
          kioskContextMenuAction(href);
        }}
      >{namespace}/{name}</Link>
    ) : (
      <Link to={href} data-test={'workload-' + namespace + '-' + name}>
        {namespace}/{name}
      </Link>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk,
});

const WorkloadLinkContainer = connect(mapStateToProps)(WorkloadLinkItem);
export default WorkloadLinkContainer;
