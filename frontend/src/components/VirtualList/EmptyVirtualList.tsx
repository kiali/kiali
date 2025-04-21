import * as React from 'react';
import { EmptyState, EmptyStateBody, EmptyStateVariant, EmptyStateHeader } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { RefreshIntervalManual } from 'config/Config';
import { IntervalInMilliseconds } from 'types/Common';

type EmptyVirtualListProps = {
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

type EmptyVirtualListState = {};

export class EmptyVirtualList extends React.Component<EmptyVirtualListProps, EmptyVirtualListState> {
  render(): React.ReactNode {
    if (this.props.refreshInterval === RefreshIntervalManual && !this.props.loaded) {
      return (
        <EmptyState
          id="empty-vl-manual"
          data-test="manual-refresh"
          variant={EmptyStateVariant.lg}
          className={emptyStateStyle}
        >
          <EmptyStateHeader titleText="Manual refresh required" headingLevel="h5" />
          <EmptyStateBody>
            The refresh interval is set to 'Manual'. To render the list, select your desired filters and options and
            then click the Refresh button. Or, if preferred, change the setting to the desired interval.
          </EmptyStateBody>
        </EmptyState>
      );
    }

    return this.props.children;
  }
}
