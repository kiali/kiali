import * as React from 'react';
import { Paths } from '../../config';
import { Link } from 'react-router-dom';
import { IstioTypes } from '../VirtualList/Config';
import { PFBadge } from 'components/Pf/PfBadges';
import { TooltipPosition } from '@patternfly/react-core';

interface Props {
  name: string;
  namespace: string;
  type: string;
  subType?: string;
  query?: string;
}

export const GetIstioObjectUrl = (name: string, namespace: string, type: string, query?: string): string => {
  const istioType = IstioTypes[type];
  let to = '/namespaces/' + namespace + '/' + Paths.ISTIO;

  to = to + '/' + istioType.url + '/' + name;

  if (!!query) {
    to = to + '?' + query;
  }

  return to;
};

export class ReferenceIstioObjectLink extends React.Component<Props> {
  render() {
    const { name, namespace, type, subType } = this.props;
    const istioType = IstioTypes[type];

    return (
      <>
        <PFBadge badge={istioType.badge} position={TooltipPosition.top} />
        <IstioObjectLink name={name} namespace={namespace} type={type} subType={subType}>
          {namespace}/{name}
        </IstioObjectLink>
      </>
    );
  }
}

class IstioObjectLink extends React.Component<Props> {
  render() {
    const { name, namespace, type, query } = this.props;

    return <Link to={GetIstioObjectUrl(name, namespace, type, query)}>{this.props.children}</Link>;
  }
}

export default IstioObjectLink;
