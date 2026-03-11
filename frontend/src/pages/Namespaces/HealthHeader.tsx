import * as React from 'react';
import { useKialiTranslation } from 'utils/I18nUtils';

export const HealthPopoverBody: React.FC = () => {
  const { t } = useKialiTranslation();

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        {t('The aggregate state of all apps, services and workloads within the namespace.')}
      </div>
      <div style={{ marginBottom: '0.25rem' }}>
        <strong>{t('Healthy')}</strong>: {t('All components are healthy.')}
      </div>
      <div style={{ marginBottom: '0.25rem' }}>
        <strong>{t('Degraded')}</strong>: {t('One or more components have warnings.')}
      </div>
      <div style={{ marginBottom: '0.25rem' }}>
        <strong>{t('Failure')}</strong>: {t('One or more components have errors.')}
      </div>
      <div style={{ marginBottom: '0.25rem' }}>
        <strong>{t('Not Ready')}</strong>: {t('One or more components are not ready.')}
      </div>
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
