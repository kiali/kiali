import * as React from 'react';
import { Paths } from '../../config';
import { Link } from 'react-router-dom';
import { IstioTypes } from '../VirtualList/Config';
import { PFBadge } from 'components/Pf/PfBadges';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { style } from 'typestyle';

export const infoStyle = style({
  margin: '0px 0px -2px 3px'
});

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
    let showLink = true;
    let showTooltip = false;
    let tooltipMsg: string | undefined = undefined;
    let reference = `${namespace}/${name}`;

    if (name === 'mesh') {
      reference = name;
      showLink = false;
      showTooltip = true;
      tooltipMsg = 'The reserved word, "mesh", implies all of the sidecars in the mesh';
    }

    return (
      <>
        <PFBadge badge={istioType.badge} position={TooltipPosition.top} />
        {showLink && (
          <IstioObjectLink name={name} namespace={namespace} type={type} subType={subType}>
            {reference}
          </IstioObjectLink>
        )}
        {!showLink && <div style={{ display: 'inline-block' }}>{reference}</div>}
        {showTooltip && (
          <Tooltip position={TooltipPosition.right} content={<div style={{ textAlign: 'left' }}>{tooltipMsg}</div>}>
            <KialiIcon.Info className={infoStyle} />
          </Tooltip>
        )}
      </>
    );
  }
}

class IstioObjectLink extends React.Component<Props> {
  render() {
    const { name, namespace, type, query } = this.props;

    return <Link to={GetIstioObjectUrl(name, namespace, type, query)} data-test={type + '-' + namespace + '-' + name}>{this.props.children}</Link>;
  }
}

export default IstioObjectLink;
