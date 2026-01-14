import { Label, Tooltip } from '@patternfly/react-core';
import * as React from 'react';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { useKialiTranslation } from 'utils/I18nUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';

// Tooltip has reversed theme (light theme = dark background), so link colors are inverted
const badgeTooltipLinkStyle = kialiStyle({
  display: 'flex',
  justifyContent: 'center',
  marginTop: '0.75rem',
  $nest: {
    '& > span': {
      marginRight: '0.5rem'
    },
    '& a': {
      color: PFColors.Link
    }
    // '.pf-v6-theme-dark & a': {
    //   color: PFColors.Blue500
    // }
  }
});

type Props = {
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
            <div className={badgeTooltipLinkStyle}>
              <span>{t('More info at')}</span>
              <Link to="/mesh">{t('Mesh page')}</Link>
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
