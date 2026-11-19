import * as React from 'react';
import { useKialiTranslation } from 'utils/I18nUtils';

export const LabelsPopoverBody: React.FC = () => {
  const { t } = useKialiTranslation();

  return (
    <span data-test="labels-filter-help">
      {t(
        'Click a label to add or remove its filter. Labels matched by a filter expression must be changed using the filter controls.'
      )}
    </span>
  );
};
