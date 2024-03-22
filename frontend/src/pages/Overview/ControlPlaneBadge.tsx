import { Label } from '@patternfly/react-core';
import * as React from 'react';
import { IstioStatusInline } from '../../components/IstioStatus/IstioStatusInline';
import { serverConfig } from '../../config';
import { AmbientBadge } from '../../components/Ambient/AmbientBadge';
import { RemoteClusterBadge } from './RemoteClusterBadge';
import { isRemoteCluster } from './OverviewCardControlPlaneNamespace';
import { useTranslation } from 'react-i18next';
import { I18N_NAMESPACE } from 'types/Common';

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
      <Label style={{ marginLeft: '0.5rem' }} color="green" isCompact>
        {t('Control plane')}
      </Label>

      {isRemoteCluster(props.annotations) && <RemoteClusterBadge />}

      {serverConfig.ambientEnabled && (
        <AmbientBadge tooltip={t('Istio Ambient ztunnel detected in the Control plane')}></AmbientBadge>
      )}

      {!isRemoteCluster(props.annotations) && <IstioStatusInline cluster={props.cluster} />}
    </>
  );
};
