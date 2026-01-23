import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle, Label, Spinner, Tooltip } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { useNamespaces } from 'hooks/namespaces';
import { Namespace } from 'types/Namespace';
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

const hasIstioInjection = (ns: Namespace): boolean => {
  return !!ns.labels && (ns.labels['istio-injection'] === 'enabled' || !!ns.labels['istio.io/rev']);
};

export const NamespaceStats: React.FC = () => {
  const { isLoading, namespaces } = useNamespaces();

  // Calculate stats from namespaces
  const total = namespaces.length;
  let ambient = 0;
  let sidecar = 0;
  let outOfMesh = 0;
  let healthy = 0;
  let unhealthy = 0;

  namespaces.forEach(ns => {
    // Don't count control plane namespaces in the injection stats
    if (!ns.isControlPlane) {
      if (ns.isAmbient) {
        ambient++;
      } else if (hasIstioInjection(ns)) {
        sidecar++;
      } else {
        outOfMesh++;
      }
    }

    // Note: Basic namespace API doesn't include health status.
    // For now, we'll just count all as healthy
    healthy++;
  });

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>
          {t('Namespaces')} ({total}){' '}
          <Tooltip content={t('Display Istio config types for all namespaces')}>
            <KialiIcon.Info className={infoStyle} />
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {isLoading ? (
          <Spinner size="lg" />
        ) : (
          <div className={namespaceContainerStyle}>
            <div className={statsContainerStyle}>
              {healthy > 0 && (
                <div className={statItemStyle}>
                  <span>{healthy}</span>
                  <KialiIcon.Success />
                </div>
              )}
              {unhealthy > 0 && (
                <div className={statItemStyle}>
                  <span>{unhealthy}</span>
                  <KialiIcon.Warning />
                </div>
              )}
            </div>
            <div className={verticalDividerStyle} />
            <div className={labelsContainerStyle}>
              <div className={labelGroupStyle}>
                {ambient > 0 && (
                  <div className={labelItemStyle}>
                    <span className={labelNumberStyle}>{ambient}</span>{' '}
                    <Label variant="outline" className={labelStyle}>
                      {t('Ambient')}
                    </Label>
                  </div>
                )}
                {sidecar > 0 && (
                  <div className={labelItemStyle}>
                    <span className={labelNumberStyle}>{sidecar}</span>{' '}
                    <Label variant="outline" className={labelStyle}>
                      {t('Sidecar')}
                    </Label>
                  </div>
                )}
                {outOfMesh > 0 && (
                  <div className={labelItemStyle}>
                    <span className={labelNumberStyle}>{outOfMesh}</span>{' '}
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
        <Link to={`/${Paths.NAMESPACES}`} className={linkStyle}>
          {t('View Namespaces')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
