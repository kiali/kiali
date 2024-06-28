import * as React from 'react';
import { isMultiCluster, Paths } from '../../config';
import { Link } from 'react-router-dom-v5-compat';
import { IstioTypes } from '../VirtualList/Config';
import { PFBadge } from 'components/Pf/PfBadges';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskContextMenuAction } from '../Kiosk/KioskActions';

export const infoStyle = kialiStyle({
  margin: '0 0 -0.125rem 0.5rem'
});

type ReduxProps = {
  kiosk: string;
};

type ReferenceIstioObjectProps = {
  cluster?: string;
  name: string;
  namespace: string;
  query?: string;
  subType?: string;
  type: string;
};

type IstioObjectProps = ReduxProps &
  ReferenceIstioObjectProps & {
    children: React.ReactNode;
  };

export const GetIstioObjectUrl = (
  name: string,
  namespace: string,
  type: string,
  cluster?: string,
  query?: string
): string => {
  const istioType = IstioTypes[type];
  let to = `/namespaces/${namespace}/${Paths.ISTIO}`;

  to = `${to}/${istioType.url}/${name}`;

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
  const { name, namespace, cluster, type, subType } = props;
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
        <IstioObjectLink name={name} namespace={namespace} cluster={cluster} type={type} subType={subType}>
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
};

const IstioObjectLinkComponent: React.FC<IstioObjectProps> = (props: IstioObjectProps) => {
  const { name, namespace, type, cluster, query } = props;
  const href = GetIstioObjectUrl(name, namespace, type, cluster, query);

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
    <Link to={href} data-test={`${type}-${namespace}-${name}`}>
      {props.children}
    </Link>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

export const IstioObjectLink = connect(mapStateToProps)(IstioObjectLinkComponent);
