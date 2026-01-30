import * as React from 'react';
import { Button, ButtonVariant, Popover, PopoverPosition } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';
import { KialiIcon } from '../../config/KialiIcon';
import { headerWithHelpStyle } from './NamespaceStyle';

export const HealthHeader: React.FC = () => {
  const { t } = useKialiTranslation();

  const popoverBody = (
    <div style={{ textAlign: 'left' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        {t('The aggregate state of all apps, services and workloads within the namespace.')}
      </div>
      <div style={{ marginBottom: '0.25rem' }}>
        <strong>{t('Healthy')}</strong>: {t('All components are healthy.')}
      </div>
      <div>
        <strong>{t('Unhealthy')}</strong>: {t('One or more components are unhealthy.')}
      </div>
      <div>
        <strong>{'n/a'}</strong>: {t('No components available to monitor.')}
      </div>
    </div>
  );

  return (
    <div className={headerWithHelpStyle}>
      <span>{t('Health')}</span>
      <Popover
        aria-label={t('Namespace health information')}
        headerContent={<span>{t('Namespace Health')}</span>}
        bodyContent={popoverBody}
        position={PopoverPosition.top}
        triggerAction="hover"
      >
        <Button variant={ButtonVariant.link} isInline>
          <KialiIcon.Help />
        </Button>
      </Popover>
    </div>
  );
};
