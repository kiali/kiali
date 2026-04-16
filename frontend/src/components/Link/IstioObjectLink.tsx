import * as React from 'react';
import { isMultiCluster, Paths } from '../../config';
import { GVKToBadge } from '../VirtualList/Config';
import { PFBadge } from 'components/Pf/PfBadges';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { GroupVersionKind } from '../../types/IstioObjects';
import { getGVKTypeString, kindToStringIncludeK8s } from '../../utils/IstioConfigUtils';
import { classes } from 'typestyle';
import { infoStyle } from 'styles/IconStyle';
import { KialiLink } from './KialiLink';

const objectInfoStyle = kialiStyle({
  marginBottom: '-0.125rem',
  marginRight: '0',
  marginTop: '0'
});

type ReferenceIstioObjectProps = {
  cluster?: string;
  name: string;
  namespace: string;
  objectGVK: GroupVersionKind;
  query?: string;
  subType?: string;
};

type IstioObjectProps = ReferenceIstioObjectProps & {
  children: React.ReactNode;
};

export const GetIstioObjectUrl = (
  name: string,
  namespace: string,
  objectGVK: GroupVersionKind,
  cluster?: string,
  query?: string
): string => {
  let to = `/namespaces/${namespace}/${Paths.ISTIO}`;

  to = `${to}/${objectGVK.Group}/${objectGVK.Version}/${objectGVK.Kind}/${name}`;

  if (cluster && isMultiCluster) {
    to = `${to}?clusterName=${cluster}`;
  }

  if (!!query) {
    if (to.includes('?')) {
      to = `${to}&${query}`;
    } else {
      to = `${to}?${query}`;
    }
  }

  return to;
};

export const ReferenceIstioObjectLink: React.FC<ReferenceIstioObjectProps> = (props: ReferenceIstioObjectProps) => {
  const { name, namespace, cluster, objectGVK, subType } = props;
  const badge = GVKToBadge[getGVKTypeString(objectGVK)];

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
      <PFBadge badge={badge} position={TooltipPosition.top} />

      {showLink && (
        <IstioObjectLink name={name} namespace={namespace} cluster={cluster} objectGVK={objectGVK} subType={subType}>
          {reference}
        </IstioObjectLink>
      )}

      {!showLink && <div style={{ display: 'inline-block' }}>{reference}</div>}

      {showTooltip && (
        <Tooltip position={TooltipPosition.right} content={<div style={{ textAlign: 'left' }}>{tooltipMsg}</div>}>
          <KialiIcon.Info className={classes(infoStyle, objectInfoStyle)} />
        </Tooltip>
      )}
    </>
  );
};

export const IstioObjectLink: React.FC<IstioObjectProps> = (props: IstioObjectProps) => {
  const { name, namespace, objectGVK, cluster, query } = props;
  const href = GetIstioObjectUrl(name, namespace, objectGVK, cluster, query);

  return (
    // @TODO put cluster in link when all objects have multicluster support
    <KialiLink to={href} dataTest={`${kindToStringIncludeK8s(objectGVK.Group, objectGVK.Kind)}-${namespace}-${name}`}>
      {props.children}
    </KialiLink>
  );
};
