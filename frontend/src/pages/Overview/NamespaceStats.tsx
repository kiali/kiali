import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle, Label, Spinner, Tooltip } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { t } from 'utils/I18nUtils';
import { useNamespaceStatus } from 'hooks/namespaces';
import { infoStyle } from 'styles/IconStyle';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle, statsContainerStyle, statItemStyle } from './OverviewStyles';

const namespaceContainerStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '2rem'
});

const verticalDividerStyle = kialiStyle({
  borderLeft: `1px solid ${PFColors.BorderColor100}`,
  height: '2rem',
  alignSelf: 'center'
});

const labelsContainerStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
});

const labelGroupStyle = kialiStyle({
  display: 'flex',
  gap: '1rem',
  flexWrap: 'wrap'
});

const labelItemStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem'
});

const labelNumberStyle = kialiStyle({
  fontSize: '1.5rem'
});

const labelStyle = kialiStyle({
  marginTop: '0.5rem',
  marginBottom: '0.5rem'
});

export const NamespaceStats: React.FC = () => {
  const namespaceStats = useNamespaceStatus();

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>
          {t('Namespaces')} ({namespaceStats.total}){' '}
          <Tooltip content={t('Display Istio config types for all namespaces')}>
            <KialiIcon.Info className={infoStyle} />
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {namespaceStats.isLoading ? (
          <Spinner size="lg" />
        ) : (
          <div className={namespaceContainerStyle}>
            <div className={statsContainerStyle}>
              {namespaceStats.healthy > 0 && (
                <div className={statItemStyle}>
                  <span>{namespaceStats.healthy}</span>
                  <KialiIcon.Success />
                </div>
              )}
              {namespaceStats.warnings > 0 && (
                <div className={statItemStyle}>
                  <span>{namespaceStats.warnings}</span>
                  <KialiIcon.Warning />
                </div>
              )}
            </div>
            <div className={verticalDividerStyle} />
            <div className={labelsContainerStyle}>
              <div className={labelGroupStyle}>
                {namespaceStats.ambient > 0 && (
                  <div className={labelItemStyle}>
                    <span className={labelNumberStyle}>{namespaceStats.ambient}</span>{' '}
                    <Label variant="outline" className={labelStyle}>
                      {t('Ambient')}
                    </Label>
                  </div>
                )}
                {namespaceStats.sidecar > 0 && (
                  <div className={labelItemStyle}>
                    <span className={labelNumberStyle}>{namespaceStats.sidecar}</span>{' '}
                    <Label variant="outline" className={labelStyle}>
                      {t('Sidecar')}
                    </Label>
                  </div>
                )}
                {namespaceStats.outOfMesh > 0 && (
                  <div className={labelItemStyle}>
                    <span className={labelNumberStyle}>{namespaceStats.outOfMesh}</span>{' '}
                    <Label variant="outline" className={labelStyle}>
                      {t('Out of mesh')}
                    </Label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardBody>
      <CardFooter>
        <Link to="/legacy-overview" className={linkStyle}>
          {t('View Namespaces')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
