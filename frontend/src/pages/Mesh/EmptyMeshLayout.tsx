import * as React from 'react';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  EmptyStateFooter
} from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import * as _ from 'lodash';
import { KialiIcon } from '../../config/KialiIcon';
import { DecoratedMeshElements } from 'types/Mesh';
import { IntervalInMilliseconds } from 'types/Common';
import { RefreshIntervalManual } from 'config/Config';
import { t } from 'utils/I18nUtils';

type EmptyMeshLayoutProps = {
  action?: any;
  elements?: DecoratedMeshElements;
  isLoading?: boolean;
  isError: boolean;
  isMiniMesh: boolean;
  loaded: boolean;
  refreshInterval: IntervalInMilliseconds;
  error?: string;
};

const emptyStateStyle = kialiStyle({
  height: '98%',
  marginRight: 'auto',
  marginLeft: 'auto',
  marginBottom: 10,
  marginTop: 10
});

type EmptyMeshLayoutState = {};

export class EmptyMeshLayout extends React.Component<EmptyMeshLayoutProps, EmptyMeshLayoutState> {
  shouldComponentUpdate(nextProps: EmptyMeshLayoutProps) {
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

    // Do not update if we have elements, as this means we are refreshing
    return nextIsEmpty;
  }

  render() {
    if (this.props.isError) {
      return (
        <EmptyState  headingLevel="h5" icon={KialiIcon.Error}  titleText={t('Error loading Mesh')} id="empty-mesh-error" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateBody>{this.props.error}</EmptyStateBody>
        </EmptyState>
      );
    }
    if (this.props.isLoading) {
      return (
        <EmptyState  headingLevel="h5"   titleText={t('Loading Mesh')} id="empty-mesh-is-loading" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          </EmptyState>
      );
    }

    if (this.props.refreshInterval === RefreshIntervalManual && !this.props.loaded && !this.props.isMiniMesh) {
      return (
        <EmptyState  headingLevel="h5"   titleText={t('Manual refresh required')}
          id="empty-graph-manual"
          data-test="manual-refresh"
          variant={EmptyStateVariant.lg}
          className={emptyStateStyle}
        >
          <EmptyStateBody>
            {t(
              'The refresh interval is set to "Manual". To render the mesh, select your desired filters and options and then click the Refresh button. Or, if preferred, change the setting to the desired interval.'
            )}
          </EmptyStateBody>
        </EmptyState>
      );
    }

    const isMeshEmpty = !this.props.elements || !this.props.elements.nodes || this.props.elements.nodes.length < 1;
    if (isMeshEmpty && !this.props.isMiniMesh) {
      return (
        <EmptyState  headingLevel="h5"   titleText={t('Empty Mesh')} id="empty-mesh" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateBody>
            {t(
              'There is currently no mesh information available. This may mean you do not have permission to see any mesh information or have no access to any of the mesh namespaces.'
            )}
          </EmptyStateBody>
          <EmptyStateFooter></EmptyStateFooter>
        </EmptyState>
      );
    }

    if (isMeshEmpty && this.props.isMiniMesh) {
      return (
        <EmptyState  headingLevel="h5"   titleText={t('Empty Mesh')} id="empty-mini-mesh" variant={EmptyStateVariant.lg} className={emptyStateStyle}>
          <EmptyStateBody>{t('No mesh information available.')}</EmptyStateBody>
        </EmptyState>
      );
    }

    return this.props.children;
  }
}
