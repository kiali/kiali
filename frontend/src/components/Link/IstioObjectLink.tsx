import * as React from 'react';
import { isMultiCluster, Paths } from '../../config';
import { Link } from 'react-router-dom-v5-compat';
import { GVKToBadge } from '../VirtualList/Config';
import { PFBadge } from 'components/Pf/PfBadges';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskContextMenuAction } from '../Kiosk/KioskActions';
import { GroupVersionKind } from '../../types/IstioObjects';
import { getGVKTypeString, kindToStringIncludeK8s } from '../../utils/IstioConfigUtils';
import { infoStyleProps } from 'styles/IconStyle';

const objectInfoStyle = kialiStyle({
  ...infoStyleProps,
  marginBottom: '-0.125rem',
  marginRight: '0',
  marginTop: '0'
});

type ReduxProps = {
  kiosk: string;
};

type ReferenceIstioObjectProps = {
  cluster?: string;
  name: string;
  namespace: string;
  objectGVK: GroupVersionKind;
  query?: string;
  subType?: string;
};

type IstioObjectProps = ReduxProps &
  ReferenceIstioObjectProps & {
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
          <KialiIcon.Info className={objectInfoStyle} />
        </Tooltip>
      )}
    </>
  );
};

const IstioObjectLinkComponent: React.FC<IstioObjectProps> = (props: IstioObjectProps) => {
  const { name, namespace, objectGVK, cluster, query } = props;
  const href = GetIstioObjectUrl(name, namespace, objectGVK, cluster, query);

  return isParentKiosk(props.kiosk) ? (
    <Link
      to=""
      onClick={() => {
        kioskContextMenuAction(href);
      }}
    >
      {props.children}
    </Link>
  ) : (
    // @TODO put cluster in link when all objects have multicluster support
    <Link to={href} data-test={`${kindToStringIncludeK8s(objectGVK.Group, objectGVK.Kind)}-${namespace}-${name}`}>
      {props.children}
    </Link>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

export const IstioObjectLink = connect(mapStateToProps)(IstioObjectLinkComponent);
