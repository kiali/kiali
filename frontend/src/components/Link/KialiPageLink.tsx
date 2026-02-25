import * as React from 'react';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { serverConfig } from '../../config';
import { isConfiguredCluster, isHomeCluster } from 'config/ServerConfig';
import { KialiLink } from './KialiLink';

type KialiPageLinkProps = {
  children: React.ReactNode;
  cluster?: string;
  href: string;
};

export const KialiPageLink: React.FC<KialiPageLinkProps> = (props: KialiPageLinkProps) => {
  // If not a remote cluster, simply render a local link
  if (!props.cluster || isHomeCluster(props.cluster)) {
    return <KialiLink to={props.href}>{props.children}</KialiLink>;
  }

  // If it's a cluster configured for this Kiali instance
  if (isConfiguredCluster(props.cluster)) {
    const href = `${props.href}?clusterName=${encodeURIComponent(props.cluster)}`;
    return <KialiLink to={href}>{props.children}</KialiLink>;
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
