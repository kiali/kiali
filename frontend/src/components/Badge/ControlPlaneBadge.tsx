import * as React from 'react';
import { Badge, Label, Tooltip } from '@patternfly/react-core';
import { useLocation } from 'react-router-dom-v5-compat';
import { KialiLink } from '../Link/KialiLink';
import { useKialiTranslation } from 'utils/I18nUtils';
import { useKialiTheme } from 'utils/ThemeUtils';
import { Theme } from 'types/Common';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

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

const cpOvalLabelStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-label__content': {
      borderRadius: '9999px',
      paddingRight: '0.125rem'
    }
  }
});

const cpLabelContentStyle = kialiStyle({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  lineHeight: 1
});

const COUNT_BADGE_COLOR = PFColors.Purple50;

const countBadgeColorStyle: React.CSSProperties = {
  ['--pf-v6-c-badge--BackgroundColor' as string]: COUNT_BADGE_COLOR,
  ['--pf-v6-c-badge--BorderColor' as string]: COUNT_BADGE_COLOR,
  ['--pf-v6-c-badge--Color' as string]: PFColors.White
};

const countBadgeStyle = kialiStyle({
  margin: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  height: '1em',
  minWidth: '1.5em',
  padding: '0 0.5em',
  borderRadius: '9999px',
  fontSize: 'inherit',
  lineHeight: 1
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
  const hasMultiple = count > 1;

  const badge = hasMultiple ? (
    <Label className={cpOvalLabelStyle} color="green" isCompact data-test="control-plane-badge">
      <span className={cpLabelContentStyle}>
        {t('CP')}
        <Badge className={countBadgeStyle} data-test="control-plane-count-pill" style={countBadgeColorStyle}>
          {count}
        </Badge>
      </span>
    </Label>
  ) : (
    <Label color="green" isCompact data-test="control-plane-badge">
      {t('CP')}
    </Label>
  );

  return (
    <Tooltip
      content={
        <>
          {hasMultiple ? (
            <div style={{ textAlign: 'left' }}>
              <div>{t('Istio control planes ({{count}}):', { count })}</div>
              <div style={{ marginTop: '0.5rem' }}>
                {(revisions ?? []).map(rev => (
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
      {badge}
    </Tooltip>
  );
};
