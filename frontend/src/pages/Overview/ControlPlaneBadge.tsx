import { Label, Tooltip } from '@patternfly/react-core';
import * as React from 'react';
import { IstioStatusInline } from '../../components/IstioStatus/IstioStatusInline';
import { config, serverConfig } from '../../config';
import { AmbientBadge } from '../../components/Ambient/AmbientBadge';
import { RemoteClusterBadge } from './RemoteClusterBadge';
import { isRemoteCluster } from './OverviewCardControlPlaneNamespace';
import { useTranslation } from 'react-i18next';
import { I18N_NAMESPACE } from 'types/Common';
import { Link } from 'react-router-dom';

type Props = {
  annotations?: { [key: string]: string };
  cluster?: string;
};

export const ControlPlaneBadge: React.FC<Props> = (props: Props) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  // Remote clusters do not have istio status because istio is not running there
  // so don't display istio status badge for those.
  return (
    <>
      <Tooltip
        content={
          <Link id="mesh" to={config.about.mesh.url}>
            {config.about.mesh.linkText}
          </Link>
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

      {!isRemoteCluster(props.annotations) && <IstioStatusInline cluster={props.cluster} />}
    </>
  );
};
