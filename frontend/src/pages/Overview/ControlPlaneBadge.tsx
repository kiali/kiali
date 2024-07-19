import { Label, Tooltip } from '@patternfly/react-core';
import * as React from 'react';
import { serverConfig } from '../../config';
import { AmbientBadge } from '../../components/Ambient/AmbientBadge';
import { RemoteClusterBadge } from './RemoteClusterBadge';
import { isRemoteCluster } from './OverviewCardControlPlaneNamespace';
import { Link, useLocation } from 'react-router-dom';
import { IstioStatus, meshLinkStyle } from 'components/IstioStatus/IstioStatus';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon
} from '@patternfly/react-icons';
import { useKialiTranslation } from 'utils/I18nUtils';

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
      {isRemoteCluster(props.annotations) && <RemoteClusterBadge />}
      {serverConfig.ambientEnabled && (
        <AmbientBadge tooltip={t('Istio Ambient ztunnel detected in the Control plane')}></AmbientBadge>
      )}
      // @TODO for remote cluster
      {!isRemoteCluster(props.annotations) && (
        <IstioStatus
          icons={{
            ErrorIcon: ExclamationCircleIcon,
            HealthyIcon: CheckCircleIcon,
            InfoIcon: MinusCircleIcon,
            WarningIcon: ExclamationTriangleIcon
          }}
          cluster={props.cluster}
          location={pathname}
        />
      )}
    </>
  );
};
