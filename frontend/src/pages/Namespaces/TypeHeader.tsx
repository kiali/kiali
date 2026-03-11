import * as React from 'react';
import { useKialiTranslation } from 'utils/I18nUtils';

export const TypePopoverBody: React.FC = () => {
  const { t } = useKialiTranslation();

  return (
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
};

export const TypePopoverHeader: React.FC = () => {
  const { t } = useKialiTranslation();
  return <span>{t('Namespace type')}</span>;
};
