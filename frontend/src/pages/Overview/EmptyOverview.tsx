import * as React from 'react';
import { EmptyState, EmptyStateBody, EmptyStateVariant,  } from '@patternfly/react-core';
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
        <EmptyState  headingLevel="h5"   titleText={t('Manual refresh required')}
          id="empty-vl-manual"
          data-test="manual-refresh"
          variant={EmptyStateVariant.lg}
          className={emptyStateStyle}
        >
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
        <EmptyState  headingLevel="h5"   titleText={t('No unfiltered namespaces')} id="empty-vl-manual" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateBody>
            {t('Either all namespaces are being filtered or the user has no permission to access namespaces.')}
          </EmptyStateBody>
        </EmptyState>
      );
    }

    return this.props.children;
  }
}
