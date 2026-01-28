import * as React from 'react';
import { Label, Tooltip } from '@patternfly/react-core';
import { AmbientBadge } from './AmbientBadge';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { useKialiTranslation } from 'utils/I18nUtils';
import { useKialiTheme } from 'utils/ThemeUtils';
import { Theme } from 'types/Common';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

// Tooltip has reversed theme (light theme = dark background), so link colors are inverted
const badgeTooltipLinkStyle = kialiStyle({
  display: 'flex',
  justifyContent: 'center',
  marginTop: '0.75rem',
  $nest: {
    '& > span': {
      marginRight: '0.5rem'
    }
  }
});

interface ControlPlaneBadgeProps {
  isAmbient?: boolean;
}

export const ControlPlaneBadge: React.FC<ControlPlaneBadgeProps> = (props: ControlPlaneBadgeProps) => {
  const { t } = useKialiTranslation();
  const { pathname } = useLocation();

  // Tooltip has reversed theme (light theme = dark background), so link colors are inverted
  const darkTheme = useKialiTheme() === Theme.DARK;
  const linkColor = darkTheme ? PFColors.LinkTooltipDarkTheme : PFColors.LinkTooltipLightTheme;

  // Remote clusters do not have istio status because istio is not running there
  // so don't display istio status badge for those.
  return (
    <>
      <Tooltip
        content={
          <>
            <span>{t('Istio control plane')}</span>
            {!pathname.endsWith('/mesh') && (
              <div className={badgeTooltipLinkStyle}>
                <span>{t('More info at')}</span>
                <Link to="/mesh" style={{ color: linkColor }}>
                  {t('Mesh page')}
                </Link>
              </div>
            )}
          </>
        }
      >
        <Label style={{ marginLeft: '0.5rem' }} color="green" isCompact data-test="control-plane-badge">
          {t('CP')}
        </Label>
      </Tooltip>

      {props.isAmbient && (
        <AmbientBadge tooltip={t('Istio Ambient ztunnel detected in the Control plane')}></AmbientBadge>
      )}
    </>
  );
};
