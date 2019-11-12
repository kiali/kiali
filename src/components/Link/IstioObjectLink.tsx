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
}

const IstioObjectLink = (props: Props) => {
  const { name, namespace, type, subType } = props;
  const istioType = IstioTypes[type];
  let to = '/namespaces/' + namespace + '/' + Paths.ISTIO;

  if (!!subType) {
    to = to + '/' + istioType + '/' + subType + '/' + name;
  } else {
    to = to + '/' + istioType.url + '/' + name;
  }

  return (
    <>
      <Tooltip position={TooltipPosition.top} content={<>{istioType.name}</>}>
        <Badge className={'virtualitem_badge_definition'}>{istioType.icon}</Badge>
      </Tooltip>
      <Link to={to}>
        {namespace}/{name}
      </Link>
    </>
  );
};

export default IstioObjectLink;
