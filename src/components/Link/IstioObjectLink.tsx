import * as React from 'react';
import { Paths } from '../../config';
import { Link } from 'react-router-dom';
import { Badge, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { IstioTypes } from '../VirtualList/Config';

interface Props {
  name: string;
  namespace: string;
  type: string;
  subType?: string;
  query?: string;
}

export const GetIstioObjectUrl = (
  name: string,
  namespace: string,
  type: string,
  subType?: string,
  query?: string
): string => {
  const istioType = IstioTypes[type];
  let to = '/namespaces/' + namespace + '/' + Paths.ISTIO;

  if (!!subType) {
    to = to + '/' + istioType + '/' + subType + '/' + name;
  } else {
    to = to + '/' + istioType.url + '/' + name;
  }

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
        <Tooltip position={TooltipPosition.top} content={<>{istioType.name}</>}>
          <Badge className={'virtualitem_badge_definition'}>{istioType.icon}</Badge>
        </Tooltip>
        <IstioObjectLink name={name} namespace={namespace} type={type} subType={subType}>
          {namespace}/{name}
        </IstioObjectLink>
      </>
    );
  }
}

class IstioObjectLink extends React.Component<Props> {
  render() {
    const { name, namespace, type, subType, query } = this.props;

    return <Link to={GetIstioObjectUrl(name, namespace, type, subType, query)}>{this.props.children}</Link>;
  }
}

export default IstioObjectLink;
