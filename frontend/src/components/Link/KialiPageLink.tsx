import * as React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { serverConfig } from '../../config';
import {KialiAppState} from "../../store/Store";
import {connect} from "react-redux";
import {isParentKiosk, kioskContextMenuAction} from "../Kiosk/KioskActions";

type ReduxProps = {
    kiosk: string;
}

type KialiPageLinkProps = ReduxProps & {
  children: React.ReactNode;
  cluster?: string;
  href: string;
}

class KialiPageLink extends React.Component<KialiPageLinkProps> {

  render() {
    // Without a cluster, simply render a local link
    // If cluster is specified, and it's the home cluster, render a local link.
    if (!this.props.cluster || !serverConfig.clusterInfo?.name || this.props.cluster === serverConfig.clusterInfo.name) {
      if (isParentKiosk(this.props.kiosk)) {
        return <Link
            to={''}
            onClick={()=> {
              kioskContextMenuAction(this.props.href);
            }}
            children={this.props.children}
          />;
      } else {
        return <Link to={this.props.href}>{this.props.children}</Link>;
      }
    }

    // If it's a remote cluster, check if there is an accessible Kiali on that cluster.
    // If there is, render an external link. Else, render plain text.
    const clusterInfo = serverConfig.clusters[this.props.cluster];
    const kialiInstance = clusterInfo?.kialiInstances?.find(instance => instance.url.length !== 0);

    if (kialiInstance === undefined) {
      return this.props.children as React.ReactElement<any>;
    } else {
      const href = kialiInstance.url.replace(/\/$/g, '') + '/console' + this.props.href;
      return (
        <a href={href} rel="noreferrer noopener" target="_blank">
          {this.props.children} <ExternalLinkAltIcon/>
        </a>
      );
    }
  }

}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk,
});

const KialiPageLinkContainer = connect(mapStateToProps)(KialiPageLink);
export default KialiPageLinkContainer;
