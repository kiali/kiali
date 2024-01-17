import * as React from 'react';
import * as H from '../../types/Health';
import { PFColors } from '../Pf/PfColors';
import { Title, TitleSizes } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon, createIcon } from 'config/KialiIcon';

interface HealthDetailsProps {
  health: H.Health;
}

const titleStyle = kialiStyle({
  margin: '1rem 0 0.5rem 0'
});

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

              {config && isValueInConfig && (
                <li key="degraded_failure_config">
                  <span style={{ marginRight: '0.5rem' }}>{createIcon(H.DEGRADED)}</span>:{' '}
                  {config.degraded === 0 ? '>' : '>='}
                  {config.degraded}% {createIcon(H.FAILURE)}: {config.degraded === 0 ? '>' : '>='}
                  {config.failure}%
                </li>
              )}
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
        <>
          {`${item.title}${item.text && item.text.length > 0 ? ': ' : ''} `}

          {config && <KialiIcon.Info color={PFColors.Color200} />}
        </>

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

            {config && isValueInConfig && (
              <li key="degraded_failure_config">
                <span style={{ marginRight: '0.5rem' }}>{createIcon(H.DEGRADED)}</span>:{' '}
                {config.degraded === 0 ? '>' : '>='}
                {config.degraded}% {createIcon(H.FAILURE)}: {config.degraded === 0 ? '>' : '>='}
                {config.failure}%
              </li>
            )}
          </ul>
        )}
      </div>
    ) : (
      <React.Fragment key={idx} />
    );
  };

  const renderChildren = (item: H.HealthItem, idx: number): React.ReactNode => {
    return item.title.startsWith(H.TRAFFICSTATUS) ? (
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
