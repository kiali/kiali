import * as React from 'react';
import { EmptyState, EmptyStateBody, EmptyStateVariant } from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import { classes } from 'typestyle';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

const centerStyle = kialiStyle({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  flex: 1,
  paddingTop: '10vh'
});

type ManualRefreshEmptyStateProps = {
  className?: string;
};

export const ManualRefreshEmptyState: React.FC<ManualRefreshEmptyStateProps> = ({ className }) => (
  <div className={classes(centerStyle, className)}>
    <EmptyState
      headingLevel="h5"
      icon={SyncAltIcon}
      titleText={t('Manual refresh required')}
      data-test="manual-refresh"
      variant={EmptyStateVariant.lg}
    >
      <EmptyStateBody>
        {t(
          'The refresh interval is set to "Manual". To render the page, select desired filters or options and then click the Refresh button. Or, change the refresh interval.'
        )}
      </EmptyStateBody>
    </EmptyState>
  </div>
);
