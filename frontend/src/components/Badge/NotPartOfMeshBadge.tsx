import * as React from 'react';
import { Label, Tooltip } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';

export const NotPartOfMeshBadge: React.FC = () => {
  const { t } = useKialiTranslation();

  return (
    <Tooltip content={<span>{t('Not part of the mesh')}</span>}>
      <Label
        style={{ marginLeft: '0.5rem', minWidth: '2rem', textAlign: 'center' }}
        color="grey"
        isCompact
        data-test="not-part-of-mesh-badge"
      >
        -
      </Label>
    </Tooltip>
  );
};
