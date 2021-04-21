import * as React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { serverConfig } from '../../config';

interface KialiPageLinkProps {
  cluster?: string;
  href: string;
}

const KialiPageLink: React.FC<KialiPageLinkProps> = props => {
  // Without a cluster, simply render a local link
  if (props.cluster === undefined) {
    return <Link to={props.href}>{props.children}</Link>;
  }

  // If cluster is specified, and it's the home cluster, render a local link.
  if (!serverConfig.clusterInfo?.name || props.cluster === serverConfig.clusterInfo.name) {
    return <Link to={props.href}>{props.children}</Link>;
  }

  // If it's a remote cluster, check if there is an accessible Kiali on that cluster.
  // If there is, render an external link. Else, render plain text.
  const clusterInfo = serverConfig.clusters[props.cluster];
  const kialiInstance = clusterInfo?.kialiInstances?.find(instance => instance.url.length !== 0);

  if (kialiInstance === undefined) {
    return props.children as React.ReactElement<any>;
  } else {
    const href = kialiInstance.url.replace(/\/$/g, '') + '/console' + props.href;
    return (
      <a href={href} rel="noreferrer noopener" target="_blank">
        {props.children} <ExternalLinkAltIcon />
      </a>
    );
  }
};

export default KialiPageLink;
