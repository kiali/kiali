import * as React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { serverConfig } from '../../config';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskContextMenuAction } from '../Kiosk/KioskActions';
import { isConfiguredCluster, isHomeCluster } from 'config/ServerConfig';

type ReduxProps = {
  kiosk: string;
};

type KialiPageLinkProps = ReduxProps & {
  children: React.ReactNode;
  cluster?: string;
  href: string;
};

const KialiPageLinkComponent: React.FC<KialiPageLinkProps> = (props: KialiPageLinkProps) => {
  // If not a remote cluster, simply render a local link
  if (!props.cluster || isHomeCluster(props.cluster)) {
    if (isParentKiosk(props.kiosk)) {
      return (
        <Link
          to=""
          onClick={() => {
            kioskContextMenuAction(props.href);
          }}
          children={props.children}
        />
      );
    } else {
      return <Link to={props.href}>{props.children}</Link>;
    }
  }

  // If it's a cluster configured for this Kiali instance
  if (isConfiguredCluster(props.cluster)) {
    const href = `${props.href}?clusterName=${encodeURIComponent(props.cluster!)}`;

    if (isParentKiosk(props.kiosk)) {
      return (
        <Link
          to=""
          onClick={() => {
            kioskContextMenuAction(href);
          }}
          children={props.children}
        />
      );
    } else {
      return <Link to={href}>{props.children}</Link>;
    }
  }

  // If it's a cluster on which there is a remote Kiali, render an external link. Else, render plain text.
  const clusterInfo = serverConfig.clusters[props.cluster];
  const kialiInstance = clusterInfo?.kialiInstances?.find(instance => instance.url.length !== 0);

  if (kialiInstance === undefined) {
    return props.children as React.ReactElement<any>;
  } else {
    const href = `${kialiInstance.url.replace(/\/$/g, '')}/console${props.href}`;

    return (
      <a href={href} rel="noreferrer noopener" target="_blank">
        {props.children} <ExternalLinkAltIcon />
      </a>
    );
  }
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

export const KialiPageLink = connect(mapStateToProps)(KialiPageLinkComponent);
