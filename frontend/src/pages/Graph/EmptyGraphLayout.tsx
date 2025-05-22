import * as React from 'react';
import {
  Button,
  ButtonVariant,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  EmptyStateFooter
} from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import * as _ from 'lodash';
import { Namespace } from '../../types/Namespace';
import { KialiIcon } from '../../config/KialiIcon';
import { DecoratedGraphElements } from '../../types/Graph';
import { RefreshIntervalManual } from 'config/Config';
import { IntervalInMilliseconds } from 'types/Common';
import { t } from 'utils/I18nUtils';

type EmptyGraphLayoutProps = {
  action?: any;
  elements?: DecoratedGraphElements;
  error?: string;
  isError: boolean;
  isLoading?: boolean;
  isMiniGraph: boolean;
  loaded: boolean;
  namespaces?: Namespace[];
  refreshInterval?: IntervalInMilliseconds;
  showIdleNodes?: boolean;
  toggleIdleNodes?: () => void;
};

const emptyStateStyle = kialiStyle({
  height: '98%',
  marginRight: 'auto',
  marginLeft: 'auto',
  marginBottom: 10,
  marginTop: 10
});

type EmptyGraphLayoutState = {};

export class EmptyGraphLayout extends React.Component<EmptyGraphLayoutProps, EmptyGraphLayoutState> {
  shouldComponentUpdate(nextProps: EmptyGraphLayoutProps): boolean {
    const currentIsEmpty = this.props.elements === undefined || _.isEmpty(this.props.elements.nodes);
    const nextIsEmpty = nextProps.elements === undefined || _.isEmpty(nextProps.elements.nodes);

    // Update if we have elements and we are not loading
    if (!nextProps.isLoading && !nextIsEmpty) {
      return true;
    }

    // Update if we are going from having no elements to having elements or vice versa
    if (currentIsEmpty !== nextIsEmpty) {
      return true;
    }
    // Do not update if we have elements and the namespace didn't change, as this means we are refreshing
    return !(!nextIsEmpty && _.isEqual(this.props.namespaces, nextProps.namespaces));
  }

  namespacesText(): React.ReactElement | null {
    if (this.props.namespaces && this.props.namespaces.length > 0) {
      if (this.props.namespaces.length === 1) {
        return (
          <div>
            <b>{this.props.namespaces[0].name}</b>
          </div>
        );
      } else {
        const namespacesString = `${this.props.namespaces
          .slice(0, -1)
          .map(namespace => namespace.name)
          .join(',')} and ${this.props.namespaces[this.props.namespaces.length - 1].name}`;
        return (
          <div>
            <b>{namespacesString}</b>
          </div>
        );
      }
    }
    return null;
  }

  render(): React.ReactNode {
    if (this.props.isError) {
      return (
        <EmptyState  headingLevel="h5" icon={KialiIcon.Error}  titleText={t('Error loading graph')} id="empty-graph-error" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateBody>{this.props.error}</EmptyStateBody>
        </EmptyState>
      );
    }

    if (this.props.isLoading) {
      return (
        <EmptyState  headingLevel="h5"   titleText={t('Loading graph')} id="empty-graph-is-loading" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          </EmptyState>
      );
    }

    const isGraphEmpty = !this.props.elements || !this.props.elements.nodes || this.props.elements.nodes.length < 1;

    if (this.props.namespaces?.length === 0) {
      return (
        <EmptyState  headingLevel="h5"   titleText={t('No namespace is selected')} id="empty-graph-no-namespace" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateBody>
            {t('There is currently no namespace selected, please select one using the Namespace selector.')}
          </EmptyStateBody>
        </EmptyState>
      );
    }

    if (this.props.refreshInterval === RefreshIntervalManual && !this.props.loaded && !this.props.isMiniGraph) {
      return (
        <EmptyState  headingLevel="h5"   titleText={t('Manual refresh required')}
          id="empty-graph-manual"
          data-test="manual-refresh"
          variant={EmptyStateVariant.lg}
          className={emptyStateStyle}
        >
          <EmptyStateBody>
            {t(
              'The refresh interval is set to "Manual". To render the graph, select your desired filters and options and then click the Refresh button. Or, if preferred, change the setting to the desired interval.'
            )}
          </EmptyStateBody>
        </EmptyState>
      );
    }

    if (isGraphEmpty && !this.props.isMiniGraph) {
      return (
        <EmptyState  headingLevel="h5"   titleText={t('Empty Graph')} id="empty-graph" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateBody>
            {t(
              'There is currently no graph available for the selected namespaces. This usually means the namespaces do not have measurable traffic for the selected time period:'
            )}
            {this.namespacesText()}
            <br />
            {this.props.showIdleNodes && (
              <>
                {t(
                  'You are currently displaying "Idle nodes". Send requests to the service mesh and click the Refresh button.'
                )}
              </>
            )}
            {!this.props.showIdleNodes && (
              <>{t('You can enable "Idle Nodes" to display nodes that have yet to see any request traffic.')}</>
            )}
            <p>
              <br />
              {t('To read the FAQ entry about why your graph may be empty, ')}
              <a href={'https://kiali.io/docs/faq/graph/#emptygraph'} target="_blank" rel="noreferrer">
                {t('click here.')}
              </a>
            </p>
          </EmptyStateBody>
          <EmptyStateFooter>
            <Button
              onClick={this.props.showIdleNodes ? this.props.action : this.props.toggleIdleNodes}
              variant={ButtonVariant.primary}
            >
              {(this.props.showIdleNodes && <>{t('Refresh')}</>) || <>{t('Display idle nodes')}</>}
            </Button>
          </EmptyStateFooter>
        </EmptyState>
      );
    }

    if (isGraphEmpty && this.props.isMiniGraph) {
      return (
        <EmptyState  headingLevel="h5"   titleText={t('Empty Graph')} id="empty-mini-graph" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateBody>{t('No graph traffic for the time period.')}</EmptyStateBody>
        </EmptyState>
      );
    }

    return this.props.children;
  }
}
