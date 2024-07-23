import { Label, Tooltip } from '@patternfly/react-core';
import { meshLinkStyle } from 'components/IstioStatus/IstioStatus';
import * as React from 'react';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { useKialiTranslation } from 'utils/I18nUtils';

type Props = {
  isCanary: boolean;
  version: string;
};

export const ControlPlaneVersionBadge: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();
  const { pathname } = useLocation();

  return (
    <Tooltip
      content={
        <>
          <span>{t('Istio revision {{version}}', { version: props.version })}</span>
          {!pathname.endsWith('/mesh') && (
            <div className={meshLinkStyle}>
              <span>{t('More info at')}</span>
              <Link to="/mesh">{t('Mesh page')}</Link>
            </div>
          )}
        </>
      }
      maxWidth="25rem"
    >
      <Label style={{ marginLeft: '0.5rem' }} color={props.isCanary ? 'blue' : 'orange'} isCompact>
        {props.version}
      </Label>
    </Tooltip>
  );
};
