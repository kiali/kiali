import * as React from 'react';
import { Label, Tooltip } from '@patternfly/react-core';
import { useLocation } from 'react-router-dom-v5-compat';
import { KialiLink } from '../Link/KialiLink';
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
  revisions?: string[];
}

export const ControlPlaneBadge: React.FC<ControlPlaneBadgeProps> = ({ revisions }) => {
  const { t } = useKialiTranslation();
  const { pathname } = useLocation();

  const darkTheme = useKialiTheme() === Theme.DARK;
  const linkColor = darkTheme ? PFColors.LinkTooltipDarkTheme : PFColors.LinkTooltipLightTheme;

  const count = revisions ? revisions.length : 1;

  return (
    <>
      <Tooltip
        content={
          <>
            {count > 1 ? (
              <div style={{ textAlign: 'left' }}>
                <div>{t('Istio control planes ({{count}}):', { count })}</div>
                <div style={{ marginTop: '0.5rem' }}>
                  {revisions!.map(rev => (
                    <div key={rev}>{t('Revision: {{revision}}', { revision: rev })}</div>
                  ))}
                </div>
              </div>
            ) : (
              <span>{t('Istio control plane')}</span>
            )}
            {!pathname.endsWith('/mesh') && (
              <div className={badgeTooltipLinkStyle}>
                <span>{t('More info at')}</span>
                <KialiLink to="/mesh" style={{ color: linkColor }}>
                  {t('Mesh page')}
                </KialiLink>
              </div>
            )}
          </>
        }
      >
        <Label color="green" isCompact data-test="control-plane-badge">
          {count > 1 ? t('CP ({{count}})', { count }) : t('CP')}
        </Label>
      </Tooltip>
    </>
  );
};
