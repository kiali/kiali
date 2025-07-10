import { Label, Tooltip } from '@patternfly/react-core';
import * as React from 'react';
import { serverConfig } from '../../config';
import { AmbientBadge } from '../../components/Ambient/AmbientBadge';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { meshLinkStyle } from 'components/IstioStatus/IstioStatus';
import { useKialiTranslation } from 'utils/I18nUtils';

export const ControlPlaneBadge: React.FC = () => {
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
        <Label style={{ marginLeft: '0.5rem' }} color="green" isCompact data-test="control-plane-badge">
          {t('Control plane')}
        </Label>
      </Tooltip>

      {serverConfig.ambientEnabled && (
        <AmbientBadge tooltip={t('Istio Ambient ztunnel detected in the Control plane')}></AmbientBadge>
      )}
    </>
  );
};
