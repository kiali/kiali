import * as React from 'react';
import { EmptyState, EmptyStateBody, EmptyStateVariant, EmptyStateHeader } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { RefreshIntervalManual } from 'config/Config';
import { IntervalInMilliseconds } from 'types/Common';
import { NamespaceInfo } from 'types/NamespaceInfo';
import { t } from 'utils/I18nUtils';

type EmptyOverviewProps = {
  filteredNamespaces: NamespaceInfo[];
  loaded?: boolean;
  refreshInterval?: IntervalInMilliseconds;
};

const emptyStateStyle = kialiStyle({
  height: '80%',
  marginRight: 'auto',
  marginLeft: 'auto',
  marginBottom: 10,
  marginTop: 10
});

type EmptyOverviewState = {};

export class EmptyOverview extends React.Component<EmptyOverviewProps, EmptyOverviewState> {
  render(): React.ReactNode {
    if (this.props.refreshInterval === RefreshIntervalManual && !this.props.loaded) {
      return (
        <EmptyState
          id="empty-vl-manual"
          data-test="manual-refresh"
          variant={EmptyStateVariant.lg}
          className={emptyStateStyle}
        >
          <EmptyStateHeader titleText={t('Manual refresh required')} headingLevel="h5" />
          <EmptyStateBody>
            {t(
              'The refresh interval is set to "Manual". To render the overview, select your desired filters and options and then click the Refresh button. Or, if preferred, change the setting to the desired interval.'
            )}
          </EmptyStateBody>
        </EmptyState>
      );
    }

    if (this.props.filteredNamespaces.length === 0) {
      return (
        <EmptyState id="empty-vl-manual" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateHeader titleText={t('No unfiltered namespaces')} headingLevel="h5" />
          <EmptyStateBody>
            {t('Either all namespaces are being filtered or the user has no permission to access namespaces.')}
          </EmptyStateBody>
        </EmptyState>
      );
    }

    return this.props.children;
  }
}
