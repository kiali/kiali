import { Label, Tooltip } from '@patternfly/react-core';
import * as React from 'react';
import { serverConfig } from '../../config';
import { AmbientBadge } from '../../components/Ambient/AmbientBadge';
import { RemoteClusterBadge } from './RemoteClusterBadge';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { meshLinkStyle } from 'components/IstioStatus/IstioStatus';
import { useKialiTranslation } from 'utils/I18nUtils';
import { isRemoteCluster } from 'pages/Mesh/target/TargetPanelControlPlane';

type Props = {
  annotations?: { [key: string]: string };
  cluster?: string;
};

export const ControlPlaneBadge: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();
  const { pathname } = useLocation();

  // Remote clusters do not have istio status because istio is not running there
  // so don't display istio status badge for those.
  return (
    <>
      <Tooltip
        content={
          <>
            <span>{t('Istio control plane')}</span>
            {!pathname.endsWith('/mesh') && (
              <div className={meshLinkStyle}>
                <span>{t('More info at')}</span>
                <Link to="/mesh">{t('Mesh page')}</Link>
              </div>
            )}
          </>
        }
      >
        <Label style={{ marginLeft: '0.5rem' }} color="green" isCompact>
          {t('Control plane')}
        </Label>
      </Tooltip>

      {isRemoteCluster(props.annotations) && props.cluster && <RemoteClusterBadge cluster={props.cluster} />}

      {serverConfig.ambientEnabled && (
        <AmbientBadge tooltip={t('Istio Ambient ztunnel detected in the Control plane')}></AmbientBadge>
      )}
    </>
  );
};
