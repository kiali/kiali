import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from '../../config/KialiIcon';
import { useKialiTranslation } from 'utils/I18nUtils';
import { kialiStyle } from '../../styles/StyleUtils';

const infoIconStyle = kialiStyle({
  marginLeft: '0.5rem',
  cursor: 'pointer'
});

export const TypeHeader: React.FC = () => {
  const { t } = useKialiTranslation();

  const tooltipContent = (
    <div style={{ textAlign: 'left' }}>
      <div>
        <strong>{t('Namespace type')}</strong>
      </div>
      <div style={{ marginTop: '0.5rem' }}>
        <div>
          <strong>{t('CP')}</strong> - {t('Control plane')}: {t('Istio control plane')}
        </div>
        <div>
          <strong>{t('DP')}</strong> - {t('Data plane')}: {t('Namespace is part of the mesh')}
        </div>
        <div>
          <strong>-</strong> - {t('Not part of the mesh')}: {t('Namespace is not part of the mesh')}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {t('Type')}
      <Tooltip content={tooltipContent} position={TooltipPosition.top}>
        <span className={infoIconStyle}>
          <KialiIcon.Info />
        </span>
      </Tooltip>
    </>
  );
};
