import * as React from 'react';
import { isMultiCluster, Paths } from '../../config';
import { Link } from 'react-router-dom';
import { IstioTypes } from '../VirtualList/Config';
import { PFBadge } from 'components/Pf/PfBadges';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { style } from 'typestyle';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskContextMenuAction } from '../Kiosk/KioskActions';

export const infoStyle = style({
  margin: '0px 0px -2px 3px'
});

type ReduxProps = {
  kiosk: string;
};

type ReferenceIstioObjectProps = {
  name: string;
  namespace: string;
  cluster: string;
  type: string;
  subType?: string;
  query?: string;
};

type IstioObjectProps = ReduxProps &
  ReferenceIstioObjectProps & {
    children: React.ReactNode;
  };

export const GetIstioObjectUrl = (
  name: string,
  namespace: string,
  cluster: string,
  type: string,
  query?: string
): string => {
  const istioType = IstioTypes[type];
  let to = '/namespaces/' + namespace + '/' + Paths.ISTIO;

  to = to + '/' + istioType.url + '/' + name;

  if (cluster && isMultiCluster()) {
    to = to + '?cluster=' + cluster;
  }

  if (!!query) {
    if (to.includes('?')) {
      to = to + '&' + query;
    } else {
      to = to + '?' + query;
    }
  }

  return to;
};

export class ReferenceIstioObjectLink extends React.Component<ReferenceIstioObjectProps> {
  render() {
    const { name, namespace, cluster, type, subType } = this.props;
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
          <IstioObjectLinkContainer name={name} namespace={namespace} cluster={cluster} type={type} subType={subType}>
            {reference}
          </IstioObjectLinkContainer>
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

class IstioObjectLink extends React.Component<IstioObjectProps> {
  render() {
    const { name, namespace, cluster, type, query } = this.props;
    const href = GetIstioObjectUrl(name, namespace, cluster, type, query);
    return isParentKiosk(this.props.kiosk) ? (
      <Link
        to={''}
        onClick={() => {
          kioskContextMenuAction(href);
        }}
      >
        {this.props.children}
      </Link>
    ) : (
      // @TODO put cluster in link when all objects have multicluster support
      <Link to={href} data-test={type + '-' + namespace + '-' + name}>
        {this.props.children}
      </Link>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk
});

const IstioObjectLinkContainer = connect(mapStateToProps)(IstioObjectLink);
export default IstioObjectLinkContainer;
