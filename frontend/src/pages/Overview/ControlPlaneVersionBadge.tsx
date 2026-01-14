import { Label, Tooltip } from '@patternfly/react-core';
import * as React from 'react';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { useKialiTranslation } from 'utils/I18nUtils';
import { badgeTooltipLinkStyle } from './ControlPlaneBadge';
import { useKialiTheme } from 'utils/ThemeUtils';
import { Theme } from 'types/Common';
import { PFColors } from 'components/Pf/PfColors';

type Props = {
  version: string;
};

export const ControlPlaneVersionBadge: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();
  const { pathname } = useLocation();

  // Tooltip has reversed theme (light theme = dark background), so link colors are inverted
  const darkTheme = useKialiTheme() === Theme.DARK;
  const linkColor = darkTheme ? PFColors.LinkTooltipDarkTheme : PFColors.LinkTooltipLightTheme;

  return (
    <Tooltip
      content={
        <>
          <span>{t('Istio revision {{version}}', { version: props.version })}</span>
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
      maxWidth="25rem"
    >
      <Label style={{ marginLeft: '0.5rem' }} color={'orange'} isCompact data-test="control-plane-revision-badge">
        {props.version}
      </Label>
    </Tooltip>
  );
};
