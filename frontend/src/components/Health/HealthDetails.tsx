import * as React from 'react';
import * as H from '../../types/Health';
import { PFColors } from '../Pf/PfColors';
import { Title, TitleSizes } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { createIcon } from 'config/KialiIcon';
import { ToleranceConfig } from 'types/ServerConfig';
import { t } from 'utils/I18nUtils';

interface HealthDetailsProps {
  health: H.Health;
}

const titleStyle = kialiStyle({
  margin: '1rem 0 0.5rem 0'
});

/** Text for error-share threshold; 0 matches server logic (any positive error rate counts for that tier). */
const trafficErrorShareRule = (thresholdPct: number): string =>
  thresholdPct === 0 ? t('more than 0%') : t('at least {{n}}%', { n: String(thresholdPct) });

const trafficFailureRule = (failurePct: number): string =>
  failurePct === 0 ? t('not used') : trafficErrorShareRule(failurePct);

const renderTrafficThresholdLegend = (config: ToleranceConfig): React.ReactNode => (
  <li
    key="traffic_threshold_legend"
    style={{
      borderTop: `1px solid ${PFColors.BorderColor100}`,
      listStyle: 'none',
      marginTop: '0.5rem',
      paddingTop: '0.5rem'
    }}
  >
    <div style={{ color: PFColors.Color200, fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
      {t('Error-rate limits for traffic health:')}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.875rem', gap: '0.2rem' }}>
      <div>
        <span style={{ marginRight: '0.35rem' }}>{createIcon(H.DEGRADED)}</span>
        <strong>{t('Degraded')}</strong>
        {` — ${trafficErrorShareRule(config.degraded)}`}
      </div>
      <div>
        <span style={{ marginRight: '0.35rem' }}>{createIcon(H.FAILURE)}</span>
        <strong>{t('Failure')}</strong>
        {` — ${trafficFailureRule(config.failure)}`}
      </div>
    </div>
  </li>
);

// Used in App/Workload/Service Description
// It doesn't hide healthy lines as opposed to the HealthDetails
// Keep it on this class for easy maintenance in future steps, duplication of code is expected.
export const renderTrafficStatus = (health: H.Health): React.ReactNode => {
  const config = health.getStatusConfig();
  const isValueInConfig = config && health.health.statusConfig ? health.health.statusConfig.value > 0 : false;
  const item = health.getTrafficStatus();

  if (item) {
    const showTraffic = item.children
      ? item.children.filter(sub => {
          const showItem = sub.value && sub.value > 0;

          return sub.status !== H.HEALTHY && showItem;
        }).length > 0
      : false;

    if (showTraffic) {
      return (
        <div>
          <Title headingLevel="h5" size={TitleSizes.lg} className={titleStyle}>
            Traffic
          </Title>

          {item.text}

          {item.children && (
            <ul style={{ listStyleType: 'none' }}>
              {item.children.map((sub, subIdx) => {
                const showItem = sub.value && sub.value > 0;

                return sub.status !== H.HEALTHY && showItem ? (
                  <li key={subIdx}>
                    <span style={{ marginRight: '0.5rem' }}>{createIcon(sub.status)}</span>
                    {sub.text}
                  </li>
                ) : (
                  <React.Fragment key={subIdx} />
                );
              })}

              {config && isValueInConfig && renderTrafficThresholdLegend(config)}
            </ul>
          )}
        </div>
      );
    }
  }

  return undefined;
};

export const HealthDetails: React.FC<HealthDetailsProps> = (props: HealthDetailsProps) => {
  const renderErrorRate = (item: H.HealthItem, idx: number): React.ReactNode => {
    const config = props.health.getStatusConfig();

    const isValueInConfig =
      config && props.health.health.statusConfig ? props.health.health.statusConfig.value > 0 : false;

    const showTraffic = item.children
      ? item.children.filter(sub => {
          const showItem = sub.value && sub.value > 0;

          return showItem;
        }).length > 0
      : false;

    return showTraffic ? (
      <div key={idx}>
        {`${item.title}${item.text && item.text.length > 0 ? ': ' : ''} `}

        {item.text}

        {item.children && (
          <ul style={{ listStyleType: 'none' }}>
            {item.children.map((sub, subIdx) => {
              const showItem = sub.value && sub.value > 0;

              return showItem ? (
                <li key={subIdx}>
                  <span style={{ marginRight: '0.5rem' }}>{createIcon(sub.status)}</span>
                  {sub.text}
                </li>
              ) : (
                <React.Fragment key={subIdx} />
              );
            })}

            {config && isValueInConfig && renderTrafficThresholdLegend(config)}
          </ul>
        )}
      </div>
    ) : (
      <React.Fragment key={idx} />
    );
  };

  const renderChildren = (item: H.HealthItem, idx: number): React.ReactNode => {
    return item.type === H.HealthItemType.TRAFFIC_STATUS ? (
      renderErrorRate(item, idx)
    ) : (
      <div key={idx}>
        {<>{`${item.title}${item.text && item.text.length > 0 ? ': ' : ''}`}</>}

        {item.text}

        {item.children && (
          <ul style={{ listStyleType: 'none' }}>
            {item.children.map((sub, subIdx) => {
              return (
                <li key={subIdx}>
                  <span style={{ marginRight: '0.5rem' }}>{createIcon(sub.status)}</span>

                  {sub.text}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  const health = props.health;

  return (
    <>
      {health.health.items.map((item, idx) => {
        return renderChildren(item, idx);
      })}
    </>
  );
};
