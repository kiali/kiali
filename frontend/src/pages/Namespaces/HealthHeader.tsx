import * as React from 'react';
import { useKialiTranslation } from 'utils/I18nUtils';

export const HealthPopoverBody: React.FC = () => {
  const { t } = useKialiTranslation();

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        {t('Health represents the aggregated status of all apps, services, and workloads within the namespace.')}
      </div>
      <div style={{ marginBottom: '0.5rem' }}>
        {t("A namespace's status is determined by its lowest-performing component.")}
      </div>
      <div style={{ marginBottom: '0.25rem' }}>
        <strong>{t('Healthy')}</strong>: {t('All components operating normally and meeting all performance targets.')}
      </div>
      <div>
        <strong>{t('Unhealthy')}</strong>: {t('One or more components are not working as expected.')}
      </div>
      <div>{t('Including:')}</div>
      <ul style={{ margin: '0.125rem 0 0.25rem 1.25rem', paddingLeft: 0, listStyleType: 'disc' }}>
        <li>
          <strong>{t('Failure')}</strong>:{' '}
          {t('The component is in critical state and failing to meet basic requirements.')}
        </li>
        <li>
          <strong>{t('Degraded')}</strong>: {t('The component is functional but performing below optimal thresholds.')}
        </li>
        <li>
          <strong>{t('Not ready')}</strong>: {t('The component exists but cannot serve traffic yet.')}
        </li>
      </ul>
      <div>
        <strong>{'n/a'}</strong>: {t('No components available to monitor.')}
      </div>
    </div>
  );
};

export const HealthPopoverHeader: React.FC = () => {
  const { t } = useKialiTranslation();
  return <span>{t('Namespace Health')}</span>;
};
