import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { HelpIcon } from '@patternfly/react-icons';
import { useKialiTranslation } from 'utils/I18nUtils';

export const HealthHeader: React.FC = () => {
  const { t } = useKialiTranslation();

  const tooltipContent = (
    <div style={{ textAlign: 'left' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <strong>{t('Namespace Health')}</strong>
      </div>
      <div style={{ marginBottom: '0.5rem' }}>
        {t('The aggregate state of all apps, services and workloads within the namespace.')}
      </div>
      <div style={{ marginBottom: '0.25rem' }}>
        <strong>{t('Healthy')}</strong>: {t('All components are healthy')}
      </div>
      <div>
        <strong>{t('Unhealthy')}</strong>: {t('One or more components are unhealthy')}
      </div>
      <div>
        <strong>{'n/a'}</strong>: {t('No health information')}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span>{t('Health')}</span>
      <Tooltip aria-label="Namespace health information" position={TooltipPosition.auto} content={tooltipContent}>
        <HelpIcon style={{ cursor: 'pointer', color: '#6a6e73' }} />
      </Tooltip>
    </div>
  );
};
