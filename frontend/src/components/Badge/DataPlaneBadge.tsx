import * as React from 'react';
import { Label, Tooltip } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';

export const DataPlaneBadge: React.FC = () => {
  const { t } = useKialiTranslation();

  return (
    <Tooltip content={<span>{t('Data plane')}</span>}>
      <Label style={{ marginLeft: '0.5rem' }} color="blue" isCompact data-test="data-plane-badge">
        {t('DP')}
      </Label>
    </Tooltip>
  );
};
