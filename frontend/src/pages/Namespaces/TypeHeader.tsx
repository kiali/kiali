import * as React from 'react';
import { Button, ButtonVariant, Popover, PopoverPosition } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';
import { KialiIcon } from '../../config/KialiIcon';
import { headerWithHelpStyle } from './NamespaceStyle';

export const TypeHeader: React.FC = () => {
  const { t } = useKialiTranslation();

  const popoverBody = (
    <div style={{ textAlign: 'left' }}>
      <div>
        <strong>{t('CP')}</strong> - {t('Control plane')}: {t('Istio control plane.')}
      </div>
      <div>
        <strong>{t('DP')}</strong> - {t('Data plane')}: {t('Namespace is part of the mesh.')}
      </div>
      <div>
        <strong>Empty</strong> - {t('Namespace is not part of the mesh.')}
      </div>
    </div>
  );

  return (
    <div className={headerWithHelpStyle}>
      <span>{t('Type')}</span>
      <Popover
        aria-label={t('Namespace type information')}
        headerContent={<span>{t('Namespace type')}</span>}
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
